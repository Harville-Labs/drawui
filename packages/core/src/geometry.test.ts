import { describe, expect, test } from 'bun:test';
import { arrowBetween, freeSpot, gapBetween } from './geometry.ts';

describe('arrowBetween', () => {
  test('runs from the right edge of one box to the left edge of a box beside it', () => {
    const arrow = arrowBetween(
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 200, y: 0, width: 100, height: 40 },
    );
    expect(arrow).toEqual({
      x: 100,
      y: 20,
      points: [
        [0, 0],
        [100, 0],
      ],
    });
  });

  test('runs from the bottom edge to the top edge of a box below', () => {
    const arrow = arrowBetween(
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 0, y: 100, width: 100, height: 40 },
    );
    expect(arrow).toEqual({
      x: 50,
      y: 40,
      points: [
        [0, 0],
        [0, 60],
      ],
    });
  });

  test('leaves a gap between each end and its box', () => {
    const arrow = arrowBetween(
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 200, y: 0, width: 100, height: 40 },
      [8, 8],
    );
    expect(arrow).toEqual({
      x: 108,
      y: 20,
      points: [
        [0, 0],
        [84, 0],
      ],
    });
  });

  test('stops short only at the end that asks for a gap', () => {
    const arrow = arrowBetween(
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 200, y: 0, width: 100, height: 40 },
      [8, 0],
    );
    expect(arrow).toEqual({
      x: 108,
      y: 20,
      points: [
        [0, 0],
        [92, 0],
      ],
    });
  });

  test('a diagonal arrow leaves through the side it crosses first', () => {
    const arrow = arrowBetween(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 300, y: 200, width: 100, height: 100 },
    );
    expect(arrow.x).toBe(100);
    expect(arrow.y).toBeCloseTo(83.33, 2);
  });
});

describe('freeSpot', () => {
  const size = { width: 100, height: 20 };
  const target = { x: 0, y: 0, width: 100, height: 40 };

  test('goes right of the target when nothing is there', () => {
    expect(freeSpot(target, size, [], 48)).toEqual([148, 0]);
  });

  test('moves past a shape that sits where the note would go', () => {
    const neighbor = { x: 140, y: 0, width: 100, height: 40 };
    const [x, y] = freeSpot(target, size, [neighbor], 48);
    expect(gapBetween({ x, y, ...size }, neighbor)).toBeGreaterThanOrEqual(24);
  });

  test('leaves a screen around the target instead of covering its contents', () => {
    const screen = { x: -20, y: -20, width: 400, height: 600 };
    const [x, y] = freeSpot(target, size, [screen], 48);
    expect(gapBetween({ x, y, ...size }, screen)).toBeGreaterThanOrEqual(24);
  });

  test('picks the closer side when right is blocked further than below', () => {
    const wall = { x: 120, y: -500, width: 2000, height: 1000 };
    expect(freeSpot(target, size, [wall], 48)).toEqual([-148, 0]);
  });
});
