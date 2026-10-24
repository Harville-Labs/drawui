import { z } from 'zod';

/** Where the code for a drawn element lives, recorded by the agent after it writes that code. */
export const sourceRef = z.object({
  file: z.string().min(1).max(500),
  line: z.number().int().positive().optional(),
  component: z.string().min(1).max(200).optional(),
});
export type SourceRef = z.infer<typeof sourceRef>;

/** What drawui stores in an element's `customData.drawui`. */
export const drawuiMeta = z.object({
  kind: z.enum(['note']).optional(),
  author: z.enum(['user', 'agent']).optional(),
  source: sourceRef.optional(),
});
export type DrawuiMeta = z.infer<typeof drawuiMeta>;

const binding = z.looseObject({ elementId: z.string() }).nullable().optional();

/**
 * The fields of an Excalidraw element that drawui reads. Elements keep every other field
 * untouched, because the canvas and the scene file own the full Excalidraw shape.
 */
export const element = z.looseObject({
  id: z.string(),
  type: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  isDeleted: z.boolean().default(false),
  strokeColor: z.string().default('#1e1e1e'),
  backgroundColor: z.string().default('transparent'),
  strokeStyle: z.string().default('solid'),
  frameId: z.string().nullable().default(null),
  containerId: z.string().nullable().default(null),
  text: z.string().optional(),
  name: z.string().nullable().optional(),
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
  startBinding: binding,
  endBinding: binding,
  link: z.string().nullable().optional(),
  // A malformed drawui block shouldn't hide the element, so it falls back to none.
  customData: z
    .looseObject({ drawui: drawuiMeta.optional().catch(undefined) })
    .nullable()
    .optional(),
});
export type Element = z.infer<typeof element>;

/** Parses raw scene elements, dropping any that aren't shaped like Excalidraw elements. */
export function parseElements(raw: readonly unknown[]): Element[] {
  const out: Element[] = [];
  for (const item of raw) {
    const parsed = element.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export function metaOf(el: Element): DrawuiMeta {
  return el.customData?.drawui ?? {};
}

export const DEFAULT_STROKE = '#1e1e1e';
export const NOTE_COLOR = '#f08c00';
export const AGENT_NOTE_COLOR = '#9c36b5';

/** Text starting with `//` is a note to the agent, like a code comment. */
export const NOTE_PREFIX = '//';

export function isNote(el: Element): boolean {
  if (el.type !== 'text') return false;
  return metaOf(el).kind === 'note' || (el.text ?? '').trimStart().startsWith(NOTE_PREFIX);
}

export function noteText(el: Element): string {
  const text = (el.text ?? '').trim();
  return text.startsWith(NOTE_PREFIX) ? text.slice(NOTE_PREFIX.length).trim() : text;
}
