import { describe, expect, test } from 'bun:test';
import { previewFit } from './preview-fit.ts';

describe('previewFit', () => {
  test('without a device width the page fills the pane', () => {
    expect(previewFit({ width: 600, height: 800 }, undefined)).toEqual({
      width: 600,
      height: 800,
      scale: 1,
    });
  });

  test('a device narrower than the pane shows at its own width, unscaled', () => {
    expect(previewFit({ width: 600, height: 800 }, 390)).toEqual({
      width: 390,
      height: 800,
      scale: 1,
    });
  });

  test('a device wider than the pane lays out at its width and scales down to fit', () => {
    expect(previewFit({ width: 417, height: 800 }, 834)).toEqual({
      width: 834,
      height: 1600,
      scale: 0.5,
    });
  });
});
