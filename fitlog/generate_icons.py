#!/usr/bin/env python3
# Run this to generate PNG icons if you have PIL installed
# Otherwise use any 192x192 and 512x512 PNG named icon-192.png and icon-512.png

try:
    from PIL import Image, ImageDraw, ImageFont
    for size in [192, 512]:
        img = Image.new('RGB', (size, size), '#080d16')
        draw = ImageDraw.Draw(img)
        # Draw a simple lightning bolt emoji area
        margin = size // 6
        draw.rectangle([margin, margin, size-margin, size-margin], fill='#0f1623', outline='#22d3ee', width=max(2, size//64))
        img.save(f'public/icon-{size}.png')
    print("Icons generated!")
except ImportError:
    print("PIL not available - create icon-192.png and icon-512.png manually (any square image works)")
