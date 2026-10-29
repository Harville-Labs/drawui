import {
  DEFAULT_STROKE,
  type Element,
  FRAME_STROKE,
  isNote,
  metaOf,
  noteText,
  type SourceRef,
} from './elements.ts';
import {
  area,
  type Box,
  boxOf,
  contains,
  containsPoint,
  endpoints,
  type Layout,
  layoutOf,
  readingRows,
  rounded,
} from './geometry.ts';

export type NodeKind = 'screen' | 'shape' | 'text' | 'note' | 'image' | 'embed' | 'sketch';

/** One drawn thing, with what it contains. This is what the agent reads instead of raw elements. */
export type UiNode = {
  id: string;
  kind: NodeKind;
  /** The Excalidraw type, for shapes: rectangle, ellipse, diamond. */
  shape?: string;
  /** Visible text: a shape's bound label, a frame's name, or a text element's content. */
  label?: string;
  box: Box;
  fill?: string;
  stroke?: string;
  dashed?: boolean;
  link?: string;
  /** How the children are arranged, when there are two or more. */
  layout?: Layout;
  /** Notes to the agent written inside this element, or pointed at it with an arrow. */
  notes: string[];
  source?: SourceRef;
  byAgent?: boolean;
  children: UiNode[];
};

export type UiArrow = {
  id: string;
  from: string | null;
  to: string | null;
  label?: string;
  dashed?: boolean;
  byAgent?: boolean;
};

export type UiTree = {
  roots: UiNode[];
  arrows: UiArrow[];
  /**
   * Text that became part of another node instead of a node of its own (notes, and free text
   * read as a shape's label), mapped to that node's id.
   */
  owners: Map<string, string>;
};

const CONTAINER_TYPES = new Set(['rectangle', 'ellipse', 'diamond', 'frame', 'magicframe']);

function kindOf(el: Element): NodeKind {
  switch (el.type) {
    case 'frame':
    case 'magicframe':
      return 'screen';
    case 'text':
      return isNote(el) ? 'note' : 'text';
    case 'image':
      return 'image';
    case 'embeddable':
    case 'iframe':
      return 'embed';
    case 'rectangle':
    case 'ellipse':
    case 'diamond':
      return 'shape';
    default:
      return 'sketch';
  }
}

/**
 * Turns Excalidraw elements into a tree of UI nodes.
 *
 * - A shape's parent is the smallest shape or frame whose box contains it. Rectangle edges mark containers.
 * - Text bound to a shape or arrow is that element's label, not a node of its own. So is free text
 *   that is the only thing inside an unlabeled shape, which is what double-clicking a hollow shape makes.
 * - Notes (text starting with `//`, or marked as a note) attach to their container, or to the element an
 *   arrow from the note points at.
 * - Children are ordered top to bottom, then left to right, with a layout hint.
 */
