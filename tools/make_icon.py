"""Draws the app icon (512x512 PNG): a night-sky gradient with a clock face."""
import math
import os
import sys

sys.path.insert(0, os.path.expanduser("~/tvctl-lib"))
from PIL import Image, ImageDraw  # noqa: E402

S = 512
img = Image.new("RGB", (S, S))
px = img.load()
for y in range(S):
    for x in range(S):
        t = (x + y) / (2 * S)
        px[x, y] = (int(59 + (15 - 59) * t), int(42 + (92 - 42) * t), int(122 + (122 - 122) * t))

d = ImageDraw.Draw(img)
c, r = S // 2, 150
d.ellipse([c - r, c - r, c + r, c + r], outline=(244, 241, 234), width=18)
for i in range(12):
    a = math.radians(i * 30)
    d.line([(c + math.sin(a) * (r - 34), c - math.cos(a) * (r - 34)), (c + math.sin(a) * (r - 20), c - math.cos(a) * (r - 20))], fill=(244, 241, 234), width=8)
d.line([(c, c), (c, c - 90)], fill=(244, 241, 234), width=16)
d.line([(c, c), (c + 62, c + 36)], fill=(244, 241, 234), width=16)
d.ellipse([c - 14, c - 14, c + 14, c + 14], fill=(244, 241, 234))
img.save(sys.argv[1])
