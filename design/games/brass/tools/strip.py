# py strip.py <img> <x0> <y0> <w> <h> <scale px/unit> <out>  (units = 0..1000 frame); grid every 10, label every 50
import sys
from PIL import Image, ImageDraw
src = sys.argv[1]; x0, y0, w, h, s = map(float, sys.argv[2:7]); out = sys.argv[7]
im = Image.open(src).convert('RGB'); k = im.size[0] / 1000
c = im.crop((int(x0 * k), int(y0 * k), int((x0 + w) * k), int((y0 + h) * k))).resize((int(w * s), int(h * s)))
d = ImageDraw.Draw(c)
for v in range(int(x0 // 10 * 10), int(x0 + w) + 1, 10):
    X = (v - x0) * s; b = v % 50 == 0
    d.line([(X, 0), (X, c.size[1])], fill=(0, 255, 255) if b else (255, 0, 255), width=1)
    if b: d.text((X + 2, 2), str(v), fill=(255, 255, 0))
for v in range(int(y0 // 10 * 10), int(y0 + h) + 1, 10):
    Y = (v - y0) * s; b = v % 50 == 0
    d.line([(0, Y), (c.size[0], Y)], fill=(0, 255, 255) if b else (255, 0, 255), width=1)
    if b: d.text((2, Y + 2), str(v), fill=(255, 255, 0))
c.save(out, quality=85)
