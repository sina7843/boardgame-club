# Gridded zoom crop for measuring: py -I gridcrop.py <image> <x0> <y0> <x1> <y1> <out.png> [scale] [step]
import sys
from PIL import Image, ImageDraw, ImageEnhance
img, x0, y0, x1, y1, out = sys.argv[1], *map(int, sys.argv[2:6]), sys.argv[6]
scale = int(sys.argv[7]) if len(sys.argv) > 7 else 3
step = int(sys.argv[8]) if len(sys.argv) > 8 else 5
im = ImageEnhance.Contrast(Image.open(img).convert('RGB')).enhance(1.6)
c = im.crop((x0, y0, x1, y1)).resize(((x1 - x0) * scale, (y1 - y0) * scale), Image.NEAREST)
d = ImageDraw.Draw(c)
major = step * 5
for x in range(x0 - x0 % step, x1, step):
    if x < x0: continue
    X = (x - x0) * scale; d.line([(X, 0), (X, c.height)], fill=(0, 255, 255) if x % major == 0 else (0, 70, 70))
    if x % major == 0: d.text((X + 2, 2), str(x), fill=(255, 255, 0))
for y in range(y0 - y0 % step, y1, step):
    if y < y0: continue
    Y = (y - y0) * scale; d.line([(0, Y), (c.width, Y)], fill=(0, 255, 255) if y % major == 0 else (0, 70, 70))
    if y % major == 0: d.text((2, Y + 2), str(y), fill=(255, 255, 0))
c.save(out)
