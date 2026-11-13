# Hex cells inside every building image (enclosures, special and unique buildings): the publisher art is drawn on a hex
# lattice with R = 135 px (flat-top: 270 x 234 per hex). Flat-top images: centres x = 135 + 202.5 i, y = 117 + 117 j;
# images the flat set turned 90 deg are pointy-top: x = 117 + 117 i, y = 135 + 202.5 j. A centre counts when the art is
# opaque around it. Output: cells as offsets from the image centre (px), used by an-lib.js to fit the image onto engine
# cells with a rotation of k x 30 deg (+ mirror). py -I building-cells.py <art dir> <out.json>
import json, os, sys
import numpy as np
from PIL import Image

art, out = sys.argv[1], sys.argv[2]
R = 135.0
res = {}
for sub in ('enclosures', 'special-buildings', 'unique-buildings'):
    for f in sorted(os.listdir(os.path.join(art, sub))):
        im = np.array(Image.open(os.path.join(art, sub, f)).convert('RGBA'))[:, :, 3] > 128
        H, W = im.shape
        best = None
        for mode in ('flat', 'pointy'):
            if mode == 'flat': xs = np.arange(R, W, 1.5 * R); ys = np.arange(R * 0.8660, H, R * 0.8660)
            else: xs = np.arange(R * 0.8660, W, R * 0.8660); ys = np.arange(R, H, 1.5 * R)
            cells = []
            for i, x in enumerate(xs):
                for j, y in enumerate(ys):
                    if (i + j) % 2: continue
                    pts = [(x + dx * R * 0.5, y + dy * R * 0.5) for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1))]
                    if all(0 <= px < W and 0 <= py < H and im[int(py), int(px)] for px, py in pts): cells.append((x, y))
            for i, x in enumerate(xs):  # odd parity lattice (shifted rows) — keep whichever parity covers more art
                pass
            alt = []
            for i, x in enumerate(xs):
                for j, y in enumerate(ys):
                    if (i + j) % 2 == 0: continue
                    pts = [(x + dx * R * 0.5, y + dy * R * 0.5) for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1))]
                    if all(0 <= px < W and 0 <= py < H and im[int(py), int(px)] for px, py in pts): alt.append((x, y))
            cand = cells if len(cells) >= len(alt) else alt
            if not best or len(cand) > len(best[1]): best = (mode, cand)
        mode, cells = best
        res[sub + '/' + f[:-5]] = {'w': W, 'h': H, 'mode': mode, 'cells': [[round(x - W / 2, 1), round(y - H / 2, 1)] for x, y in cells]}
        print(f, W, H, mode, len(cells))
json.dump(res, open(out, 'w'), indent=1)
