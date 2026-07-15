from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT.parent.parent / "outputs" / "battletech-foundry-system-0.10.6-alpha.0.zip"
FILES = ["ASSET_SOURCES.md", "README.md", "ROADMAP.md", "system.json"]
DIRECTORIES = ["assets", "lang", "module", "scripts", "styles", "templates"]

with ZipFile(OUTPUT, "w", ZIP_DEFLATED, compresslevel=9) as archive:
    for name in FILES:
        archive.write(ROOT / name, name)
    for directory in DIRECTORIES:
        for source in sorted((ROOT / directory).rglob("*")):
            if source.is_file():
                archive.write(source, source.relative_to(ROOT).as_posix())

print(OUTPUT)
