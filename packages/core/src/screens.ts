import type { Box, Point } from './geometry.ts';

export type Device = 'phone' | 'tablet' | 'desktop';

/** Frame sizes for a new screen on each device, and the widths the preview switches between. */
export const DEVICES: readonly { device: Device; label: string; width: number; height: number }[] =
  [
    { device: 'phone', label: 'Phone', width: 390, height: 844 },
    { device: 'tablet', label: 'Tablet', width: 834, height: 1194 },
    { device: 'desktop', label: 'Desktop', width: 1440, height: 900 },
  ];

/** Widest a frame can be and still be read as a phone or tablet screen when its name doesn't say. */
const PHONE_MAX_WIDTH = 480;
const TABLET_MAX_WIDTH = 1024;

const SUFFIX = /\s*\((mobile|phone|tablet|desktop)\)\s*$/i;

/**
 * The screen a frame draws and the device it draws it for. A name ending in `(mobile)`, `(phone)`,
 * `(tablet)`, or `(desktop)` says the device, and the rest of the name is the screen, so
 * `Login (mobile)` and `Login (desktop)` are one screen at two sizes. Otherwise the width decides.
 */
export function screenOf(
  name: string | undefined,
  width: number,
): { screen?: string; device: Device } {
  const match = name?.match(SUFFIX);
  if (name && match?.[1]) {
    const word = match[1].toLowerCase();
    const screen = name.slice(0, match.index).trim();
    return {
      ...(screen ? { screen } : {}),
      device: word === 'mobile' ? 'phone' : (word as Device),
    };
  }
  const device =
    width <= PHONE_MAX_WIDTH ? 'phone' : width <= TABLET_MAX_WIDTH ? 'tablet' : 'desktop';
  return { ...(name?.trim() ? { screen: name.trim() } : {}), device };
}

/** The frame name for a screen drawn for a device, the inverse of `screenOf`. */
export function screenName(screen: string, device: Device): string {
  return `${screen.trim()} (${device === 'phone' ? 'mobile' : device})`;
}

/** Space between a new screen and what is already drawn. */
const SCREEN_GAP = 160;

/**
 * Where a new screen goes: right of everything already drawn, level with its top, so the sizes of one
 * screen line up side by side. An empty canvas starts at the origin.
 */
export function nextScreenSpot(drawn: readonly Box[]): Point {
  if (drawn.length === 0) return [0, 0];
  const right = Math.max(...drawn.map((b) => b.x + b.width));
  const top = Math.min(...drawn.map((b) => b.y));
  return [right + SCREEN_GAP, top];
}
