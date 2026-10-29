import { expect, test } from 'bun:test';
import { activityToasts } from './activity-toast.ts';

function fakeToasts() {
  const shown: string[] = [];
  const dismissed: (number | undefined)[] = [];
  return {
    shown,
    dismissed,
    info: (title: string) => {
      shown.push(title);
      return { title, id: shown.length };
    },
    dismiss: (id?: number) => {
      dismissed.push(id);
    },
  };
}

test('each agent activity replaces the toast before it', () => {
  const toasts = fakeToasts();
  const show = activityToasts(toasts);
  show('Agent is drawing');
  expect(toasts.dismissed).toEqual([]);
  show('Agent is erasing');
  show('Agent left a note');
  expect(toasts.shown).toEqual(['Agent is drawing', 'Agent is erasing', 'Agent left a note']);
  expect(toasts.dismissed).toEqual([1, 2]);
});
