<script lang="ts">
import { type ProjectPatch, projectPatch, SUGGESTED_LIBRARIES } from '@drawui/core';
import { Button, Input, Popover } from '@sivir-ui/svelte';
import PickerTrigger from './PickerTrigger.svelte';

type Props = {
  library?: string;
  /** The docs link of a custom library; suggested libraries have none. */
  docs?: string;
  onchange: (patch: ProjectPatch) => void;
};

let { library, docs, onchange }: Props = $props();
let open = $state(false);
let name = $state('');
let link = $state('');
let error = $state<string>();

function opened(next: boolean) {
  open = next;
  if (!next) return;
  // Start the custom form from the current custom library, if that's what's chosen.
  name = docs ? (library ?? '') : '';
  link = docs ?? '';
  error = undefined;
}

function pick(choice: string) {
  onchange({ library: choice, docs: '' });
  open = false;
}

function useCustom(event: SubmitEvent) {
  event.preventDefault();
  if (!name.trim()) {
    error = 'Give the library a name.';
    return;
  }
  const parsed = projectPatch.safeParse({ library: name, docs: link.trim() });
  if (!parsed.success) {
    error = parsed.error.issues[0]?.message;
    return;
  }
  onchange(parsed.data);
  open = false;
}

const host = (url: string) => new URL(url).host;
</script>

<Popover.Root {open} onOpenChange={opened} placement="bottom-start">
  <PickerTrigger caption="Library" value={library} empty="Choose one" />
  <Popover.Content class="w-80" surfaceClass="flex flex-col gap-3 p-3">
    <Popover.Title>Component library</Popover.Title>
    <ul class="flex flex-col gap-1">
      {#each SUGGESTED_LIBRARIES as lib (lib.name)}
        {@const chosen = lib.name === library && !docs}
        <li>
          <Button
            variant={chosen ? 'panel' : 'quiet'}
            class="h-auto w-full justify-between py-2"
            aria-pressed={chosen}
            onclick={() => pick(lib.name)}
          >
            <span class="flex flex-col items-start gap-1">
              <span>{lib.name}</span>
              <span class="annotation text-muted">{lib.framework} · {host(lib.docs)}</span>
            </span>
            {#if chosen}<span aria-hidden="true">✓</span>{/if}
          </Button>
        </li>
      {/each}
    </ul>
    <form class="flex flex-col gap-2 border-t border-hair pt-3" onsubmit={useCustom}>
      <p class="text-sm text-muted">
        Or use any library: the agent reads its docs from the link.
      </p>
      <Input label="Name" bind:value={name} placeholder="e.g. Acme UI" autocomplete="off" />
      <Input
        label="Docs link"
        bind:value={link}
        placeholder="https://"
        description={error}
        aria-invalid={error ? 'true' : undefined}
        autocomplete="off"
        spellcheck="false"
      />
      <Button type="submit" variant="outline">Use this library</Button>
    </form>
  </Popover.Content>
</Popover.Root>
