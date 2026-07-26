"""Combine the four WWE 2018 maps into one Foundry-ready 2x2 battlefield."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MAP_DIR = ROOT / "assets" / "maps" / "wwe2018"
SYSTEM_ID = "battletech-foundry-system"
MAPS = (
    ("battletech", "BattleTech", 0, 0),
    ("large-lakes", "Large Lakes", 3167, 0),
    ("scattered-woods", "Scattered Woods", 0, 3888),
    ("dig-site", "Dig Site", 3167, 3888),
)
SOURCE_WIDTH = 4014
SOURCE_HEIGHT = 4878
HEX_COLUMN_STEP = 241.785
HEX_ROW_STEP = 279.39
RAW_OFFSET_X = 16 * HEX_COLUMN_STEP
RAW_OFFSET_Y = 17 * HEX_ROW_STEP
RAW_HEIGHT = RAW_OFFSET_Y + SOURCE_HEIGHT
TARGET_HEIGHT = 7882
SCALE = TARGET_HEIGHT / RAW_HEIGHT
MAP_HEIGHT = round(SOURCE_HEIGHT * SCALE)
MAP_WIDTH = round(SOURCE_WIDTH * SCALE)
SOURCE_MARGIN_LEFT = 34
SOURCE_MARGIN_TOP = 34
SOURCE_MARGIN_RIGHT = 35
SOURCE_MARGIN_BOTTOM = 35
TRIM_LEFT = round(SOURCE_MARGIN_LEFT * SCALE)
TRIM_TOP = round(SOURCE_MARGIN_TOP * SCALE)
TRIM_RIGHT = round(SOURCE_MARGIN_RIGHT * SCALE)
TRIM_BOTTOM = round(SOURCE_MARGIN_BOTTOM * SCALE)
CANVAS_WIDTH = 3167 + MAP_WIDTH - TRIM_LEFT - TRIM_RIGHT
CANVAS_HEIGHT = 3888 + MAP_HEIGHT - TRIM_TOP - TRIM_BOTTOM
SLUG = "worldwide-event-2018-combined"


def translated_shape(shape: dict, offset_x: int, offset_y: int) -> dict:
    result = deepcopy(shape)
    origin = result.get("origin", {"x": 0, "y": 0})
    result["origin"] = {
        "x": round(origin.get("x", 0) * SCALE, 2),
        "y": round(origin.get("y", 0) * SCALE, 2),
    }
    points = result.get("points", [])
    result["points"] = [
        round(value * SCALE + (offset_x if index % 2 == 0 else offset_y), 2)
        for index, value in enumerate(points)
    ]
    for key in ("x", "width"):
        if key in result:
            result[key] = round(result[key] * SCALE + (offset_x if key == "x" else 0), 2)
    for key in ("y", "height"):
        if key in result:
            result[key] = round(result[key] * SCALE + (offset_y if key == "y" else 0), 2)
    return result


def translated_wall(wall: dict, offset_x: int, offset_y: int, map_slug: str) -> dict:
    result = deepcopy(wall)
    result["c"] = [
        round(value * SCALE + (offset_x if index % 2 == 0 else offset_y), 2)
        for index, value in enumerate(result["c"])
    ]
    result.setdefault("flags", {}).setdefault(SYSTEM_ID, {})["sourceMap"] = map_slug
    return result


def main() -> None:
    canvas = Image.new("RGB", (CANVAS_WIDTH, CANVAS_HEIGHT), "#8e822d")
    regions = []
    walls = []
    terrain_hexes = {}
    source_summaries = {}

    for map_slug, map_name, offset_x, offset_y in MAPS:
        source_image = Image.open(MAP_DIR / f"{map_slug}.webp").convert("RGB")
        resized = source_image.resize((MAP_WIDTH, MAP_HEIGHT), Image.Resampling.LANCZOS)
        content = resized.crop(
            (TRIM_LEFT, TRIM_TOP, MAP_WIDTH - TRIM_RIGHT, MAP_HEIGHT - TRIM_BOTTOM)
        )
        canvas.paste(content, (offset_x, offset_y))

        definition = json.loads(
            (MAP_DIR / f"{map_slug}.scene.json").read_text(encoding="utf-8")
        )
        geometry_offset_x = offset_x - TRIM_LEFT
        geometry_offset_y = offset_y - TRIM_TOP
        for region in definition["regions"]:
            translated = deepcopy(region)
            translated["name"] = f"{map_name} · {region['name']}"
            translated["shapes"] = [
                translated_shape(shape, geometry_offset_x, geometry_offset_y)
                for shape in region["shapes"]
            ]
            translated.setdefault("flags", {}).setdefault(SYSTEM_ID, {})[
                "sourceMap"
            ] = map_slug
            regions.append(translated)
        walls.extend(
            translated_wall(wall, geometry_offset_x, geometry_offset_y, map_slug)
            for wall in definition["walls"]
        )
        terrain_hexes[map_slug] = definition["scene"]["flags"][SYSTEM_ID][
            "terrainHexes"
        ]
        source_summaries[map_slug] = definition["summary"]

    image_path = MAP_DIR / f"{SLUG}.webp"
    canvas.save(image_path, "WEBP", quality=92, method=6)

    scene = {
        "schemaVersion": 1,
        "pack": "WWE 2018 Terrain Set",
        "source": {
            "title": "BattleTech: MapPacks Worldwide Event 2018",
            "copyright": "© 2018 The Topps Company, Inc. All Rights Reserved.",
            "providedByUser": True,
            "layout": [
                ["BattleTech", "Large Lakes"],
                ["Scattered Woods", "Dig Site"],
            ],
            "layoutMethod": "Partial edge hexes overlap on whole grid intervals.",
        },
        "scene": {
            "name": "WWE 2018 - Combined Terrain Set",
            "width": CANVAS_WIDTH,
            "height": CANVAS_HEIGHT,
            "padding": 0,
            "shiftX": round(151 * SCALE, 2) - TRIM_LEFT,
            "shiftY": round(36 * SCALE, 2) - TRIM_TOP,
            "grid": {
                "type": 4,
                "size": round(322.38 * SCALE, 2),
                "distance": 1,
                "units": "hex",
                "alpha": 0,
                "color": "#000000",
                "thickness": 1,
            },
            "backgroundColor": "#8e822d",
            "initialLevel": "ground0000000001",
            "levels": [
                {
                    "_id": "ground0000000001",
                    "name": "Ground",
                    "elevation": {"bottom": -5, "top": 20},
                    "background": {
                        "src": f"systems/{SYSTEM_ID}/assets/maps/wwe2018/{SLUG}.webp",
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
                    "mapSlug": SLUG,
                    "combinedMap": True,
                    "layoutRevision": 2,
                    "terrainHexesByMap": terrain_hexes,
                }
            },
        },
        "regions": regions,
        "walls": walls,
        "summary": {
            "sourceMaps": source_summaries,
            "regions": len(regions),
            "regionShapes": sum(len(region["shapes"]) for region in regions),
            "walls": len(walls),
            "width": CANVAS_WIDTH,
            "height": CANVAS_HEIGHT,
        },
    }
    (MAP_DIR / f"{SLUG}.scene.json").write_text(
        json.dumps(scene, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(scene["summary"], indent=2))


if __name__ == "__main__":
    main()
