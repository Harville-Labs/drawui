import { z } from 'zod';
import { canvasOp } from './ops.ts';
import { projectConfig, projectPatch } from './project.ts';

/** The WebSocket path between the canvas and the server. */
export const WS_PATH = '/ws';

// Elements and files stay unknown here: they're Excalidraw's shape, stored and returned as-is,
// and parsed with `parseElements` where drawui reads them.
const scene = {
  elements: z.array(z.unknown()).max(50_000),
  files: z.record(z.string(), z.unknown()),
};

/** Messages from a canvas tab to the server. */
export const fromCanvas = z.discriminatedUnion('type', [
  z.object({ type: z.literal('scene'), ...scene }),
  z.object({ type: z.literal('selection'), ids: z.array(z.string()).max(50_000) }),
  z.object({ type: z.literal('project'), patch: projectPatch }),
  z.object({
    type: z.literal('reply'),
    requestId: z.string(),
    result: z.discriminatedUnion('ok', [
      z.object({ ok: z.literal(true), data: z.unknown() }),
      z.object({ ok: z.literal(false), error: z.string().max(2000) }),
    ]),
  }),
]);
export type FromCanvas = z.infer<typeof fromCanvas>;

/** Messages from the server to a canvas tab. */
export const toCanvas = z.discriminatedUnion('type', [
  z.object({ type: z.literal('load'), ...scene, project: projectConfig }),
  z.object({ type: z.literal('scene'), ...scene }),
  z.object({ type: z.literal('project'), project: projectConfig }),
  z.object({ type: z.literal('request'), requestId: z.string(), op: canvasOp }),
  z.object({ type: z.literal('activity'), text: z.string() }),
]);
export type ToCanvas = z.infer<typeof toCanvas>;

/** Reads a WebSocket message, returning undefined for anything that isn't valid JSON of the schema. */
export function decode<T>(schema: z.ZodType<T>, raw: string): T | undefined {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}
