/** Snap a TokenDocument position update to the center of one whole hex. */
export function snapTokenChangeToHexCenter(document, change, grid) {
  if (!document || !change || (change.x === undefined && change.y === undefined)) return null;
  if (!grid?.getOffset || !grid?.getCenterPoint) return null;
  const gridSize = Number(grid.size) || 100;
  const renderedWidth = Number(document.object?.w) || (Number(document.width) || 1) * gridSize;
  const renderedHeight = Number(document.object?.h) || (Number(document.height) || 1) * gridSize;
  const requestedCenter = {
    x: Number(change.x ?? document.x) + renderedWidth / 2,
    y: Number(change.y ?? document.y) + renderedHeight / 2
  };
  const snappedCenter = grid.getCenterPoint(grid.getOffset(requestedCenter));
  if (!Number.isFinite(snappedCenter?.x) || !Number.isFinite(snappedCenter?.y)) return null;
  return {
    x: snappedCenter.x - renderedWidth / 2,
    y: snappedCenter.y - renderedHeight / 2
  };
}
