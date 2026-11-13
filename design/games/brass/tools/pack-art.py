# Web art for the Brass artboards and handoff: flat-set PNGs -> lossy WebP at 2x their largest display size.
# Same folder tree and file ids as `ready to use - flat`. py -I pack-art.py <flat dir> <out art dir>
import os, sys, json
from PIL import Image
F, O = sys.argv[1], sys.argv[2]
# folder: (max width px, quality)
SIZE = {'boards': None, 'industry-tiles': (192, 86), 'cards-location': (320, 84), 'cards-industry': (320, 84), 'cards-wild': (320, 84),
        'card-backs': (320, 84), 'links': (220, 88), 'merchants': (200, 86), 'characters': (176, 86), 'markers': (None, 90),
        'money': (128, 88), 'resources': (None, 92), 'artwork': (160, 86), 'player-aids': (None, 86)}
BOARDS = {'board-night': (2400, 82), 'board-day': (1200, 82), 'player-mat-night': (1800, 82), 'player-mat-day': (639, 82)}
index = {}
total = 0
for d, spec in SIZE.items():
    os.makedirs(os.path.join(O, d), exist_ok=True)
    for f in sorted(os.listdir(os.path.join(F, d))):
        if not f.endswith('.png'): continue
        n = f[:-4]
        if d == 'characters' and n.endswith('-back'): w, q = 176, 86
        im = Image.open(os.path.join(F, d, f)).convert('RGBA')
        w, q = BOARDS[n] if d == 'boards' else spec
        if w and im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        out = os.path.join(O, d, n + '.webp')
        im.save(out, 'WEBP', quality=q, method=6)
        index[f'{d}/{n}'] = {'w': im.width, 'h': im.height, 'bytes': os.path.getsize(out), 'src': f'{d}/{f}'}
        total += os.path.getsize(out)
json.dump(index, open(os.path.join(O, 'art-index.json'), 'w'), indent=1)
print(len(index), 'files', total // 1024, 'KB')
