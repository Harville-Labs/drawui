/** What to send for one Excalidraw onChange. */
export type SyncStep = {
  /** `now` sends the scene before the selection; `later` debounces it. */
  scene: 'now' | 'later' | 'none';
  /** The new selection, when it changed. */
  selection?: string[];
};

/**
 * Decides when a tab sends its scene and selection. Drawing fires onChange on every pointer move,
 * so scene changes are debounced. A selection change is sent at once, and the scene goes first when
 * it changed too: drawing a shape selects it, and the server must hold the shape before the selection
 * names it, or the outline can't mark it selected until the next sync.
 */
export class SyncState {
  #sentVersion = -1;
  #selection = '';

  changed(sceneVersion: number, selected: readonly string[]): SyncStep {
    const key = [...selected].sort().join(',');
    const sceneChanged = sceneVersion !== this.#sentVersion;
    if (key === this.#selection) return { scene: sceneChanged ? 'later' : 'none' };
    this.#selection = key;
    return { scene: sceneChanged ? 'now' : 'none', selection: [...selected] };
  }

  /** Records the scene version the server now holds: sent from here, or just applied from it. */
  sent(sceneVersion: number): void {
    this.#sentVersion = sceneVersion;
  }
}
