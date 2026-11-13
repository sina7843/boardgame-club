# Web art for Blood Rage: every finished piece of `ready to use` as webp at its native pixel size (nothing upscaled or
# redrawn). Text-free layers (card-art, clan-art, clan-slots) are left out: the cards already carry BGA's text.
# py -I pack-art.py <ready to use dir> <out art dir>   -> <out>/<category>/<id>.webp + art-index.json
import json, os, sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
CATS = ['boards', 'backgrounds', 'branding', 'cards', 'card-backs', 'clan-boards', 'clan-reference', 'clan-slots-complete', 'units', 'tokens', 'ui-icons']
# big photographic boards compress lossy; small pieces keep more quality
Q = {'boards': 82, 'backgrounds': 70, 'cards': 86, 'card-backs': 86, 'clan-boards': 84}
index = {}
total = 0
for cat in CATS:
    os.makedirs(os.path.join(out, cat), exist_ok=True)
    for f in sorted(os.listdir(os.path.join(src, cat))):
        if not f.endswith('.png'):
            continue
        aid = f[:-4]
        if aid == 'main-board-with-sea':  # the site layers main-board over sea-background itself
            continue
        im = Image.open(os.path.join(src, cat, f))
        im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
        dst = os.path.join(out, cat, aid + '.webp')
        im.save(dst, 'WEBP', quality=Q.get(cat, 90), method=6)
        n = os.path.getsize(dst)
        total += n
        index[f'{cat}/{aid}'] = {'w': im.width, 'h': im.height, 'bytes': n, 'source': f'ready to use/{cat}/{f}'}
json.dump(index, open(os.path.join(out, 'art-index.json'), 'w'), indent=1)
print(len(index), 'files', round(total / 2 ** 20, 2), 'MB')
