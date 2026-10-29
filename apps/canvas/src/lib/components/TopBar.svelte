<script lang="ts">
import type { Device, ProjectConfig, ProjectPatch } from '@drawui/core';
import { Badge, Button } from '@sivir-ui/svelte';
import type { Status } from '../connection.svelte.ts';
import LibraryPicker from './LibraryPicker.svelte';
import PreviewPicker from './PreviewPicker.svelte';
import ScreenMenu from './ScreenMenu.svelte';

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
  selectedScreen: () => string | undefined;
  onnewscreen: (screen: string, device: Device) => void;
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
  selectedScreen,
  onnewscreen,
}: Props = $props();

const statusText: Record<Status, string> = {
  connecting: 'Connecting',
  open: 'Connected',
  closed: 'Server stopped',
};
const statusVariant = { connecting: 'warning', open: 'success', closed: 'error' } as const;
</script>

<header class="flex flex-wrap items-center gap-3 border-b border-hair bg-paper-light px-4 py-2">
  <div class="flex items-baseline gap-2 self-center">
    <span class="font-display text-lg font-bold tracking-tight">drawui</span>
    <Badge variant={statusVariant[status]} dot>{statusText[status]}</Badge>
  </div>

  <LibraryPicker library={project.library} docs={project.docs} onchange={onproject} />
  <PreviewPicker
    preview={project.preview}
    shown={previewShown}
    onchange={onproject}
    ontoggle={ontogglepreview}
  />

  <ScreenMenu selected={selectedScreen} oncreate={onnewscreen} />
  <Button variant="outline" onclick={onmarknote} title="Turn the selected text into notes for the agent">
    Mark as note
  </Button>

  <p class="annotation ml-auto self-center text-muted" aria-live="polite">{activity || message}</p>
</header>
