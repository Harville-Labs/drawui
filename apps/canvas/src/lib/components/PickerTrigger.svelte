<script lang="ts">
import { Popover } from '@sivir-ui/svelte';

type Props = {
  caption: string;
  value?: string;
  /** Shown when nothing is set. */
  empty: string;
};

let { caption, value, empty }: Props = $props();
</script>

<Popover.Trigger variant="outline" class="h-auto gap-3 py-1.5 text-left">
  <span class="flex flex-col">
    <span class="annotation text-muted">{caption}</span>
    <span class={value ? '' : 'text-muted'}>{value || empty}</span>
  </span>
  <span aria-hidden="true" class="text-muted">▾</span>
</Popover.Trigger>
