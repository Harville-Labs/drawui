<script lang="ts">
import { DEVICES } from '@drawui/core';
import { ToggleGroup } from '@sivir-ui/svelte';
import { previewFit } from '../preview-fit.ts';

let { url }: { url: string } = $props();
let frame: HTMLIFrameElement;
let paneWidth = $state(0);
let paneHeight = $state(0);
// 'full' fills the pane; a device name lays the page out at that device's width.
let size = $state('full');

const deviceWidth = $derived(DEVICES.find((d) => d.device === size)?.width);
const fit = $derived(previewFit({ width: paneWidth, height: paneHeight }, deviceWidth));
const sizes = DEVICES.filter((d) => d.device !== 'desktop');

function reload() {
  frame.src = url;
}
</script>

<section class="flex h-full min-w-0 flex-col border-l border-hair" aria-label="Preview">
  <div class="annotation flex items-center justify-between gap-2 border-b border-hair px-3 py-1 text-muted">
    <span class="truncate">{url}</span>
    <div class="flex shrink-0 items-center gap-2" role="group" aria-label="Preview width">
      <ToggleGroup.Root
        type="single"
        value={size}
        onValueChange={(next) => {
          if (typeof next === 'string') size = next;
        }}
      >
        {#each sizes as d (d.device)}
          <ToggleGroup.Item value={d.device} title="{d.label}, {d.width}px wide">{d.label}</ToggleGroup.Item>
        {/each}
        <ToggleGroup.Item value="full" title="The width of this pane">Full</ToggleGroup.Item>
      </ToggleGroup.Root>
      <button type="button" class="annotation text-accent hover:text-ink" onclick={reload}>Reload</button>
    </div>
  </div>
  <div
    class="relative min-h-0 flex-1 overflow-hidden"
    bind:clientWidth={paneWidth}
    bind:clientHeight={paneHeight}
  >
    <iframe
      bind:this={frame}
      src={url}
      title="Preview of {url}"
      class="absolute top-0 left-1/2 origin-top bg-white"
      style:width="{fit.width}px"
      style:height="{fit.height}px"
      style:transform="translateX(-50%) scale({fit.scale})"
    ></iframe>
  </div>
</section>
