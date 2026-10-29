/**
 * How a preview drawn at a device width fits a pane. The page lays out at the device's width, as it
 * would on the device, and is scaled down when the pane is narrower. Without a width the page fills
 * the pane.
 */
export function previewFit(
  pane: { width: number; height: number },
  deviceWidth: number | undefined,
): { width: number; height: number; scale: number } {
  if (!deviceWidth || pane.width <= 0) return { ...pane, scale: 1 };
  const scale = Math.min(1, pane.width / deviceWidth);
  return { width: deviceWidth, height: pane.height / scale, scale };
}
