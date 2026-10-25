"""
Generate PNG icons for Nostalgic Map PWA using Python standard library (zlib + struct).
Creates a pin + camera memory icon on a rounded violet/indigo background.
"""
import zlib
import struct
import os
import math

def generate_png(size, output_path):
    raw_data = bytearray()
    scale = size / 128.0
    corner_radius = 28.0

    for y in range(size):
        raw_data.append(0)  # filter type 0
        ny = y / scale
        for x in range(size):
            nx = x / scale

            # Rounded square base (0 to 128)
            dx = max(corner_radius - nx, 0, nx - (128 - corner_radius))
            dy = max(corner_radius - ny, 0, ny - (128 - corner_radius))
            dist_sq = math.sqrt(dx * dx + dy * dy)

            if dist_sq > corner_radius:
                raw_data.extend([0, 0, 0, 0])
                continue

            alpha = 255
            if dist_sq > corner_radius - 1.5:
                alpha = int(255 * max(0.0, min(1.0, (corner_radius - dist_sq) / 1.5)))

            # Gradient from #6C5CE7 to #4834D4
            t = (nx + ny) / 256.0
            bg_r = int(108 * (1 - t) + 72 * t)
            bg_g = int(92 * (1 - t) + 52 * t)
            bg_b = int(231 * (1 - t) + 212 * t)

            # Draw Map Pin / Memory symbol centered at (64, 52)
            # Pin head: circle at (64, 48), radius 22
            # Pin tip: triangle down to (64, 94)
            pdx = nx - 64
            pdy = ny - 48
            p_dist = math.sqrt(pdx * pdx + pdy * pdy)

            is_pin = False

            # Upper circle
            if p_dist <= 22:
                is_pin = True
            elif 48 < ny <= 92:
                # Triangular tail to bottom tip
                progress = (ny - 48) / 44.0  # 0.0 at circle center, 1.0 at tip
                half_w = 22.0 * (1.0 - progress)
                if abs(pdx) <= half_w:
                    is_pin = True

            # Camera lens / inner circle cutout
            if p_dist <= 9:
                is_pin = False

            if is_pin:
                # White pin
                raw_data.extend([255, 255, 255, alpha])
            else:
                raw_data.extend([bg_r, bg_g, bg_b, alpha])

    compressor = zlib.compressobj(level=9)
    compressed = compressor.compress(raw_data) + compressor.flush()

    png = bytearray(b'\x89PNG\r\n\x1a\n')
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png.extend(struct.pack('>I', 13))
    png.extend(b'IHDR')
    png.extend(ihdr)
    png.extend(struct.pack('>I', zlib.crc32(b'IHDR' + ihdr) & 0xffffffff))

    png.extend(struct.pack('>I', len(compressed)))
    png.extend(b'IDAT')
    png.extend(compressed)
    png.extend(struct.pack('>I', zlib.crc32(b'IDAT' + compressed) & 0xffffffff))

    png.extend(struct.pack('>I', 0))
    png.extend(b'IEND')
    png.extend(struct.pack('>I', zlib.crc32(b'IEND') & 0xffffffff))

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(png)
    print(f"Generated: {output_path} ({size}x{size})")

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    icons_dir = os.path.join(base_dir, 'icons')
    generate_png(192, os.path.join(icons_dir, 'icon-192.png'))
    generate_png(512, os.path.join(icons_dir, 'icon-512.png'))
