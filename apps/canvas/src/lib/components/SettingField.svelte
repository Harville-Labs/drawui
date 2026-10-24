<script lang="ts">
import { Input } from '@sivir-ui/svelte';

type Props = {
  label: string;
  value: string;
  placeholder?: string;
  list?: string;
  class?: string;
  /** Returns a message when the value can't be saved. */
  validate?: (value: string) => string | undefined;
  oncommit: (value: string) => void;
};

let { label, value, placeholder, list, class: className, validate, oncommit }: Props = $props();
let error = $state<string>();

// Saves on Enter or when focus leaves, not on every keystroke, so a half-typed URL isn't sent.
function commit(event: Event) {
  const next = (event.currentTarget as HTMLInputElement).value.trim();
  error = validate?.(next);
  if (!error && next !== value) oncommit(next);
}
</script>

<!-- Sivir's Input puts `class` on the input and fills its parent, so the width goes on a wrapper. -->
<div class={className}>
  <Input
    {label}
    {value}
    {placeholder}
    {list}
    description={error}
    aria-invalid={error ? 'true' : undefined}
    autocomplete="off"
    spellcheck="false"
    onchange={commit}
  />
</div>
