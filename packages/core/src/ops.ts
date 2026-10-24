import { z } from 'zod';
import { sourceRef } from './elements.ts';

// Excalidraw stores colors as CSS hex strings; the palette also uses "transparent".
const color = z
  .string()
  .regex(/^(#[0-9a-fA-F]{3,8}|transparent)$/, 'Use a hex color like #a5d8ff, or transparent.');
const coord = z.number().finite().min(-1e6).max(1e6);
const size = z.number().finite().positive().max(1e5);
const text = z.string().min(1).max(5000);
const elementId = z.string().min(1).max(100);

/** One thing the agent asks to draw. Coordinates are scene coordinates, as `get_canvas` reports them. */
export const shapeInput = z.discriminatedUnion('type', [
  z.object({
    type: z.enum(['rectangle', 'ellipse', 'diamond']),
    id: elementId.optional(),
    x: coord,
    y: coord,
    width: size,
    height: size,
    label: text.optional(),
    stroke: color.optional(),
    fill: color.optional(),
    dashed: z.boolean().optional(),
    source: sourceRef.optional(),
  }),
  z.object({
    type: z.literal('text'),
    id: elementId.optional(),
    x: coord,
    y: coord,
    text,
    stroke: color.optional(),
    source: sourceRef.optional(),
  }),
  z.object({
    type: z.literal('frame'),
    id: elementId.optional(),
    x: coord,
    y: coord,
    width: size,
    height: size,
    name: z.string().max(200).optional(),
    source: sourceRef.optional(),
  }),
  z.object({
    type: z.literal('arrow'),
    id: elementId.optional(),
    from: elementId,
    to: elementId,
    label: text.optional(),
    dashed: z.boolean().optional(),
  }),
]);
export type ShapeInput = z.infer<typeof shapeInput>;

/** A change to an existing element. Omitted fields stay as they are; `source: null` clears the link. */
export const elementPatch = z.object({
  id: elementId,
  x: coord.optional(),
  y: coord.optional(),
  width: size.optional(),
  height: size.optional(),
  label: z.string().max(5000).optional(),
  stroke: color.optional(),
  fill: color.optional(),
  dashed: z.boolean().optional(),
  source: sourceRef.nullable().optional(),
});
export type ElementPatch = z.infer<typeof elementPatch>;

export const MAX_SHAPES_PER_CALL = 200;

/** Work the server asks an open canvas to do, because only the canvas can lay out Excalidraw elements. */
export const canvasOp = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('draw'),
    shapes: z.array(shapeInput).min(1).max(MAX_SHAPES_PER_CALL),
  }),
  z.object({
    kind: z.literal('update'),
    patches: z.array(elementPatch).min(1).max(MAX_SHAPES_PER_CALL),
  }),
  z.object({ kind: z.literal('delete'), ids: z.array(elementId).min(1).max(MAX_SHAPES_PER_CALL) }),
  z.object({ kind: z.literal('annotate'), id: elementId, text }),
  z.object({ kind: z.literal('export'), ids: z.array(elementId).max(1000).optional() }),
]);
export type CanvasOp = z.infer<typeof canvasOp>;

/** What the canvas replies with, per op kind. */
export const drawResult = z.object({ ids: z.array(z.string()) });
export const exportResult = z.object({ png: z.string() });
