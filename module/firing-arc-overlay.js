const ARC_SECTORS = Object.freeze([
  Object.freeze({ id: "front", start: -60, end: 60, color: 0xf4dc42, alpha: 0.18 }),
  Object.freeze({ id: "right", start: 60, end: 150, color: 0x29aee8, alpha: 0.15 }),
  Object.freeze({ id: "rear", start: 150, end: 210, color: 0xe64b45, alpha: 0.18 }),
  Object.freeze({ id: "left", start: 210, end: 300, color: 0x29aee8, alpha: 0.15 })
]);

export function firingArcSectors(rotation = 0) {
  const facing = ((Number(rotation) % 360) + 360) % 360;
  return ARC_SECTORS.map(sector => ({ ...sector, start: sector.start + facing, end: sector.end + facing }));
}

function wedgePoints(start, end, inner, outer, steps = 12) {
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = ((start + ((end - start) * index / steps)) - 90) * Math.PI / 180;
    points.push(Math.cos(angle) * outer, Math.sin(angle) * outer);
  }
  for (let index = steps; index >= 0; index -= 1) {
    const angle = ((start + ((end - start) * index / steps)) - 90) * Math.PI / 180;
    points.push(Math.cos(angle) * inner, Math.sin(angle) * inner);
  }
  return points;
}

export function removeFiringArcOverlay(token) {
  const overlay = token?.bmfsFiringArcOverlay;
  if (!overlay) return;
  token.removeChild?.(overlay);
  overlay.destroy?.({ children: true });
  delete token.bmfsFiringArcOverlay;
}

export function renderFiringArcOverlay(token, { radius = null } = {}) {
  removeFiringArcOverlay(token);
  const Graphics = globalThis.PIXI?.Graphics;
  if (!Graphics || !token || !["mech", "vehicle"].includes(token.actor?.type)) return null;
  const gridSize = Number(globalThis.canvas?.grid?.size) || 100;
  const outer = radius ?? gridSize * 2.25;
  const inner = Math.max(Number(token.w) || gridSize, Number(token.h) || gridSize) * 0.58;
  const graphic = new Graphics();
  graphic.eventMode = "none";
  graphic.alpha = 1;
  graphic.position?.set?.((Number(token.w) || gridSize) / 2, (Number(token.h) || gridSize) / 2);
  graphic.rotation = (Number(token.document?.rotation) || 0) * Math.PI / 180;
  for (const sector of ARC_SECTORS) {
    const points = wedgePoints(sector.start, sector.end, inner, outer);
    if (typeof graphic.poly === "function") {
      graphic.poly(points).fill({ color: sector.color, alpha: sector.alpha }).stroke({ color: sector.color, alpha: 0.72, width: 2 });
    } else {
      graphic.beginFill?.(sector.color, sector.alpha);
      graphic.lineStyle?.(2, sector.color, 0.72);
      graphic.drawPolygon?.(points);
      graphic.endFill?.();
    }
  }
  token.addChild?.(graphic);
  token.bmfsFiringArcOverlay = graphic;
  return graphic;
}
