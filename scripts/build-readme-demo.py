"""Package headless-Chrome captures for the README (development only: Pillow)."""

from pathlib import Path
import shutil
import sys
from PIL import Image

source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp")
locale = sys.argv[2] if len(sys.argv) > 2 else "en"
if locale not in {"en", "ru"}:
    raise SystemExit("Locale must be 'en' or 'ru'")
source_suffix = "-ru" if locale == "ru" else ""
asset_suffix = ".ru" if locale == "ru" else ""
output = Path(__file__).resolve().parent.parent / "docs" / "assets"
output.mkdir(parents=True, exist_ok=True)
frames = []
for number in range(1, 5):
    with Image.open(
        source / f"arc-spotlight-demo-{number:02}{source_suffix}.png"
    ) as capture:
        frames.append(capture.convert("RGB"))
frames[0].save(
    output / f"spotlight-demo{asset_suffix}.gif",
    save_all=True,
    append_images=frames[1:],
    duration=[2200, 2800, 2800, 2800],
    loop=0,
    optimize=True,
)
shutil.copyfile(
    source / f"arc-spotlight-demo-02{source_suffix}.png",
    output / f"spotlight-light{asset_suffix}.png",
)
shutil.copyfile(
    source / f"arc-spotlight-demo-dark{source_suffix}.png",
    output / f"spotlight-dark{asset_suffix}.png",
)
if (source / f"arc-spotlight-activity{source_suffix}.png").exists():
    shutil.copyfile(
        source / f"arc-spotlight-activity{source_suffix}.png",
        output / f"spotlight-activity{asset_suffix}.png",
    )
print(f"Wrote {locale} demo and light/dark captures to {output}")

for name in (
    "selection",
    "groups",
    "bookmarks",
    "actions",
    "providers",
    "calculator",
    "quicklinks",
    "notes",
    "note-editor",
    "shortcuts",
):
    shutil.copyfile(
        source / f"arc-spotlight-{name}{source_suffix}.png",
        output / f"spotlight-{name}{asset_suffix}.png",
    )
