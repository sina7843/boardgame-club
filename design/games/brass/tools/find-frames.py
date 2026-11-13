# Dark square interiors of a given size. py find-frames.py <img> <minpx> <maxpx> <frame units for x> [thr...]
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
im = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.int16)
lo, hi, frame = int(sys.argv[2]), int(sys.argv[3]), float(sys.argv[4])
k = im.shape[1] / frame
mx = im.max(axis=2)
out = []
for thr in (40, 55, 70, 85):
    lab, n = ndimage.label(ndimage.binary_opening(mx < thr, iterations=2))
    for i, sl in enumerate(ndimage.find_objects(lab)):
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        if lo <= w <= hi and lo <= h <= hi and abs(w - h) < 0.12 * w:
            x, y = (sl[1].start + sl[1].stop) / 2 / k, (sl[0].start + sl[0].stop) / 2 / k
            if not any(abs(x - o[0]) < 10 and abs(y - o[1]) < 10 for o in out): out.append((x, y, w / k, h / k))
out.sort(key=lambda o: (round(o[1] / 30), o[0]))
print(len(out))
for o in out: print(*[round(v, 1) for v in o])
