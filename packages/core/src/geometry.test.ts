import { describe, expect, test } from 'bun:test';
import { arrowBetween } from './geometry.ts';

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
