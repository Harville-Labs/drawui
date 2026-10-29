import { z } from 'zod';

// Only the fields the merge reads; everything else on an element passes through untouched.
const stamped = z.looseObject({
  id: z.string(),
  version: z.number().optional(),
  versionNonce: z.number().optional(),
  index: z.string().nullish(),
});
type Stamped = z.infer<typeof stamped>;

/** True when the incoming copy of an element should replace the one held. */
function newer(incoming: Stamped, held: Stamped): boolean {
  const a = incoming.version ?? 0;
  const b = held.version ?? 0;
  if (a !== b) return a > b;
  // Two tabs that edited the same element once each: pick one the same way Excalidraw's own
  // reconcile does, so every tab and the server agree. The same nonce is the same edit.
  if (incoming.versionNonce !== held.versionNonce) {
    return (incoming.versionNonce ?? 0) < (held.versionNonce ?? 0);
  }
  return true;
}

export type Merged = {
  elements: unknown[];
  files: Record<string, unknown>;
  /** The sender lacks something the result has, so it needs the merged scene back. */
  senderBehind: boolean;
};

/**
 * Merges a tab's scene into the one held, element by element, keeping the newer copy of each.
 * Tabs send their whole scene, so without this a tab that hadn't yet seen another tab's edit
 * would overwrite it. Elements keep Excalidraw's fractional `index` order when they all have one.
 */
export function mergeScenes(
  held: { elements: readonly unknown[]; files: Readonly<Record<string, unknown>> },
  incoming: { elements: readonly unknown[]; files: Readonly<Record<string, unknown>> },
): Merged {
  const heldById = new Map<string, { raw: unknown; el: Stamped }>();
  for (const raw of held.elements) {
    const parsed = stamped.safeParse(raw);
    if (parsed.success) heldById.set(parsed.data.id, { raw, el: parsed.data });
  }
  let senderBehind = false;
  const seen = new Set<string>();
  const out: { raw: unknown; index?: string | null }[] = [];
  for (const raw of incoming.elements) {
    const parsed = stamped.safeParse(raw);
    // An element without an id can't be matched; keep it as sent, as the old whole-scene save did.
    if (!parsed.success) {
      out.push({ raw });
      continue;
    }
    const el = parsed.data;
    seen.add(el.id);
    const current = heldById.get(el.id);
    if (current && !newer(el, current.el)) {
      if (current.raw !== raw) senderBehind = true;
      out.push({ raw: current.raw, index: current.el.index });
    } else {
      out.push({ raw, index: el.index });
    }
  }
  for (const [id, current] of heldById) {
    if (seen.has(id)) continue;
    senderBehind = true;
    out.push({ raw: current.raw, index: current.el.index });
  }
  if (out.every((e) => typeof e.index === 'string')) {
    // Fractional indices compare as plain strings, not by locale.
    out.sort((a, b) =>
      (a.index as string) < (b.index as string) ? -1 : a.index === b.index ? 0 : 1,
    );
  }
  const files = { ...held.files, ...incoming.files };
  if (Object.keys(held.files).some((id) => !(id in incoming.files))) senderBehind = true;
  return { elements: out.map((e) => e.raw), files, senderBehind };
}
