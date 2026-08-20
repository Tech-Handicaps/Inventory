#!/usr/bin/env python3
"""Strip baked-in checkerboard backgrounds from Handicaper walk sprite."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

SPRITE = Path(__file__).resolve().parents[1] / "public" / "brand" / "handicaper-walk-sprite.png"


def is_background_pixel(r: int, g: int, b: int) -> bool:
    spread = max(r, g, b) - min(r, g, b)
    avg = (r + g + b) / 3
    return spread <= 18 and avg >= 210


def flood_clear_background(im: Image.Image, tolerance: int = 24) -> Image.Image:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    visited = bytearray(w * h)

    def idx(x: int, y: int) -> int:
        return y * w + x

    queue: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        i = idx(x, y)
        if visited[i]:
            return
        r, g, b, _a = px[x, y]
        if not is_background_pixel(r, g, b):
            return
        visited[i] = 1
        queue.append((x, y))

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    while queue:
        x, y = queue.popleft()
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)

        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or nx >= w or ny < 0 or ny >= h:
                continue
            i = idx(nx, ny)
            if visited[i]:
                continue
            nr, ng, nb, _na = px[nx, ny]
            if abs(nr - r) > tolerance or abs(ng - g) > tolerance or abs(nb - b) > tolerance:
                continue
            if not is_background_pixel(nr, ng, nb):
                continue
            visited[i] = 1
            queue.append((nx, ny))

    return rgba


def main() -> None:
    im = Image.open(SPRITE)
    out = flood_clear_background(im)
    out.save(SPRITE, optimize=True)
    print(f"processed {SPRITE} -> {out.size} {out.mode}")


if __name__ == "__main__":
    main()
