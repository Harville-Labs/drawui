import './asset-path.ts';
import {
  AGENT_NOTE_COLOR,
  arrowBetween,
  type Box,
  type CanvasOp,
  contains,
  DEVICES,
  type Device,
  type DrawuiMeta,
  type ElementPatch,
  FRAME_STROKE,
  freeSpot,
  NOTE_PREFIX,
  nextScreenSpot,
  type Point,
  type ShapeInput,
  screenName,
} from '@drawui/core';
import {
  convertToExcalidrawElements,
  exportToBlob,
  getCommonBounds,
  newElementWith,
  restoreElements,
} from '@excalidraw/excalidraw';
import type {
  ExcalidrawElementSkeleton,
  ValidLinearElement,
} from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFiles } from '@excalidraw/excalidraw/types';

type Elements = readonly ExcalidrawElement[];
type Skeleton = ExcalidrawElementSkeleton;
type ArrowSkeleton = ValidLinearElement;

/** The scene before and after an op, and what the server gets back. */
export type OpOutcome = { elements: ExcalidrawElement[]; data: unknown };

const NOTE_GAP = 48;

function agentMeta(source?: DrawuiMeta['source'], kind?: 'note'): Record<string, unknown> {
  return { drawui: { author: 'agent', ...(kind ? { kind } : {}), ...(source ? { source } : {}) } };
}

function mergeMeta(el: ExcalidrawElement, patch: Partial<DrawuiMeta>): Record<string, unknown> {
  const current = (el.customData?.drawui ?? {}) as Record<string, unknown>;
  const next = { ...current, ...patch };
  for (const key of Object.keys(next))
    if (next[key as keyof typeof next] === undefined) delete next[key as keyof typeof next];
  return { ...el.customData, drawui: next };
}

function find(elements: Elements, id: string): ExcalidrawElement {
  const el = elements.find((e) => e.id === id && !e.isDeleted);
  if (!el) throw new Error(`No element "${id}" on the canvas. get_canvas lists the ids.`);
  return el;
}

function skeletonOf(shape: ShapeInput): Skeleton {
  switch (shape.type) {
    case 'rectangle':
    case 'ellipse':
    case 'diamond':
      return {
        type: shape.type,
        id: shape.id,
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        strokeColor: shape.stroke,
        backgroundColor: shape.fill,
        fillStyle: shape.fill ? 'solid' : undefined,
        strokeStyle: shape.dashed ? 'dashed' : undefined,
        label: shape.label ? { text: shape.label } : undefined,
        customData: agentMeta(shape.source),
      };
    case 'text':
      return {
        type: 'text',
        id: shape.id,
        x: shape.x,
        y: shape.y,
        text: shape.text,
        strokeColor: shape.stroke,
        customData: agentMeta(shape.source),
      };
    case 'frame':
      return {
        type: 'frame',
        id: shape.id,
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        name: shape.name,
        strokeColor: FRAME_STROKE,
        children: [],
        customData: agentMeta(shape.source),
      };
    case 'arrow':
      return {
        type: 'arrow',
        id: shape.id,
        x: 0,
        y: 0,
        start: { id: shape.from },
        end: { id: shape.to },
        strokeStyle: shape.dashed ? 'dashed' : undefined,
        label: shape.label ? { text: shape.label } : undefined,
        customData: agentMeta(),
      };
  }
}

const ARROW_GAP = 8;
// What Excalidraw's converter can bind an arrow to. Other ends (frames, freehand, images) get an
// arrow that touches their edge, which is how get_canvas reads an unbound arrow.
const BINDABLE = new Set<string>(['rectangle', 'ellipse', 'diamond', 'text']);

