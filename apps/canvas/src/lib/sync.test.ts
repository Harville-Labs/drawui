import { describe, expect, test } from 'bun:test';
import { SyncState } from './sync.ts';

describe('SyncState', () => {
  test('a scene change alone is debounced', () => {
    const sync = new SyncState();
    sync.sent(1);
    expect(sync.changed(2, [])).toEqual({ scene: 'later' });
  });

  test('a selection change alone is sent without the scene', () => {
    const sync = new SyncState();
    sync.sent(1);
    expect(sync.changed(1, ['a'])).toEqual({ scene: 'none', selection: ['a'] });
  });

  test('a new shape that is also selected sends the scene first', () => {
    const sync = new SyncState();
    sync.sent(1);
    expect(sync.changed(2, ['new'])).toEqual({ scene: 'now', selection: ['new'] });
  });

  test('the same selection in another order is not a change', () => {
    const sync = new SyncState();
    sync.sent(1);
    sync.changed(1, ['a', 'b']);
    expect(sync.changed(1, ['b', 'a'])).toEqual({ scene: 'none' });
  });

  test('nothing to send once the scene is sent and the selection unchanged', () => {
    const sync = new SyncState();
    sync.changed(1, ['a']);
    sync.sent(1);
    expect(sync.changed(1, ['a'])).toEqual({ scene: 'none' });
  });
});
