# Detect the square build-slot frames (light silver border, ~180px at 4000px) on the night board.
# py find-slots.py <board.png> <out.json>
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
im = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.int16)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
mask = (mx > 150) & (mx - mn < 40)
lab, n = ndimage.label(mask)
out = []
for i, sl in enumerate(ndimage.find_objects(lab)):
    h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
    if 150 <= w <= 215 and 150 <= h <= 215 and abs(w - h) < 25:
        fill = (lab[sl] == i + 1).mean()
        if fill < 0.25:
            out.append({'x': (sl[1].start + sl[1].stop) / 2 / 4, 'y': (sl[0].start + sl[0].stop) / 2 / 4, 'w': w / 4, 'h': h / 4, 'fill': round(float(fill), 3)})
out.sort(key=lambda o: (round(o['y'] / 20), o['x']))
json.dump(out, open(sys.argv[2], 'w'), indent=0)
print(len(out))
for o in out: print(round(o['x'], 1), round(o['y'], 1), o['w'], o['h'], o['fill'])