function boundsOf(el: ExcalidrawElement): Box {
  const [minX, minY, maxX, maxY] = getCommonBounds([el]);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function endId(end: unknown): string | undefined {
  return end && typeof end === 'object' && 'id' in end && typeof end.id === 'string'
    ? end.id
    : undefined;
}

/**
 * Excalidraw's converter reads a frame at x or y 0 as unset and refits it to its children. Puts each
 * frame back where it was asked for, and moves the shapes drawn inside it into it.
 */
function placeFrames(skeletons: Skeleton[], built: ExcalidrawElement[]): ExcalidrawElement[] {
  const frames = skeletons.filter((s) => s.type === 'frame');
  let next = built;
  for (const s of frames) {
    const box = { x: s.x ?? 0, y: s.y ?? 0, width: s.width ?? 0, height: s.height ?? 0 };
    next = next.map((el) => {
      if (el.id === s.id) return newElementWith(el, box);
      if (el.type !== 'frame' && !el.frameId && contains(box, boundsOf(el)))
        return newElementWith(el, { frameId: s.id ?? null });
      return el;
    });
  }
  return next;
}

/** A new empty screen the user asked for: a frame sized for the device, right of what is drawn. */
export function newScreen(elements: Elements, screen: string, device: Device): ExcalidrawElement {
  const size = DEVICES.find((d) => d.device === device);
  if (!size) throw new Error(`No screen size for device "${device}".`);
  const [x, y] = nextScreenSpot(elements.filter((el) => !el.isDeleted).map(boundsOf));
  const skeleton: Skeleton = {
    type: 'frame',
    x,
    y,
    width: size.width,
    height: size.height,
    name: screenName(screen, device),
    // The converter gives frames the default shape stroke, not the one Excalidraw's frame tool uses.
    strokeColor: FRAME_STROKE,
    children: [],
  };
  const [frame] = placeFrames([skeleton], convertToExcalidrawElements([skeleton]));
  if (!frame) throw new Error('Excalidraw made no frame for the new screen.');
  return frame;
}

/**
 * Turns skeletons into elements. Excalidraw's converter places an arrow's ends relative to the arrow
 * instead of routing the arrow between them, so shapes are converted first, then each arrow is routed
 * edge to edge and bound against stand-ins of its ends, of which only the new `boundElements` are kept.
 */
function build(existing: Elements, skeletons: Skeleton[]): ExcalidrawElement[] {
  const shapes = skeletons.filter((s) => s.type !== 'arrow');
  const arrows = skeletons.filter((s): s is ArrowSkeleton => s.type === 'arrow');
  const scene = [
    ...existing,
    ...placeFrames(shapes, convertToExcalidrawElements(shapes, { regenerateIds: false })),
  ];
  if (arrows.length === 0) return scene;

  const ends = new Map<string, ExcalidrawElement>();
  for (const arrow of arrows) {
    const [from, to] = [endId(arrow.start), endId(arrow.end)].map((id) => {
      if (!id) throw new Error('Arrows need "from" and "to" ids.');
      return find(scene, id);
    }) as [ExcalidrawElement, ExcalidrawElement];
    const gapFor = (el: ExcalidrawElement) => (BINDABLE.has(el.type) ? ARROW_GAP : 0);
    const route = arrowBetween(boundsOf(from), boundsOf(to), [gapFor(from), gapFor(to)]);
    const [, [dx, dy]] = route.points as [Point, Point];
    // The converter rebuilds a text end at the arrow's start unless it's given the text's own position.
    const bind = (el: ExcalidrawElement) => {
      if (!BINDABLE.has(el.type)) return undefined;
      ends.set(el.id, el);
      return { id: el.id, x: el.x, y: el.y };
    };
    Object.assign(arrow, {
      ...route,
      width: Math.abs(dx),
      height: Math.abs(dy),
      start: bind(from),
      end: bind(to),
    });
  }
  const standIns = [...ends.values()].map((el) => ({ ...el }) as unknown as Skeleton);
  const built = convertToExcalidrawElements([...standIns, ...arrows], { regenerateIds: false });
  const byId = new Map(built.map((el) => [el.id, el]));
  const rebound = scene.map((el) =>
    ends.has(el.id)
      ? newElementWith(el, { boundElements: byId.get(el.id)?.boundElements ?? null })
      : el,
  );
  return [...rebound, ...built.filter((el) => !ends.has(el.id))];
}

function draw(elements: Elements, shapes: ShapeInput[]): OpOutcome {
  const live = new Set(elements.filter((el) => !el.isDeleted).map((el) => el.id));
  const requested = new Set(shapes.map((shape) => shape.id).filter(Boolean));
  for (const id of requested) {
    if (id && live.has(id))
      throw new Error(`An element "${id}" already exists. Pick another id, or use update.`);
  }
  // A deleted element stays as a tombstone so other tabs see the delete. A shape drawn with its id
  // replaces it, one version up so the new shape wins when tabs reconcile.
  const tombstones = new Map(
    elements.filter((el) => requested.has(el.id)).map((el) => [el.id, el.version]),
  );
  const kept = elements.filter((el) => !tombstones.has(el.id));
  const before = new Set(kept.map((el) => el.id));
  const next = build(kept, shapes.map(skeletonOf)).map((el) => {
    const version = tombstones.get(el.id);
    return version === undefined ? el : { ...el, version: version + 1 };
  });
  // Labels are elements too; report the shapes the agent asked for.
  const ids = next
    .filter((el) => !before.has(el.id) && !('containerId' in el && el.containerId))
    .map((el) => el.id);
  return { elements: next, data: { ids } };
}

function boundTextOf(elements: Elements, id: string): ExcalidrawElement | undefined {
  return elements.find((el) => el.type === 'text' && el.containerId === id && !el.isDeleted);
}

/** Adds a label to a container that has none, measured the way Excalidraw measures its own labels. */
function newLabel(container: ExcalidrawElement, text: string): ExcalidrawElement {
  const [, label] = convertToExcalidrawElements(
    [{ ...(container as unknown as Skeleton), label: { text } } as Skeleton],
    { regenerateIds: false },
  );
  if (!label) throw new Error(`Couldn't add a label to "${container.id}".`);
  return label;
}

function update(elements: Elements, patches: ElementPatch[]): OpOutcome {
  let next = [...elements];
  const added: ExcalidrawElement[] = [];
  for (const patch of patches) {
    const el = find(next, patch.id);
    const changes: Record<string, unknown> = {};
    if (patch.x !== undefined) changes.x = patch.x;
    if (patch.y !== undefined) changes.y = patch.y;
    if (patch.width !== undefined) changes.width = patch.width;
    if (patch.height !== undefined) changes.height = patch.height;
    if (patch.stroke !== undefined) changes.strokeColor = patch.stroke;
    if (patch.fill !== undefined)
      Object.assign(changes, { backgroundColor: patch.fill, fillStyle: 'solid' });
    if (patch.dashed !== undefined) changes.strokeStyle = patch.dashed ? 'dashed' : 'solid';
    if (patch.source !== undefined)
      changes.customData = mergeMeta(el, { source: patch.source ?? undefined });

    let labelChange: { id: string; text: string } | undefined;
    if (patch.label !== undefined) {
      if (el.type === 'text')
        Object.assign(changes, { text: patch.label, originalText: patch.label });
      else {
        const bound = boundTextOf(next, el.id);
        if (bound) labelChange = { id: bound.id, text: patch.label };
        else if (patch.label) {
          const label = newLabel({ ...el, ...changes } as ExcalidrawElement, patch.label);
          added.push(label);
          changes.boundElements = [...(el.boundElements ?? []), { id: label.id, type: 'text' }];
        }
      }
    }
    next = next.map((e) => {
      if (e.id === el.id) return newElementWith(e, changes);
      if (labelChange && e.id === labelChange.id) {
        return newElementWith(e, {
          text: labelChange.text,
          originalText: labelChange.text,
        } as Partial<ExcalidrawElement>);
      }
      return e;
    });
  }
  // Re-measures text and re-fits labels to their resized containers.
  const restored = restoreElements([...next, ...added], null, {
    refreshDimensions: true,
    repairBindings: true,
  });
  return { elements: restored, data: { ids: patches.map((p) => p.id) } };
}

function remove(elements: Elements, ids: string[]): OpOutcome {
  for (const id of ids) find(elements, id);
  const doomed = new Set(ids);
  for (const el of elements) {
    if ('containerId' in el && el.containerId && doomed.has(el.containerId)) doomed.add(el.id);
    if (el.type === 'arrow') {
      const ends = [el.startBinding?.elementId, el.endBinding?.elementId];
      if (ends.some((id) => id && doomed.has(id))) doomed.add(el.id);
    }
  }
  const next = elements.map((el) =>
    doomed.has(el.id) ? newElementWith(el, { isDeleted: true }) : el,
  );
  return { elements: next, data: { ids } };
}

// Excalidraw's default 20px hand-drawn font runs about this wide per character and tall per line.
const NOTE_CHAR_WIDTH = 11;
const NOTE_LINE_HEIGHT = 25;

function isBoundText(el: ExcalidrawElement): boolean {
  return el.type === 'text' && el.containerId != null;
}

function placeNote(target: Box, body: string, obstacles: readonly Box[]): { x: number; y: number } {
  const lines = body.split('\n');
  const size = {
    width: Math.max(...lines.map((l) => l.length)) * NOTE_CHAR_WIDTH,
    height: lines.length * NOTE_LINE_HEIGHT,
  };
  const [x, y] = freeSpot(target, size, obstacles, NOTE_GAP);
  return { x, y };
}

function annotate(elements: Elements, id: string, text: string): OpOutcome {
  const target = find(elements, id);
  const obstacles = elements
    .filter((el) => !el.isDeleted && el.id !== id && el.type !== 'arrow' && !isBoundText(el))
    .map(boundsOf);
  const noteId = `note-${crypto.randomUUID().slice(0, 8)}`;
  const body = text.startsWith(NOTE_PREFIX) ? text : `${NOTE_PREFIX} ${text}`;
  const next = build(elements, [
    {
      type: 'text',
      id: noteId,
      ...placeNote(boundsOf(target), body, obstacles),
      text: body,
      strokeColor: AGENT_NOTE_COLOR,
      customData: agentMeta(undefined, 'note'),
    },
    {
      type: 'arrow',
      x: 0,
      y: 0,
      start: { id: noteId },
      end: { id },
      strokeColor: AGENT_NOTE_COLOR,
      strokeStyle: 'dashed',
      customData: agentMeta(undefined, 'note'),
    },
  ]);
  return { elements: next, data: { ids: [noteId] } };
}

async function exportPng(elements: Elements, files: BinaryFiles, ids?: string[]): Promise<string> {
  const wanted = ids?.length ? new Set(ids) : undefined;
  const chosen = elements.filter(
    (el) =>
      !el.isDeleted &&
      (!wanted ||
        wanted.has(el.id) ||
        ('containerId' in el && el.containerId && wanted.has(el.containerId))),
  );
  if (chosen.length === 0)
    throw new Error(wanted ? 'None of those ids are on the canvas.' : 'The canvas is empty.');
  const blob = await exportToBlob({
    elements: chosen,
    files,
    mimeType: 'image/png',
    exportPadding: 24,
    maxWidthOrHeight: 2000,
    appState: { exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Runs one agent op against the scene. Throws with a message the agent can act on. */
export async function applyOp(
  elements: Elements,
  files: BinaryFiles,
  op: CanvasOp,
): Promise<OpOutcome | { data: unknown }> {
  switch (op.kind) {
    case 'draw':
      return draw(elements, op.shapes);
    case 'update':
      return update(elements, op.patches);
    case 'delete':
      return remove(elements, op.ids);
    case 'annotate':
      return annotate(elements, op.id, op.text);
    case 'export':
      return { data: { png: await exportPng(elements, files, op.ids) } };
  }
}
