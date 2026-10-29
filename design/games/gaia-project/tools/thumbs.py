# Lossy full-size + half-width thumbnail for each faction board: py -I thumbs.py <src> <dst>
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for f in sorted(os.listdir(src)):
    if not f.endswith('.webp'): continue
    with Image.open(os.path.join(src, f)) as im:
        im.load()
        im.save(os.path.join(dst, f), 'WEBP', quality=88, method=4)
        w = 880
        im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(os.path.join(dst, f.replace('.webp', '-sm.webp')), 'WEBP', quality=86, method=4)
print('ok')
