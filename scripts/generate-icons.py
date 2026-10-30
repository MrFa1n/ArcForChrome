"""Render the original frosted-aperture mark. Development only: Python 3 + Pillow."""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SIZES = (16, 32, 48, 128)
SCALE = 8
CANVAS = 128 * SCALE


def point(value):
    return round(value * SCALE)


def box(values):
    return tuple(point(value) for value in values)


def squircle(bounds, exponent=4.5):
    left, top, right, bottom = bounds
    cx, cy = (left + right) / 2, (top + bottom) / 2
    rx, ry = (right - left) / 2, (bottom - top) / 2
    path = []
    for step in range(720):
        angle = step * math.tau / 720
        x, y = math.cos(angle), math.sin(angle)
        path.append((point(cx + rx * math.copysign(abs(x) ** (2 / exponent), x)),
                     point(cy + ry * math.copysign(abs(y) ** (2 / exponent), y))))
    return path


def artwork():
    tile = Image.new('RGBA', (CANVAS, CANVAS))
    tile_mask = Image.new('L', tile.size)
    ImageDraw.Draw(tile_mask).polygon(squircle((8, 8, 120, 120)), fill=255)
    pixels = tile.load()
    for y in range(CANVAS):
        for x in range(CANVAS):
            t = y / (CANVAS - 1)
            glow = math.exp(-(((x / SCALE - 34) / 58) ** 2 + ((y / SCALE - 22) / 50) ** 2))
            pixels[x, y] = (min(255, round(242 - 27 * t + 13 * glow)),
                            min(255, round(246 - 26 * t + 9 * glow)),
                            min(255, round(253 - 20 * t + 2 * glow)), 255)
    tile.putalpha(tile_mask)
    border = Image.new('RGBA', tile.size)
    ImageDraw.Draw(border).line(squircle((8.5, 8.5, 119.5, 119.5)) + [squircle((8.5, 8.5, 119.5, 119.5))[0]],
                               fill=(255, 255, 255, 200), width=point(.8))
    tile = Image.alpha_composite(tile, border)

    # An open optical orbit and a detached focus bead: a search aperture, not a magnifier.
    symbol_mask = Image.new('L', tile.size)
    draw = ImageDraw.Draw(symbol_mask)
    orbit = []
    for step in range(301):
        angle = math.radians(-12 + step)
        orbit.append((point(62 + 28 * math.cos(angle)), point(66 + 28 * math.sin(angle))))
    draw.line(orbit, fill=255, width=point(12), joint='curve')
    for x, y in (orbit[0], orbit[-1]):
        draw.ellipse((x - point(6), y - point(6), x + point(6), y + point(6)), fill=255)
    draw.ellipse(box((81, 31, 95, 45)), fill=255)

    shadow = Image.new('RGBA', tile.size, (35, 55, 120, 0))
    shifted = Image.new('L', tile.size)
    shifted.paste(symbol_mask, (0, point(2)))
    shadow.putalpha(shifted.filter(ImageFilter.GaussianBlur(point(2))).point(lambda alpha: round(alpha * .25)))
    tile = Image.alpha_composite(tile, shadow)
    material = Image.new('RGBA', tile.size)
    pixels = material.load()
    for y in range(CANVAS):
        for x in range(CANVAS):
            t = min(1, max(0, (x / SCALE + y / SCALE - 50) / 130))
            rim = math.exp(-((y / SCALE - 35) / 7) ** 2) * 18
            start, end = (22, 137, 239), (90, 67, 199)
            pixels[x, y] = tuple(min(255, round(a + (b - a) * t + rim)) for a, b in zip(start, end)) + (255,)
    material.putalpha(symbol_mask)
    tile = Image.alpha_composite(tile, material)
    # Preserve transparent edges even around the subtle symbol shadow.
    tile.putalpha(tile_mask)
    return tile


if __name__ == '__main__':
    target = ROOT / 'extension' / 'icons'
    target.mkdir(parents=True, exist_ok=True)
    source = artwork()
    for size in SIZES:
        source.resize((size, size), Image.Resampling.LANCZOS).save(target / f'icon-{size}.png', optimize=True)
