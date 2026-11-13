# Dark square interiors of the build slots (frame inner edge). py find-slots2.py <board.png> <out.json>
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
im = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.int16)
mx = im.max(axis=2)
res = []
for thr in (40, 55, 70):
    mask = ndimage.binary_opening(mx < thr, iterations=2)
    lab, n = ndimage.label(mask)
    for i, sl in enumerate(ndimage.find_objects(lab)):
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        if 150 <= w <= 182 and 150 <= h <= 182 and abs(w - h) < 14:
            res.append(((sl[1].start + sl[1].stop) / 8, (sl[0].start + sl[0].stop) / 8, w / 4, h / 4))
# merge duplicates
out = []
for x, y, w, h in res:
    if not any(abs(x - o[0]) < 8 and abs(y - o[1]) < 8 for o in out): out.append((x, y, w, h))
out.sort(key=lambda o: (round(o[1] / 25), o[0]))
json.dump([{'x': round(x, 1), 'y': round(y, 1), 'w': w, 'h': h} for x, y, w, h in out], open(sys.argv[2], 'w'), indent=0)
print(len(out))
for o in out: print(*[round(v, 1) for v in o])
