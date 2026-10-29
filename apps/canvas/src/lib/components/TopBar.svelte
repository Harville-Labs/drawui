<script lang="ts">
import {
  type ProjectConfig,
  type ProjectPatch,
  projectPatch,
  SUGGESTED_LIBRARIES,
} from '@drawui/core';
import { Badge, Button } from '@sivir-ui/svelte';
import type { Status } from '../connection.svelte.ts';
import SettingField from './SettingField.svelte';

type Props = {
  status: Status;
  project: ProjectConfig;
  activity: string;
  message: string;
  /** Whether the preview pane is shown, when there is a preview URL. */
  previewShown: boolean;
  onproject: (patch: ProjectPatch) => void;
  onmarknote: () => void;
  ontogglepreview: () => void;
};

let {
  status,
  project,
  activity,
  message,
  previewShown,
  onproject,
  onmarknote,
  ontogglepreview,
}: Props = $props();

const statusText: Record<Status, string> = {
  connecting: 'Connecting',
  open: 'Connected',
  closed: 'Server stopped',
};
const statusVariant = { connecting: 'warning', open: 'success', closed: 'error' } as const;

function checkPreview(value: string) {
  const parsed = projectPatch.shape.preview.safeParse(value);
  return parsed.success ? undefined : parsed.error.issues[0]?.message;
}
</script>

<header class="flex flex-wrap items-end gap-3 border-b border-hair bg-paper-light px-4 py-2">
  <div class="flex items-baseline gap-2 self-center">
    <span class="font-display text-lg font-bold tracking-tight">drawui</span>
    <Badge variant={statusVariant[status]} dot>{statusText[status]}</Badge>
  </div>

  <SettingField
    label="Component library"
    value={project.library ?? ''}
    placeholder="e.g. shadcn/ui"
    list="drawui-libraries"
    class="w-48"
    oncommit={(library) => onproject({ library })}
  />
  <datalist id="drawui-libraries">
    {#each SUGGESTED_LIBRARIES as lib (lib.name)}
      <option value={lib.name}></option>
    {/each}
  </datalist>

  <SettingField
    label="Preview URL"
    value={project.preview ?? ''}
    placeholder="Your dev server URL"
    class="w-64"
    validate={checkPreview}
    oncommit={(preview) => onproject({ preview })}
  />

  <Button variant="outline" onclick={onmarknote} title="Turn the selected text into notes for the agent">
    Mark as note
  </Button>

  {#if project.preview}
    <Button variant="outline" onclick={ontogglepreview} aria-pressed={previewShown}>
      {previewShown ? 'Hide preview' : 'Show preview'}
    </Button>
  {/if}

  <p class="annotation ml-auto self-center text-muted" aria-live="polite">{activity || message}</p>
</header>