export function interpret(elements: readonly Element[]): UiTree {
  const live = elements.filter((el) => !el.isDeleted);
  const byId = new Map(live.map((el) => [el.id, el]));

  const labels = new Map<string, string>();
  for (const el of live) {
    if (el.type === 'text' && el.containerId && byId.has(el.containerId)) {
      labels.set(el.containerId, (el.text ?? '').trim());
    }
  }

  const boxes = new Map(live.map((el) => [el.id, boxOf(el)]));
  const box = (el: Element) => boxes.get(el.id) as Box;
  const containers = live.filter((el) => CONTAINER_TYPES.has(el.type));
  const isLabel = (el: Element) =>
    el.type === 'text' && el.containerId != null && byId.has(el.containerId);
  // Arrows become edges; lines and freehand strokes stay in the tree as sketches.
  const placed = live.filter((el) => el.type !== 'arrow' && !isLabel(el));

  const parentOf = (el: Element): Element | undefined => {
    let best: Element | undefined;
    for (const c of containers) {
      if (c.id === el.id) continue;
      if (area(box(c)) <= area(box(el))) continue;
      if (!contains(box(c), box(el))) continue;
      if (!best || area(box(c)) < area(box(best))) best = c;
    }
    if (!best && el.frameId && byId.get(el.frameId)) return byId.get(el.frameId);
    return best;
  };

  // Resolve an arrow end to the element it touches: its binding, else the smallest node under the point.
  const targetAt = (binding: string | undefined, point: [number, number] | undefined) => {
    if (binding && byId.has(binding)) {
      const bound = byId.get(binding) as Element;
      return isLabel(bound) ? (bound.containerId as string) : bound.id;
    }
    if (!point) return null;
    let best: Element | undefined;
    for (const el of placed) {
      if (!containsPoint(box(el), point)) continue;
      if (!best || area(box(el)) < area(box(best))) best = el;
    }
    return best?.id ?? null;
  };

  const nodes = new Map<string, UiNode>();
  for (const el of placed) nodes.set(el.id, toNode(el, labels));

  const arrows: UiArrow[] = [];
  const owners = new Map<string, string>();
  for (const el of live) {
    if (el.type !== 'arrow') continue;
    const ends = endpoints(el);
    const from = targetAt(el.startBinding?.elementId, ends?.[0]);
    const to = targetAt(el.endBinding?.elementId, ends?.[1]);
    const fromEl = from ? byId.get(from) : undefined;
    const toNodeRef = to ? nodes.get(to) : undefined;
    // An arrow from a note to an element hangs the note on that element.
    if (fromEl && isNote(fromEl) && toNodeRef && from !== to) {
      toNodeRef.notes.push(noteText(fromEl));
      owners.set(fromEl.id, toNodeRef.id);
      continue;
    }
    const label = labels.get(el.id);
    arrows.push({
      id: el.id,
      from,
      to,
      ...(label ? { label } : {}),
      ...(el.strokeStyle !== 'solid' ? { dashed: true } : {}),
      ...(metaOf(el).author === 'agent' ? { byAgent: true } : {}),
    });
  }

  const roots: UiNode[] = [];
  const childrenOf = new Map<string, Element[]>();
  for (const el of placed) {
    if (owners.has(el.id)) continue;
    const parent = parentOf(el);
    if (isNote(el) && parent) {
      nodes.get(parent.id)?.notes.push(noteText(el));
      owners.set(el.id, parent.id);
      continue;
    }
    if (!parent) {
      roots.push(nodes.get(el.id) as UiNode);
      continue;
    }
    const siblings = childrenOf.get(parent.id) ?? [];
    siblings.push(el);
    childrenOf.set(parent.id, siblings);
  }

  for (const [parentId, kids] of childrenOf) {
    const parent = nodes.get(parentId) as UiNode;
    const [only] = kids;
    if (kids.length === 1 && only && parent.kind === 'shape' && !parent.label) {
      const child = nodes.get(only.id) as UiNode;
      if (child.kind === 'text' && child.label) {
        parent.label = child.label;
        owners.set(child.id, parent.id);
        continue;
      }
    }
    const rows = readingRows(kids, box);
    parent.children = rows.flat().map((k) => nodes.get(k.id) as UiNode);
    const layout = layoutOf(rows);
    if (layout) parent.layout = layout;
  }

  const rootRows = readingRows(roots, (n) => n.box);
  return { roots: rootRows.flat(), arrows, owners };
}

function toNode(el: Element, labels: Map<string, string>): UiNode {
  const meta = metaOf(el);
  const kind = kindOf(el);
  const label =
    kind === 'screen'
      ? (el.name ?? undefined)
      : kind === 'text'
        ? (el.text ?? '').trim()
        : kind === 'note'
          ? noteText(el)
          : labels.get(el.id);
  const node: UiNode = { id: el.id, kind, box: rounded(boxOf(el)), notes: [], children: [] };
  if (kind === 'shape') node.shape = el.type;
  if (label) node.label = label;
  if (el.backgroundColor !== 'transparent') node.fill = el.backgroundColor;
  const defaultStroke = kind === 'screen' ? FRAME_STROKE : DEFAULT_STROKE;
  if (el.strokeColor !== defaultStroke && kind !== 'note') node.stroke = el.strokeColor;
  if (el.strokeStyle !== 'solid') node.dashed = true;
  if (el.link) node.link = el.link;
  if (meta.source) node.source = meta.source;
  if (meta.author === 'agent') node.byAgent = true;
  return node;
}

/** Finds a node by id anywhere in the tree. */
export function findNode(roots: readonly UiNode[], id: string): UiNode | undefined {
  for (const node of roots) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}

/**
 * The selected subtrees: each selected node with its children, skipping nodes whose ancestor is
 * also selected. Selected labels count as their container, and selected notes as what they annotate.
 */
export function selectedSubtrees(
  tree: UiTree,
  selected: readonly string[],
  elements: readonly Element[],
): UiNode[] {
  const containerOf = new Map(
    elements.filter((el) => el.containerId).map((el) => [el.id, el.containerId as string]),
  );
  const ids = new Set(selected.map((id) => containerOf.get(id) ?? tree.owners.get(id) ?? id));
  const out: UiNode[] = [];
  const walk = (nodes: readonly UiNode[]) => {
    for (const node of nodes) {
      if (ids.has(node.id)) out.push(node);
      else walk(node.children);
    }
  };
  walk(tree.roots);
  return out;
}
