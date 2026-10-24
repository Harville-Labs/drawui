<script lang="ts">
let { url }: { url: string } = $props();
let frame: HTMLIFrameElement;

function reload() {
  frame.src = url;
}
</script>

<section class="flex h-full flex-col border-l border-hair" aria-label="Preview">
  <div class="annotation flex items-center justify-between gap-2 border-b border-hair px-3 py-1 text-muted">
    <span class="truncate">{url}</span>
    <button type="button" class="annotation text-accent hover:text-ink" onclick={reload}>Reload</button>
  </div>
  <iframe bind:this={frame} src={url} title="Preview of {url}" class="min-h-0 flex-1 bg-white"></iframe>
</section>
