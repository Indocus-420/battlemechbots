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

function pointKey(x, y) {
  return `${x.toFixed(4)},${y.toFixed(4)}`;
}

/** Return the stepped outside edge of a flat-top hex cluster. */
export function hexClusterBoundary(hexWidth = 100, hexHeight = 100, hexRadius = 2) {
  const width = Math.max(1, Number(hexWidth) || 100);
  const height = Math.max(1, Number(hexHeight) || width);
  const range = Math.max(0, Math.floor(Number(hexRadius) || 0));
  const edges = new Map();
  const vertices = [
    [width / 2, 0], [width / 4, height / 2], [-width / 4, height / 2],
    [-width / 2, 0], [-width / 4, -height / 2], [width / 4, -height / 2]
  ];

  for (let q = -range; q <= range; q += 1) {
    const rMin = Math.max(-range, -q - range);
    const rMax = Math.min(range, -q + range);
    for (let r = rMin; r <= rMax; r += 1) {
      const cx = width * 0.75 * q;
      const cy = height * (r + q / 2);
      const corners = vertices.map(([x, y]) => [cx + x, cy + y]);
      for (let index = 0; index < corners.length; index += 1) {
        const a = corners[index];
        const b = corners[(index + 1) % corners.length];
        const aKey = pointKey(...a);
        const bKey = pointKey(...b);
        const key = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
        if (edges.has(key)) edges.delete(key);
        else edges.set(key, { a, b, aKey, bKey });
      }
    }
  }

  const adjacency = new Map();
  for (const edge of edges.values()) {
    if (!adjacency.has(edge.aKey)) adjacency.set(edge.aKey, []);
    if (!adjacency.has(edge.bKey)) adjacency.set(edge.bKey, []);
    adjacency.get(edge.aKey).push({ key: edge.bKey, point: edge.b });
    adjacency.get(edge.bKey).push({ key: edge.aKey, point: edge.a });
  }
  const startKey = [...adjacency.keys()].sort((a, b) => {
    const [ax, ay] = a.split(",").map(Number);
    const [bx, by] = b.split(",").map(Number);
    return ay - by || ax - bx;
  })[0];
  if (!startKey) return [];

  const points = [];
  let previous = null;
  let current = startKey;
  do {
    const [x, y] = current.split(",").map(Number);
    points.push(x, y);
    const next = adjacency.get(current)?.find(candidate => candidate.key !== previous);
    previous = current;
    current = next?.key;
  } while (current && current !== startKey && points.length <= edges.size * 2);
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
  const Container = globalThis.PIXI?.Container;
  if (!Graphics || !Container || !token || !["mech", "vehicle"].includes(token.actor?.type)) return null;
  const gridSize = Number(globalThis.canvas?.grid?.size) || 100;
  const outer = radius ?? gridSize * 3;
  const inner = Math.max(Number(token.w) || gridSize, Number(token.h) || gridSize) * 0.58;
  const width = Number(token.w) || gridSize;
  const height = Number(token.h) || gridSize;
  const boundary = hexClusterBoundary(width, height, 2);
  const overlay = new Container();
  const graphic = new Graphics();
  const mask = new Graphics();
  const outline = new Graphics();
  overlay.eventMode = "none";
  overlay.position?.set?.(width / 2, height / 2);
  overlay.rotation = (Number(token.document?.rotation) || 0) * Math.PI / 180;
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
  if (typeof mask.poly === "function") {
    mask.poly(boundary).fill({ color: 0xffffff });
    outline.poly(boundary).stroke({ color: 0xf2f2f2, alpha: 0.62, width: 3 });
  } else {
    mask.beginFill?.(0xffffff, 1);
    mask.drawPolygon?.(boundary);
    mask.endFill?.();
    outline.lineStyle?.(3, 0xf2f2f2, 0.62);
    outline.drawPolygon?.(boundary);
  }
  overlay.addChild(mask, graphic, outline);
  graphic.mask = mask;
  token.addChild?.(overlay);
  token.bmfsFiringArcOverlay = overlay;
  return overlay;
}
