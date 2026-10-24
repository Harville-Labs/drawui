<script lang="ts">
// Excalidraw is a React component, so it runs as a React island inside the Svelte app (ADR 0001).
import '$lib/asset-path.ts';
import { Excalidraw, THEME } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { onMount } from 'svelte';

type Props = {
  onready: (api: ExcalidrawImperativeAPI) => void;
  onchange: (elements: readonly ExcalidrawElement[], appState: AppState) => void;
};

let { onready, onchange }: Props = $props();
let host: HTMLDivElement;

onMount(() => {
  const root = createRoot(host);
  root.render(
    createElement(Excalidraw, {
      theme: THEME.DARK,
      name: 'drawui',
      autoFocus: true,
      // drawui saves the drawing itself, and nothing leaves the machine.
      aiEnabled: false,
      UIOptions: {
        canvasActions: {
          loadScene: false,
          saveToActiveFile: false,
          export: false,
          toggleTheme: null,
        },
      },
      excalidrawAPI: (api) => onready(api),
      onChange: (elements, appState) => onchange(elements, appState),
    }),
  );
  return () => root.unmount();
});
</script>

<div bind:this={host} class="h-full w-full"></div>
