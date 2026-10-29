import type { toast as sivirToast } from '@sivir-ui/svelte';

type Toasts = Pick<typeof sivirToast, 'info' | 'dismiss'>;

// Long enough to read, short enough that a finished agent leaves nothing behind.
const ACTIVITY_MS = 4000;

/**
 * Shows what an agent is doing as a toast. Each message replaces the last, so a burst of edits
 * shows one toast instead of a stack.
 */
export function activityToasts(toasts: Toasts): (text: string) => void {
  let current: number | undefined;
  return (text) => {
    if (current !== undefined) toasts.dismiss(current);
    current = toasts.info(text, { duration: ACTIVITY_MS }).id;
  };
}
