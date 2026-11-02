#!/usr/bin/env python3
"""Generate Android launcher icons and splash artwork for Galaxy League.

Source art: public/assets/images/logo*.png (the store poster).
Outputs: android/app/src/main/res/mipmap-*/ic_launcher*.png,
         android/app/src/main/res/drawable-xxxhdpi/splash_logo.png

Requires Pillow:  python -m pip install Pillow
Run from the repository root:  python scripts/generate-android-assets.py
"""

from __future__ import annotations

import math
from glob import glob
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"

# Square crop around the glowing ball. Both fighters' legs stay in frame,
# which keeps the icon readable at 48 px while still showing the factions.
CROP_BOX = (480, 1315, 1130, 1965)

LEGACY_SIZES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
FOREGROUND_SIZES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}

CYAN = (0, 229, 255)
RING_HIGHLIGHT = (196, 240, 255)
ORANGE = (255, 138, 0)


def find_poster() -> Path:
    matches = sorted(glob(str(ROOT / "public" / "assets" / "images" / "logo*.png")))
    if not matches:
        raise SystemExit("Poster not found: public/assets/images/logo*.png")
    return Path(matches[0])


def load_art() -> Image.Image:
    art = Image.open(find_poster()).convert("RGB").crop(CROP_BOX)
    art = ImageEnhance.Color(art).enhance(1.06)
    art = ImageEnhance.Contrast(art).enhance(1.04)
    return art


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def circle_mask(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    return mask


def gradient_ring(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    width: int,
    alpha: int = 235,
    steps: int = 144,
) -> None:
    """Two-tone ring: cyan at the top, magma orange at the bottom."""
    x0, y0, x1, y1 = box
    for index in range(steps):
        start = -90 + index * 360 / steps
        end = start + 360 / steps + 0.6
        middle = math.radians((start + end) / 2)
        t = (math.sin(middle) + 1) / 2
        # Go through a pale highlight at the sides instead of muddy green.
        if t < 0.5:
            color = lerp(CYAN, RING_HIGHLIGHT, t * 2)
        else:
            color = lerp(RING_HIGHLIGHT, ORANGE, (t - 0.5) * 2)
        draw.arc((x0, y0, x1, y1), start=start, end=end, fill=color + (alpha,), width=width)


def make_legacy_icon(art: Image.Image, size: int) -> Image.Image:
    ss = 4
    big = size * ss
    resized = art.resize((big, big), Image.LANCZOS)
    radius = round(big * 0.20)

    icon = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    icon.paste(resized, (0, 0), rounded_mask(big, radius))

    draw = ImageDraw.Draw(icon)
    border = max(ss, round(big * 0.010))
    draw.rounded_rectangle(
        (border // 2, border // 2, big - 1 - border // 2, big - 1 - border // 2),
        radius=max(1, radius - border // 2),
        outline=(150, 240, 255, 165),
        width=border,
    )

    return icon.resize((size, size), Image.LANCZOS)


def make_round_icon(art: Image.Image, size: int) -> Image.Image:
    ss = 4
    big = size * ss
    resized = art.resize((big, big), Image.LANCZOS)

    icon = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    icon.paste(resized, (0, 0), circle_mask(big))

    ring_width = max(2 * ss, round(big * 0.014))
    inset = ring_width // 2 + ss
    draw = ImageDraw.Draw(icon)
    gradient_ring(draw, (inset, inset, big - 1 - inset, big - 1 - inset), ring_width)

    return icon.resize((size, size), Image.LANCZOS)


def make_adaptive_foreground(art: Image.Image, size: int) -> Image.Image:
    ss = 4
    big = size * ss
    zoom = 1.06
    visible = round(art.width / zoom)
    left = (art.width - visible) // 2
    top = (art.height - visible) // 2
    cropped = art.crop((left, top, left + visible, top + visible))
    return cropped.resize((big, big), Image.LANCZOS).resize((size, size), Image.LANCZOS)


def make_splash_logo(art: Image.Image, size: int = 1024) -> Image.Image:
    """Circular emblem that stays inside Android 12's splash icon safe zone."""
    ss = 2
    big = size * ss
    center = big // 2

    art_diameter = round(big * 0.640)
    art_radius = art_diameter // 2
    ring_radius = round(big * 0.327)
    ring_width = max(4 * ss, round(big * 0.011))

    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))

    # Soft cyan halo under the ring.
    glow = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_width = ring_width * 3
    gradient_ring(
        glow_draw,
        (
            center - ring_radius,
            center - ring_radius,
            center + ring_radius,
            center + ring_radius,
        ),
        glow_width,
        alpha=70,
        steps=96,
    )
    glow = glow.filter(ImageFilter.GaussianBlur(round(big * 0.015)))
    canvas.alpha_composite(glow)

    # Poster art clipped into the badge.
    badge = art.resize((art_diameter, art_diameter), Image.LANCZOS)
    canvas.paste(badge, (center - art_radius, center - art_radius), circle_mask(art_diameter))

    draw = ImageDraw.Draw(canvas)
    gradient_ring(
        draw,
        (
            center - ring_radius,
            center - ring_radius,
            center + ring_radius,
            center + ring_radius,
        ),
        ring_width,
        alpha=240,
    )

    # Thin dark separator between artwork and ring.
    inner = art_radius + max(ss, round(big * 0.002))
    draw.ellipse(
        (center - inner, center - inner, center + inner, center + inner),
        outline=(5, 5, 5, 200),
        width=max(ss, round(big * 0.0025)),
    )

    return canvas.resize((size, size), Image.LANCZOS)


def main() -> None:
    art = load_art()

    for density, size in LEGACY_SIZES.items():
        folder = RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        make_legacy_icon(art, size).save(folder / "ic_launcher.png", optimize=True)
        make_round_icon(art, size).save(folder / "ic_launcher_round.png", optimize=True)

    for density, size in FOREGROUND_SIZES.items():
        folder = RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        make_adaptive_foreground(art, size).save(folder / "ic_launcher_foreground.png", optimize=True)

    splash_folder = RES / "drawable-xxxhdpi"
    splash_folder.mkdir(parents=True, exist_ok=True)
    make_splash_logo(art).save(splash_folder / "splash_logo.png", optimize=True)

    print("Android icons and splash artwork generated.")


if __name__ == "__main__":
    main()
