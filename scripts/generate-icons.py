"""Render the search mark. Development only: Python 3 + Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SIZES = (16, 32, 48, 128)
SCALE = 8
CANVAS = 128 * SCALE


def point(value):
    return round(value * SCALE)


def box(values):
    return tuple(point(value) for value in values)


def artwork():
    # A bounded saturated tile stays legible on both light and dark toolbars.
    image = Image.new('RGBA', (CANVAS, CANVAS))
    pixels = image.load()
    for y in range(CANVAS):
        for x in range(CANVAS):
            blend = (x + y) / (2 * (CANVAS - 1))
            start, end = (73, 109, 244), (133, 66, 219)
            pixels[x, y] = tuple(round(a + (b - a) * blend) for a, b in zip(start, end)) + (255,)
    mask = Image.new('L', image.size)
    ImageDraw.Draw(mask).rounded_rectangle(box((8, 8, 120, 120)), radius=point(28), fill=255)
    image.putalpha(mask)
    draw = ImageDraw.Draw(image)
    # Rounded handle, then lens: one bold silhouette without tiny interior detail.
    draw.line(box((72, 72, 94, 94)), fill='white', width=point(10))
    for x, y in ((72, 72), (94, 94)):
        draw.ellipse(box((x - 5, y - 5, x + 5, y + 5)), fill='white')
    draw.ellipse(box((30, 30, 78, 78)), outline='white', width=point(9))
    # The small mint glint distinguishes the mark from a generic search button.
    glint = ((90, 18), (93, 26), (101, 29), (93, 32), (90, 40), (87, 32), (79, 29), (87, 26))
    draw.polygon([(point(x), point(y)) for x, y in glint], fill=(179, 255, 224, 255))
    return image


if __name__ == '__main__':
    target = ROOT / 'extension' / 'icons'
    target.mkdir(parents=True, exist_ok=True)
    source = artwork()
    for size in SIZES:
        source.resize((size, size), Image.Resampling.LANCZOS).save(target / f'icon-{size}.png', optimize=True)
