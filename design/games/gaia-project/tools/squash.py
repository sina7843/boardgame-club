# Re-encode Gaia webp assets as high-quality lossy at the same pixel size: py -I squash.py <src> <dst>
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
before = after = 0
for f in sorted(os.listdir(src)):
    if not f.endswith('.webp'): continue
    p, q = os.path.join(src, f), os.path.join(dst, f)
    with Image.open(p) as im:
        im.load()
        kw = dict(quality=88, method=6)
        if im.mode == 'RGBA': kw['alpha_quality'] = 100
        im.save(q, 'WEBP', **kw)
    a, b = os.path.getsize(p), os.path.getsize(q)
    if b >= a:  # keep the original when lossy is not smaller
        with open(p, 'rb') as s, open(q, 'wb') as t: t.write(s.read()); b = a
    before += a; after += b
print('before KB', before // 1024, 'after KB', after // 1024)
