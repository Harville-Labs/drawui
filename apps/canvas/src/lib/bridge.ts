import './asset-path.ts';
import { type CanvasOp, NOTE_COLOR, NOTE_PREFIX } from '@drawui/core';
import {
  CaptureUpdateAction,
  getSceneVersion,
  newElementWith,
  reconcileElements,
  restoreElements,
} from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import type { SceneData } from './connection.svelte.ts';
import { applyOp } from './ops.ts';

// Drawing fires onChange on every pointer move; the server needs the result, not every frame.
const SYNC_DELAY_MS = 150;

export type BridgeOutput = {
  scene(scene: SceneData): void;
  selection(ids: string[]): void;
};

type RemoteElements = Parameters<typeof reconcileElements>[1];

/**
 * Connects one Excalidraw instance to the server: sends the user's edits, applies other tabs' edits,
 * and runs agent ops. The scene version guards against sending back what was just applied.
 */
export class Bridge {
  private sentVersion = -1;
  private selection = '';
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly api: ExcalidrawImperativeAPI,
    private readonly out: BridgeOutput,
  ) {}

  /** Wire this to Excalidraw's onChange. */
  changed(elements: readonly ExcalidrawElement[], appState: AppState): void {
    const selected = Object.keys(appState.selectedElementIds).filter(
      (id) => appState.selectedElementIds[id],
    );
    const key = selected.sort().join(',');
    if (key !== this.selection) {
      this.selection = key;
      this.out.selection(selected);
    }
    if (getSceneVersion(elements) === this.sentVersion) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), SYNC_DELAY_MS);
  }

  /** Sends the scene now, including deleted elements so other tabs see the deletion. */
  flush(): void {
    clearTimeout(this.timer);
    const elements = this.api.getSceneElementsIncludingDeleted();
    this.sentVersion = getSceneVersion(elements);
    this.out.scene({ elements, files: this.api.getFiles() });
  }

  /** Replaces the drawing with the saved one. */
  load(scene: SceneData): void {
    const elements = restoreElements(scene.elements as ExcalidrawElement[], null, {
      repairBindings: true,
    });
    this.addFiles(scene.files);
    this.api.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER });
    this.sentVersion = getSceneVersion(this.api.getSceneElementsIncludingDeleted());
    if (elements.some((el) => !el.isDeleted))
      this.api.scrollToContent(undefined, { fitToContent: true });
  }

  /** Merges another tab's drawing into this one, keeping whichever copy of each element is newer. */
  merge(scene: SceneData): void {
    const remote = restoreElements(scene.elements as ExcalidrawElement[], null);
    const merged = reconcileElements(
      this.api.getSceneElementsIncludingDeleted(),
      remote as unknown as RemoteElements,
      this.api.getAppState(),
    );
    this.addFiles(scene.files);
    this.api.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER });
    this.sentVersion = getSceneVersion(this.api.getSceneElementsIncludingDeleted());
  }

  /** Runs an agent op. Its changes go on the undo stack, so the user can take them back. */
  async run(op: CanvasOp): Promise<unknown> {
    const outcome = await applyOp(
      this.api.getSceneElementsIncludingDeleted(),
      this.api.getFiles(),
      op,
    );
    if ('elements' in outcome) {
      this.api.updateScene({
        elements: outcome.elements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      // The server must hold the new scene before the agent hears back, so a get_canvas right after
      // sees its own change.
      this.flush();
    }
    return outcome.data;
  }

  /** Turns the selected text into notes for the agent. Returns how many changed. */
  markSelectedAsNotes(): number {
    const { selectedElementIds } = this.api.getAppState();
    let count = 0;
    const elements = this.api.getSceneElementsIncludingDeleted().map((el) => {
      if (!selectedElementIds[el.id] || el.type !== 'text' || el.isDeleted) return el;
      count++;
      const text = el.text.trimStart().startsWith(NOTE_PREFIX)
        ? el.text
        : `${NOTE_PREFIX} ${el.text}`;
      return newElementWith(el, {
        text,
        originalText: text,
        strokeColor: NOTE_COLOR,
        customData: {
          ...el.customData,
          drawui: { ...el.customData?.drawui, kind: 'note', author: 'user' },
        },
      });
    });
    if (count === 0) return 0;
    this.api.updateScene({
      elements: restoreElements(elements, null, { refreshDimensions: true }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    return count;
  }

  dispose(): void {
    clearTimeout(this.timer);
  }

  private addFiles(files: Record<string, unknown>): void {
    const have = this.api.getFiles();
    const fresh = Object.values(files as BinaryFiles).filter((file): file is BinaryFileData =>
      Boolean(file && typeof file === 'object' && 'id' in file && !have[file.id]),
    );
    if (fresh.length) this.api.addFiles(fresh);
  }
}
