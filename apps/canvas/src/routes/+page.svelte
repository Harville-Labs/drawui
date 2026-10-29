<script lang="ts">
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { Toaster, toast } from '@sivir-ui/svelte';
import { Pane, type PaneAPI, PaneGroup, PaneResizer } from 'paneforge';
import { onDestroy } from 'svelte';
import { activityToasts } from '$lib/activity-toast.ts';
import { Bridge } from '$lib/bridge.ts';
import Canvas from '$lib/components/Canvas.svelte';
import Preview from '$lib/components/Preview.svelte';
import TopBar from '$lib/components/TopBar.svelte';
import { Connection } from '$lib/connection.svelte.ts';

let bridge: Bridge | undefined;
let canvasPane = $state<PaneAPI>();
let previewPane = $state<PaneAPI>();
// Collapsing the preview keeps its URL and its page, so showing it again needs no reload.
let previewCollapsed = $state(false);
// Expanding the preview collapses the drawing.
let previewExpanded = $state(false);
let dragging = $state(false);

const connection = new Connection({
  load: (scene) => bridge?.load(scene),
  scene: (scene) => bridge?.merge(scene),
  request: async (op) => {
    if (!bridge) throw new Error('The canvas is still starting. Try again in a moment.');
    return bridge.run(op);
  },
  activity: activityToasts(toast),
});

const previewShown = $derived(Boolean(connection.project.preview) && !previewCollapsed);

function togglePreview() {
  if (previewCollapsed) previewPane?.expand();
  else collapsePreview();
}

function collapsePreview() {
  // The drawing comes back first, or there would be nothing left to fill the window.
  if (previewExpanded) canvasPane?.expand();
  previewPane?.collapse();
}

function toggleExpanded() {
  if (previewExpanded) canvasPane?.expand();
  else canvasPane?.collapse();
}

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
  if (count) toast.success(`Marked ${count} as ${count === 1 ? 'a note' : 'notes'}`);
  else toast.warning('Select some text first', { description: 'Notes are text the agent reads.' });
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
    {previewShown}
    onproject={(patch) => connection.setProject(patch)}
    onmarknote={markNote}
    selectedScreen={() => bridge?.selectedScreen()}
    onnewscreen={(screen, device) => bridge?.addScreen(screen, device)}
    ontogglepreview={togglePreview}
  />
  <!-- Below about 730px Excalidraw switches to its phone layout, so the drawing starts with the larger share. -->
  <PaneGroup direction="horizontal" autoSaveId="drawui-workspace" class="min-h-0 flex-1">
    <Pane
      bind:this={canvasPane}
      order={1}
      defaultSize={60}
      minSize={30}
      collapsible
      collapsedSize={0}
      onCollapse={() => (previewExpanded = true)}
      onExpand={() => (previewExpanded = false)}
    >
      <Canvas onready={ready} onchange={(elements, appState) => bridge?.changed(elements, appState)} />
    </Pane>
    {#if connection.project.preview}
      <PaneResizer
        class="relative z-10 w-px bg-hair transition-colors after:absolute after:inset-y-0 after:-inset-x-1.5 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none data-active:bg-accent"
        onDraggingChange={(next) => (dragging = next)}
      />
      <Pane
        bind:this={previewPane}
        order={2}
        defaultSize={40}
        minSize={20}
        collapsible
        collapsedSize={0}
        onCollapse={() => (previewCollapsed = true)}
        onExpand={() => (previewCollapsed = false)}
      >
        <Preview
          url={connection.project.preview}
          expanded={previewExpanded}
          {dragging}
          onexpand={toggleExpanded}
          oncollapse={collapsePreview}
        />
      </Pane>
    {/if}
  </PaneGroup>
</div>

<Toaster />
