"""Erzeugt die App-Icons (PNG) ohne Zusatzpakete: Verlauf violett->türkis mit weißer Trendlinie."""
import math, struct, sys, zlib
from pathlib import Path

C1, C2 = (0x7c, 0x6c, 0xff), (0x22, 0xd3, 0xee)
# Trendlinie im 32er-Raster (wie das Favicon), für Maskable-Icons etwas kleiner skaliert
LINE = [(7, 21), (13, 15), (17, 19), (25, 11)]
ARROW = [(19.5, 11), (25, 11), (25, 16.5)]


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def render(size, scale=1.0, ss=3):
    sw = 3.0  # Strichbreite im 32er-Raster
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            acc = [0.0, 0.0, 0.0]
            for sy in range(ss):
                for sx in range(ss):
                    u = (x + (sx + .5) / ss) / size
                    v = (y + (sy + .5) / ss) / size
                    t = (u + v) / 2
                    col = [C1[i] + (C2[i] - C1[i]) * t for i in range(3)]
                    # in 32er-Raster umrechnen, um die Mitte skaliert
                    gx = 16 + (u * 32 - 16) / scale
                    gy = 16 + (v * 32 - 16) / scale
                    d = min(seg_dist(gx, gy, *LINE[i], *LINE[i + 1]) for i in range(len(LINE) - 1))
                    d = min(d, *(seg_dist(gx, gy, *ARROW[i], *ARROW[i + 1]) for i in range(len(ARROW) - 1)))
                    if d <= sw / 2:
                        col = [255, 255, 255]
                    for i in range(3):
                        acc[i] += col[i]
            row += bytes(int(a / (ss * ss)) for a in acc)
        rows.append(bytes([0]) + bytes(row))
    raw = b"".join(rows)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    # Vollflächig: Android maskiert selbst (Kreis/Squircle), iOS rundet selbst ab
    for name, size, scale in [("icon-512.png", 512, 0.78), ("icon-192.png", 192, 0.78), ("apple-touch-icon.png", 180, 0.85)]:
        (out / name).write_bytes(render(size, scale, ss=2 if size > 256 else 3))
        print("geschrieben:", out / name)
