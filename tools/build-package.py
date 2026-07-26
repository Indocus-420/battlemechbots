from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import json

ROOT = Path(__file__).resolve().parent.parent
VERSION = json.loads((ROOT / "system.json").read_text(encoding="utf-8"))["version"]
OUTPUT = ROOT.parent.parent / "outputs" / f"battletech-foundry-system-{VERSION}.zip"
FILES = ["ASSET_SOURCES.md", "README.md", "ROADMAP.md", "system.json"]
DIRECTORIES = ["assets", "docs", "lang", "module", "scripts", "styles", "templates"]

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(OUTPUT, "w", ZIP_DEFLATED, compresslevel=9) as archive:
    for name in FILES:
        archive.write(ROOT / name, name)
    for directory in DIRECTORIES:
        for source in sorted((ROOT / directory).rglob("*")):
            if source.is_file():
                archive.write(source, source.relative_to(ROOT).as_posix())

print(OUTPUT)
