import { describe, expect, test } from 'bun:test';
import { nextScreenSpot, screenName, screenOf } from './screens.ts';

describe('screenOf', () => {
  test('a (mobile) suffix names a phone screen and is dropped from the screen name', () => {
    expect(screenOf('Login (mobile)', 1440)).toEqual({ screen: 'Login', device: 'phone' });
  });

  test('tablet, desktop, and phone suffixes work in any case', () => {
    expect(screenOf('Home (Tablet)', 300).device).toBe('tablet');
    expect(screenOf('Home (DESKTOP)', 300).device).toBe('desktop');
    expect(screenOf('Home (phone)', 2000).device).toBe('phone');
  });

  test('without a suffix the width decides', () => {
    expect(screenOf('Login', 390)).toEqual({ screen: 'Login', device: 'phone' });
    expect(screenOf('Login', 834).device).toBe('tablet');
    expect(screenOf('Login', 1440).device).toBe('desktop');
  });

  test('an unnamed frame still has a device', () => {
    expect(screenOf(undefined, 390)).toEqual({ device: 'phone' });
  });

  test('a suffix inside the name is part of the name', () => {
    expect(screenOf('Mobile (mobile) settings', 1440)).toEqual({
      screen: 'Mobile (mobile) settings',
      device: 'desktop',
    });
  });
});

test('screenName round-trips through screenOf', () => {
  for (const device of ['phone', 'tablet', 'desktop'] as const) {
    expect(screenOf(screenName('Checkout', device), 0)).toEqual({ screen: 'Checkout', device });
  }
});

describe('nextScreenSpot', () => {
  test('an empty canvas puts the first screen at the origin', () => {
    expect(nextScreenSpot([])).toEqual([0, 0]);
  });

  test('a new screen goes right of everything drawn, level with the top', () => {
    const drawn = [
      { x: 0, y: 100, width: 390, height: 844 },
      { x: 500, y: -40, width: 200, height: 50 },
    ];
    expect(nextScreenSpot(drawn)).toEqual([860, -40]);
  });
});
