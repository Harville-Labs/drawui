<script lang="ts">
import { type ProjectPatch, projectPatch } from '@drawui/core';
import { Button, Input, Popover, Switch } from '@sivir-ui/svelte';
import PickerTrigger from './PickerTrigger.svelte';

type Props = {
  preview?: string;
  /** Whether the preview pane is shown, when there is a preview URL. */
  shown: boolean;
  onchange: (patch: ProjectPatch) => void;
  ontoggle: () => void;
};

let { preview, shown, onchange, ontoggle }: Props = $props();
let open = $state(false);
let url = $state('');
let error = $state<string>();

function opened(next: boolean) {
  open = next;
  if (!next) return;
  url = preview ?? '';
  error = undefined;
}

function save(event: SubmitEvent) {
  event.preventDefault();
  const parsed = projectPatch.safeParse({ preview: url.trim() });
  if (!parsed.success) {
    error = parsed.error.issues[0]?.message;
    return;
  }
  onchange(parsed.data);
  open = false;
}

function clear() {
  onchange({ preview: '' });
  open = false;
}

const label = $derived(preview ? new URL(preview).host + (shown ? '' : ' (hidden)') : undefined);
</script>

<Popover.Root {open} onOpenChange={opened} placement="bottom-start">
  <PickerTrigger caption="Preview" value={label} empty="Off" />
  <Popover.Content class="w-80" surfaceClass="flex flex-col gap-3 p-3">
    <Popover.Title>Live preview</Popover.Title>
    <form class="flex flex-col gap-2" onsubmit={save}>
      <Input
        label="Dev server URL"
        bind:value={url}
        placeholder="http://localhost:5173"
        description={error ?? 'Shown beside the drawing so you can see the agent build it.'}
        aria-invalid={error ? 'true' : undefined}
        autocomplete="off"
        spellcheck="false"
      />
      <div class="flex gap-2">
        <Button type="submit" variant="outline" class="flex-1">Save</Button>
        {#if preview}<Button variant="quiet" onclick={clear}>Turn off</Button>{/if}
      </div>
    </form>
    {#if preview}
      <div class="border-t border-hair pt-3">
        <Switch label="Show beside the drawing" checked={shown} onclick={ontoggle} />
      </div>
    {/if}
  </Popover.Content>
</Popover.Root>
