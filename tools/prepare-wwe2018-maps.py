"""Extract the four WWE 2018 maps and remove their hex-coordinate overlays.

The supplied PDF stores the map art and coordinate labels separately.  Removing
the label text at the PDF layer preserves the original terrain, grid, and
copyright notice without generative reconstruction.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import fitz
from PIL import Image


SOURCE = Path(
    r"C:\Users\Indocus\Downloads"
    r"\E-CAT35MT010_BattleTech_MapPack_WWE2018_Terrain_Set.pdf"
)
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "maps" / "wwe2018"
TEMP = ROOT / "tmp" / "pdfs" / "wwe2018"
MAPS = (
    (2, "battletech", "BattleTech"),
    (3, "large-lakes", "Large Lakes"),
    (4, "scattered-woods", "Scattered Woods"),
    (5, "dig-site", "Dig Site"),
)


def is_coordinate(word: tuple, page_height: float) -> bool:
    text = word[4]
    return bool(re.fullmatch(r"(?:0[1-9]|1[0-5])(?:0[1-9]|1[0-7])", text)) and word[1] < page_height - 24


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    TEMP.mkdir(parents=True, exist_ok=True)
    source = fitz.open(SOURCE)
    report = []

    for page_index, slug, title in MAPS:
        page = source[page_index]
        coordinate_words = [
            word for word in page.get_text("words") if is_coordinate(word, page.rect.height)
        ]
        if len(coordinate_words) != 255:
            raise RuntimeError(
                f"{title}: expected 255 coordinate labels, found {len(coordinate_words)}"
            )

        single = fitz.open()
        clean_page = single.new_page(width=page.rect.width, height=page.rect.height)
        clean_page.show_pdf_page(clean_page.rect, source, page_index)
        clean_words = clean_page.get_text("words")
        clean_coordinates = [
            word
            for word in clean_words
            if is_coordinate(word, clean_page.rect.height)
        ]
        for word in clean_coordinates:
            rect = fitz.Rect(word[:4])
            rect.x0 -= 0.35
            rect.y0 -= 0.2
            rect.x1 += 0.35
            rect.y1 += 0.2
            clean_page.add_redact_annot(rect, fill=False, cross_out=False)
        clean_page.apply_redactions(images=0, graphics=0)

        pdf_path = TEMP / f"{slug}-clean.pdf"
        single.save(pdf_path, garbage=4, deflate=True)
        pixmap = clean_page.get_pixmap(matrix=fitz.Matrix(3, 3), alpha=False)
        image_path = OUTPUT / f"{slug}.webp"
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        image.save(image_path, "WEBP", quality=92, method=6)
        single.close()

        remaining = [
            word
            for word in fitz.open(pdf_path)[0].get_text("words")
            if is_coordinate(word, page.rect.height)
        ]
        report.append(
            {
                "name": title,
                "slug": slug,
                "sourcePage": page_index + 1,
                "removedCoordinateLabels": len(coordinate_words),
                "remainingCoordinateLabels": len(remaining),
                "image": image_path.relative_to(ROOT).as_posix(),
                "width": pixmap.width,
                "height": pixmap.height,
            }
        )

    (OUTPUT / "extraction-report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    source.close()


if __name__ == "__main__":
    main()
