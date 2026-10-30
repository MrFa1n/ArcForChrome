"""Package headless-Chrome captures for the README (development only: Pillow)."""
from pathlib import Path
import shutil
import sys
from PIL import Image

source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp')
output = Path(__file__).resolve().parent.parent / 'docs' / 'assets'
output.mkdir(parents=True, exist_ok=True)
frames = []
for number in range(1, 5):
    with Image.open(source / f'arc-spotlight-demo-{number:02}.png') as capture:
        frames.append(capture.convert('RGB'))
frames[0].save(output / 'spotlight-demo.gif', save_all=True,
               append_images=frames[1:], duration=[2200, 2800, 2800, 2800],
               loop=0, optimize=True)
shutil.copyfile(source / 'arc-spotlight-demo-02.png', output / 'spotlight-light.png')
shutil.copyfile(source / 'arc-spotlight-demo-dark.png', output / 'spotlight-dark.png')
print(f'Wrote demo and light/dark captures to {output}')
