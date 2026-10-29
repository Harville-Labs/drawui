import type { UiArrow, UiNode, UiTree } from './interpret.ts';

/**
 * Renders the tree as an indented outline, one element per line. Agents read this far more cheaply
 * than JSON, and every line carries the id they need to update or link the element.
 *
 *   screen "Login" [f1] 0,0 400x600 column
 *     rectangle "Sign in" [r2] 20,40 360x48 fill=#a5d8ff
 *       // primary action, disabled until the form is valid
 */
export function outline(tree: UiTree, selected: ReadonlySet<string> = new Set()): string {
  if (tree.roots.length === 0 && tree.arrows.length === 0) return '(empty canvas)';
  const lines: string[] = [];
  const names = new Map<string, string>();
  const index = (nodes: readonly UiNode[]) => {
    for (const n of nodes) {
      names.set(n.id, n.label ? `"${short(n.label)}"` : `[${n.id}]`);
      index(n.children);
    }
  };
  index(tree.roots);
  const walk = (nodes: readonly UiNode[], depth: number) => {
    for (const node of nodes) {
      lines.push(`${'  '.repeat(depth)}${nodeLine(node, selected.has(node.id))}`);
      for (const note of node.notes) lines.push(`${'  '.repeat(depth + 1)}// ${note}`);
      walk(node.children, depth + 1);
    }
  };
  walk(tree.roots, 0);
  if (tree.arrows.length > 0) {
    lines.push('', 'arrows:');
    for (const arrow of tree.arrows) lines.push(`  ${arrowLine(arrow, names)}`);
  }
  return lines.join('\n');
}

function nodeLine(node: UiNode, selected: boolean): string {
  const head = node.shape ?? node.kind;
  const parts = [selected ? `* ${head}` : head];
  if (node.label && node.kind !== 'note') parts.push(JSON.stringify(node.label));
  if (node.kind === 'note' && node.label) parts.push(`// ${node.label}`);
  parts.push(`[${node.id}]`);
  const b = node.box;
  parts.push(`${b.x},${b.y} ${b.width}x${b.height}`);
  if (node.layout) parts.push(node.layout);
  if (node.fill) parts.push(`fill=${node.fill}`);
  if (node.stroke) parts.push(`stroke=${node.stroke}`);
  if (node.textColor) parts.push(`text-color=${node.textColor}`);
  if (node.dashed) parts.push('dashed');
  if (node.link) parts.push(`link=${node.link}`);
  if (node.source) {
    const s = node.source;
    parts.push(
      `source=${s.file}${s.line ? `:${s.line}` : ''}${s.component ? ` (${s.component})` : ''}`,
    );
  }
  if (node.byAgent) parts.push('by-agent');
  return parts.join(' ');
}

function arrowLine(arrow: UiArrow, names: ReadonlyMap<string, string>): string {
  const end = (id: string | null) => (id ? (names.get(id) ?? `[${id}]`) : '(nothing)');
  const parts = [`[${arrow.id}]`, end(arrow.from), '->', end(arrow.to)];
  if (arrow.label) parts.push(`: ${JSON.stringify(arrow.label)}`);
  if (arrow.dashed) parts.push('dashed');
  if (arrow.byAgent) parts.push('by-agent');
  return parts.join(' ');
}

function short(text: string): string {
  const line = text.split('\n')[0] ?? '';
  return line.length > 40 ? `${line.slice(0, 39)}…` : line;
}
