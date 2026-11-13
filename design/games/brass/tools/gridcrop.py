# py gridcrop.py <img> <x0> <y0> <size> <out.jpg> [frame=1000] [outpx=1000]
# Crop a square region given in a 0..frame coordinate system and draw a grid (thin every 10, bold+label every 50).
import sys
from PIL import Image, ImageDraw
src, x0, y0, sz, out = sys.argv[1], *map(float, sys.argv[2:5]), sys.argv[5]
frame = float(sys.argv[6]) if len(sys.argv) > 6 else 1000
outpx = int(sys.argv[7]) if len(sys.argv) > 7 else 1000
im = Image.open(src).convert('RGB')
W, H = im.size
k = W / frame
crop = im.crop((int(x0 * k), int(y0 * k), int((x0 + sz) * k), int((y0 + sz * H / W * 0 + sz) * k)))
crop = crop.resize((outpx, outpx))
d = ImageDraw.Draw(crop)
s = outpx / sz
v = int(x0 // 10 * 10)
while v <= x0 + sz:
    X = (v - x0) * s
    bold = v % 50 == 0
    d.line([(X, 0), (X, outpx)], fill=(0, 255, 255) if bold else (255, 0, 255), width=2 if bold else 1)
    if bold: d.text((X + 2, 2), str(v), fill=(255, 255, 0))
    v += 10
v = int(y0 // 10 * 10)
while v <= y0 + sz:
    Y = (v - y0) * s
    bold = v % 50 == 0
    d.line([(0, Y), (outpx, Y)], fill=(0, 255, 255) if bold else (255, 0, 255), width=2 if bold else 1)
    if bold: d.text((2, Y + 2), str(v), fill=(255, 255, 0))
    v += 10
crop.save(out, quality=85)
