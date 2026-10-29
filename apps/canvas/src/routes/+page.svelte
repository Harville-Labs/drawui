<script lang="ts">
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { onDestroy } from 'svelte';
import { Bridge } from '$lib/bridge.ts';
import Canvas from '$lib/components/Canvas.svelte';
import Preview from '$lib/components/Preview.svelte';
import TopBar from '$lib/components/TopBar.svelte';
import { Connection } from '$lib/connection.svelte.ts';

let bridge: Bridge | undefined;
let message = $state('');
// Hiding the preview keeps its URL, so showing it again needs no retyping.
let previewHidden = $state(false);

const connection = new Connection({
  load: (scene) => bridge?.load(scene),
  scene: (scene) => bridge?.merge(scene),
  request: async (op) => {
    if (!bridge) throw new Error('The canvas is still starting. Try again in a moment.');
    return bridge.run(op);
  },
});

const previewShown = $derived(Boolean(connection.project.preview) && !previewHidden);

// The connection starts once Excalidraw is ready, so the saved drawing has somewhere to go.
function ready(api: ExcalidrawImperativeAPI) {
  if (bridge) return;
  bridge = new Bridge(api, {
    scene: (scene) => connection.sendScene(scene),
    selection: (ids) => connection.sendSelection(ids),
  });
  connection.start();
}

function markNote() {
  const count = bridge?.markSelectedAsNotes() ?? 0;
  message = count
    ? `Marked ${count} as ${count === 1 ? 'a note' : 'notes'}`
    : 'Select some text first';
}

onDestroy(() => {
  connection.stop();
  bridge?.dispose();
});
</script>

<svelte:head><title>drawui</title></svelte:head>

<div class="flex h-full flex-col">
  <TopBar
    status={connection.status}
    project={connection.project}
    activity={connection.activity}
    {message}
    {previewShown}
    onproject={(patch) => connection.setProject(patch)}
    onmarknote={markNote}
    ontogglepreview={() => (previewHidden = !previewHidden)}
  />
  <!-- The canvas keeps the larger share: below about 730px Excalidraw switches to its phone layout. -->
  <main class="grid min-h-0 flex-1 {previewShown ? 'grid-cols-[3fr_2fr]' : 'grid-cols-1'}">
    <Canvas onready={ready} onchange={(elements, appState) => bridge?.changed(elements, appState)} />
    {#if previewShown && connection.project.preview}
      <Preview url={connection.project.preview} />
    {/if}
  </main>
</div>
