"""Build Foundry scene JSON from the cleaned WWE 2018 map images.

Terrain labels are read from the supplied artwork and assigned to the nearest
BattleTech hex.  The resulting JSON remains reviewable and does not depend on
OCR at game runtime.
"""

from __future__ import annotations

import json
import math
import re
from collections import defaultdict
from pathlib import Path

import fitz
from rapidocr_onnxruntime import RapidOCR


SYSTEM_ID = "battletech-foundry-system"
ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(
    r"C:\Users\Indocus\Downloads"
    r"\E-CAT35MT010_BattleTech_MapPack_WWE2018_Terrain_Set.pdf"
)
MAP_DIRECTORY = ROOT / "assets" / "maps" / "wwe2018"
MAPS = (
    (2, "battletech", "BattleTech"),
    (3, "large-lakes", "Large Lakes"),
    (4, "scattered-woods", "Scattered Woods"),
    (5, "dig-site", "Dig Site"),
)
SCALE = 3
HEX_WIDTH = 107.46 * SCALE
HEX_HEIGHT = 93.13 * SCALE
REGION_STYLE = {
    "rough": ("Rough", "#8b6f47"),
    "lightWoods": ("Light Woods", "#6f9b45"),
    "heavyWoods": ("Heavy Woods", "#315f35"),
    "waterDepth1": ("Depth 1 Water", "#3f8fc4"),
    "waterDepth2": ("Depth 2 Water", "#24638f"),
    "building": ("Building", "#777777"),
    "paved": ("Paved", "#6f7175"),
    "elevation": ("Elevation", "#c7a74d"),
    "depression": ("Depression", "#8f5b35"),
}


def coordinate_words(page: fitz.Page) -> dict[str, tuple]:
    return {
        word[4]: word
        for word in page.get_text("words")
        if re.fullmatch(r"(?:0[1-9]|1[0-5])(?:0[1-9]|1[0-7])", word[4])
        and word[1] < page.rect.height - 24
    }


def hex_centers(page: fitz.Page) -> dict[str, tuple[float, float]]:
    result = {}
    for coordinate, word in coordinate_words(page).items():
        result[coordinate] = (
            ((word[0] + word[2]) / 2) * SCALE,
            (((word[1] + word[3]) / 2) + 25.3) * SCALE,
        )
    return result


def nearest_hex(point: tuple[float, float], centers: dict[str, tuple[float, float]]) -> str:
    px, py = point
    return min(
        centers,
        key=lambda coordinate: (
            ((centers[coordinate][0] - px) / HEX_WIDTH) ** 2
            + ((centers[coordinate][1] - py) / HEX_HEIGHT) ** 2
        ),
    )


def read_labels(image: Path, centers: dict[str, tuple[float, float]], engine: RapidOCR) -> dict[str, set[str]]:
    result, _ = engine(str(image))
    labels: dict[str, set[str]] = defaultdict(set)
    for box, text, confidence in result or []:
        if confidence < 0.72:
            continue
        normalized = re.sub(r"[^A-Z0-9]", "", text.upper())
        label = None
        if "HEAVY" in normalized:
            label = "heavyWoods"
        elif "LIGHT" in normalized:
            label = "lightWoods"
        elif "ROUGH" in normalized:
            label = "rough"
        elif "PAVED" in normalized:
            label = "paved"
        elif "BLDG" in normalized:
            label = "building"
        elif "DEPTH2" in normalized:
            label = "depth2"
        elif "DEPTH1" in normalized or normalized == "DEPTH":
            label = "depth1"
        elif "LEVEL2" in normalized:
            label = "level2"
        elif "LEVEL1" in normalized or normalized == "LEVEL":
            label = "level1"
        if not label:
            continue
        point = (
            sum(vertex[0] for vertex in box) / len(box),
            sum(vertex[1] for vertex in box) / len(box),
        )
        labels[nearest_hex(point, centers)].add(label)
    return labels


def hex_shape(center: tuple[float, float]) -> dict:
    cx, cy = center
    points = [
        cx - HEX_WIDTH / 2, cy,
        cx - HEX_WIDTH / 4, cy - HEX_HEIGHT / 2,
        cx + HEX_WIDTH / 4, cy - HEX_HEIGHT / 2,
        cx + HEX_WIDTH / 2, cy,
        cx + HEX_WIDTH / 4, cy + HEX_HEIGHT / 2,
        cx - HEX_WIDTH / 4, cy + HEX_HEIGHT / 2,
    ]
    return {
        "type": "polygon",
        "origin": {"x": 0, "y": 0},
        "points": [round(value, 2) for value in points],
        "hole": False,
    }


def level_for(labels: set[str], is_dig_site: bool) -> int:
    if "level2" in labels:
        return 2
    if "level1" in labels:
        return 1
    if is_dig_site and "depth2" in labels:
        return -2
    if is_dig_site and "depth1" in labels:
        return -1
    return 0


def terrain_for(labels: set[str], is_dig_site: bool) -> list[str]:
    terrain = []
    for key in ("rough", "lightWoods", "heavyWoods", "building", "paved"):
        if key in labels:
            terrain.append(key)
    if not is_dig_site:
        if "depth2" in labels:
            terrain.append("waterDepth2")
        elif "depth1" in labels:
            terrain.append("waterDepth1")
    elif "depth1" in labels or "depth2" in labels:
        terrain.append("depression")
    if "level1" in labels or "level2" in labels:
        terrain.append("elevation")
    return terrain


