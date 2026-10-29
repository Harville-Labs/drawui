<script lang="ts">
import { DEVICES, type Device } from '@drawui/core';
import { Button, Input, Popover } from '@sivir-ui/svelte';

type Props = {
  /** The screen of the selected frame, offered so the user can draw it at another size. */
  selected: () => string | undefined;
  oncreate: (screen: string, device: Device) => void;
};

let { selected, oncreate }: Props = $props();
let open = $state(false);
let name = $state('');
let error = $state<string>();

function opened(next: boolean) {
  open = next;
  if (!next) return;
  name = selected() ?? '';
  error = undefined;
}

function create(device: Device) {
  if (!name.trim()) {
    error = 'Name the screen, like Login or Settings.';
    return;
  }
  oncreate(name.trim(), device);
  open = false;
}
</script>

<Popover.Root {open} onOpenChange={opened} placement="bottom-start">
  <Popover.Trigger variant="outline">New screen</Popover.Trigger>
  <Popover.Content class="w-72" surfaceClass="flex flex-col gap-3 p-3">
    <Popover.Title>New screen</Popover.Title>
    <Input
      label="Screen"
      bind:value={name}
      placeholder="e.g. Login"
      description={error ?? 'Draw one screen at several sizes to show how it adapts.'}
      aria-invalid={error ? 'true' : undefined}
      autocomplete="off"
    />
    <div class="grid grid-cols-3 gap-2">
      {#each DEVICES as size (size.device)}
        <Button variant="outline" class="h-auto flex-col gap-1 py-2" onclick={() => create(size.device)}>
          <span>{size.label}</span>
          <span class="annotation text-muted">{size.width}×{size.height}</span>
        </Button>
      {/each}
    </div>
  </Popover.Content>
</Popover.Root>
