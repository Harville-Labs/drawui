import { rename, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { mergeScenes } from './merge.ts';

/** A file the store reads once and rewrites on every change. Injected so tests stay off the disk. */
export interface TextFile {
  readonly path: string;
  read(): Promise<string | undefined>;
  write(text: string): Promise<void>;
}

export function diskFile(path: string): TextFile {
  return {
    path,
    async read() {
      const file = Bun.file(path);
      return (await file.exists()) ? file.text() : undefined;
    },
    // Write a sibling and rename it over the original, so a crash mid-write never truncates the drawing.
    async write(text) {
      const tmp = `${path}.tmp`;
      await writeFile(tmp, text);
      await rename(tmp, path);
    },
  };
}

// The .excalidraw file format, so the drawing also opens in Excalidraw itself.
const sceneFile = z.looseObject({
  type: z.literal('excalidraw'),
  elements: z.array(z.unknown()),
  files: z.record(z.string(), z.unknown()).optional(),
});

export type SceneSnapshot = {
  readonly elements: readonly unknown[];
  readonly files: Readonly<Record<string, unknown>>;
  readonly selection: readonly string[];
  /** Goes up by one each time the elements or files change. */
  readonly version: number;
};

/** Holds the current drawing, saves it to the scene file, and wakes callers waiting for edits. */
export class SceneStore {
  #state: SceneSnapshot;
  #serialized: string;
  #waiters = new Set<() => void>();
  #saving: Promise<void> | undefined;
  #dirty = false;

  private constructor(
    private readonly file: TextFile,
    elements: unknown[],
    files: Record<string, unknown>,
  ) {
    this.#state = { elements, files, selection: [], version: 0 };
    this.#serialized = serialize(elements, files);
  }

  static async open(file: TextFile): Promise<SceneStore> {
    const text = await file.read();
    if (text === undefined) return new SceneStore(file, [], {});
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (cause) {
      throw new Error(
        `${file.path} is not valid JSON. Fix it or move it aside to start a blank drawing.`,
        {
          cause,
        },
      );
    }
    const parsed = sceneFile.safeParse(json);
    if (!parsed.success) {
      throw new Error(
        `${file.path} is not an Excalidraw scene (expected "type": "excalidraw" and an "elements" array).`,
      );
    }
    return new SceneStore(file, parsed.data.elements, parsed.data.files ?? {});
  }

  get snapshot(): SceneSnapshot {
    return this.#state;
  }

  /**
   * Merges a tab's drawing into the held one, keeping the newer copy of each element. `changed` is
   * false, and nothing is saved, when the result is identical to what was held. `senderBehind` says
   * the tab lacks part of the result and should be sent the snapshot.
   */
  mergeScene(
    incoming: unknown[],
    incomingFiles: Record<string, unknown>,
  ): { changed: boolean; senderBehind: boolean } {
    const { elements, files, senderBehind } = mergeScenes(this.#state, {
      elements: incoming,
      files: incomingFiles,
    });
    const serialized = serialize(elements, files);
    if (serialized === this.#serialized) {
      // Same drawing, but a deletion only lives in memory, so keep the merged elements.
      this.#state = { ...this.#state, elements };
      return { changed: false, senderBehind };
    }
    this.#serialized = serialized;
    this.#state = { ...this.#state, elements, files, version: this.#state.version + 1 };
    this.#save();
    for (const wake of this.#waiters) wake();
    return { changed: true, senderBehind };
  }

  setSelection(ids: string[]): void {
    this.#state = { ...this.#state, selection: ids };
  }

  /**
   * Resolves true once the version passes `since`, or false when the timeout or signal ends the wait first.
   * A `since` ahead of the current version came from before a server restart, which restarts the count, so
   * the caller's copy is stale and this resolves true at once.
   */
  waitForChange(since: number, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
    if (this.#state.version !== since) return Promise.resolve(true);
    return new Promise((resolve) => {
      const done = (changed: boolean) => {
        clearTimeout(timer);
        this.#waiters.delete(wake);
        signal?.removeEventListener('abort', abort);
        resolve(changed);
      };
      const wake = () => {
        if (this.#state.version !== since) done(true);
      };
      const abort = () => done(false);
      const timer = setTimeout(() => done(false), timeoutMs);
      this.#waiters.add(wake);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }

  /** Resolves once everything changed so far is on disk. */
  async flush(): Promise<void> {
    while (this.#saving) await this.#saving;
  }

  // One write at a time; changes that land mid-write are written again right after.
  #save(): void {
    this.#dirty = true;
    if (this.#saving) return;
    this.#saving = (async () => {
      while (this.#dirty) {
        this.#dirty = false;
        await this.file.write(this.#serialized);
      }
    })().finally(() => {
      this.#saving = undefined;
    });
  }
}

// Deleted elements stay in memory so open tabs can reconcile the deletion, but the file keeps only
// what's drawn, so it diffs cleanly in git.
function serialize(elements: readonly unknown[], files: Readonly<Record<string, unknown>>): string {
  const drawn = elements.filter(
    (el) => !(el && typeof el === 'object' && 'isDeleted' in el && el.isDeleted === true),
  );
  return `${JSON.stringify({ type: 'excalidraw', version: 2, source: 'drawui', elements: drawn, appState: {}, files }, null, 2)}\n`;
}