def region_sources(
    labels_by_hex: dict[str, set[str]],
    centers: dict[str, tuple[float, float]],
    is_dig_site: bool,
) -> list[dict]:
    grouped: dict[tuple[str, int], list[dict]] = defaultdict(list)
    for coordinate, labels in labels_by_hex.items():
        elevation = level_for(labels, is_dig_site)
        for terrain in terrain_for(labels, is_dig_site):
            grouped[(terrain, elevation)].append(hex_shape(centers[coordinate]))

    regions = []
    for (terrain, elevation), shapes in sorted(grouped.items()):
        label, color = REGION_STYLE[terrain]
        flags = {
            SYSTEM_ID: {
                "mapPack": "wwe2018",
                "terrain": terrain if terrain in {
                    "rough", "lightWoods", "heavyWoods", "waterDepth1", "waterDepth2"
                } else None,
                "elevation": elevation,
            }
        }
        regions.append(
            {
                "name": f"{label} (Level {elevation})",
                "color": color,
                "elevation": elevation,
                "locked": True,
                "visibility": 0,
                "shapes": shapes,
                "flags": flags,
            }
        )
    return regions


def boundary_walls(
    labels_by_hex: dict[str, set[str]],
    centers: dict[str, tuple[float, float]],
    is_dig_site: bool,
) -> list[dict]:
    edge_uses: dict[tuple, list[tuple[int, bool]]] = defaultdict(list)
    for coordinate, labels in labels_by_hex.items():
        level = level_for(labels, is_dig_site)
        building = "building" in labels
        if not level and not building:
            continue
        points = hex_shape(centers[coordinate])["points"]
        vertices = list(zip(points[::2], points[1::2]))
        for index, start in enumerate(vertices):
            end = vertices[(index + 1) % len(vertices)]
            key = tuple(sorted((
                (round(start[0]), round(start[1])),
                (round(end[0]), round(end[1])),
            )))
            edge_uses[key].append((level, building))

    walls = []
    normal = 1
    for edge, uses in edge_uses.items():
        building_boundary = any(building for _, building in uses) and not all(
            building for _, building in uses
        )
        levels = {level for level, _ in uses}
        elevation_boundary = len(uses) == 1 or len(levels) > 1
        if not building_boundary and not elevation_boundary:
            continue
        walls.append(
            {
                "c": [*edge[0], *edge[1]],
                "move": normal if building_boundary else 0,
                "sight": normal,
                "light": normal,
                "sound": normal,
                "door": 0,
                "dir": 0,
                "flags": {
                    SYSTEM_ID: {
                        "mapPack": "wwe2018",
                        "building": building_boundary,
                        "elevationBoundary": elevation_boundary,
                    }
                },
            }
        )
    return walls


def main() -> None:
    document = fitz.open(SOURCE)
    engine = RapidOCR()
    for page_index, slug, title in MAPS:
        image = MAP_DIRECTORY / f"{slug}.webp"
        centers = hex_centers(document[page_index])
        labels = read_labels(image, centers, engine)
        is_dig_site = slug == "dig-site"
        regions = region_sources(labels, centers, is_dig_site)
        walls = boundary_walls(labels, centers, is_dig_site)
        terrain_hexes = {
            coordinate: sorted(values)
            for coordinate, values in sorted(labels.items())
        }
        scene = {
            "schemaVersion": 1,
            "pack": "WWE 2018 Terrain Set",
            "source": {
                "title": "BattleTech: MapPacks Worldwide Event 2018",
                "copyright": "© 2018 The Topps Company, Inc. All Rights Reserved.",
                "providedByUser": True,
                "pdfPage": page_index + 1,
            },
            "scene": {
                "name": f"WWE 2018 - {title}",
                "width": 4014,
                "height": 4878,
                "padding": 0,
                "shiftX": 151,
                "shiftY": 36,
                "grid": {
                    "type": 4,
                    "size": round(HEX_WIDTH, 2),
                    "distance": 1,
                    "units": "hex",
                    "alpha": 0,
                    "color": "#000000",
                    "thickness": 1,
                },
                "backgroundColor": "#7d7628",
                "initialLevel": "ground0000000001",
                "levels": [
                    {
                        "_id": "ground0000000001",
                        "name": "Ground",
                        "elevation": {"bottom": -5, "top": 20},
                        "background": {
                            "src": f"systems/{SYSTEM_ID}/assets/maps/wwe2018/{slug}.webp",
                            "tint": "#ffffff",
                        },
                    }
                ],
                "tokenVision": True,
                "fog": {
                    "mode": 1,
                    "reset": None,
                    "colors": {"explored": None, "unexplored": None},
                },
                "environment": {
                    "darknessLevel": 0,
                    "globalLight": {"enabled": False},
                },
                "navigation": True,
                "flags": {
                    SYSTEM_ID: {
                        "mapPack": "wwe2018",
                        "mapSlug": slug,
                        "terrainHexes": terrain_hexes,
                    }
                },
            },
            "regions": regions,
            "walls": walls,
            "summary": {
                "recognizedTerrainHexes": len(labels),
                "regions": len(regions),
                "regionShapes": sum(len(region["shapes"]) for region in regions),
                "walls": len(walls),
            },
        }
        (MAP_DIRECTORY / f"{slug}.scene.json").write_text(
            json.dumps(scene, indent=2) + "\n", encoding="utf-8"
        )
        print(slug, json.dumps(scene["summary"]))
    document.close()


if __name__ == "__main__":
    main()
