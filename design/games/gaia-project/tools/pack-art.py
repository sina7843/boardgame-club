# Web art for the handoff: pull the one raster out of each ready-to-use SVG and save it as lossy webp
# at the same pixel size (coordinates stay valid). py -I pack-art.py <flat set dir> <out art dir>
import base64, io, json, os, re, sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
SHIP = ['artwork', 'automa-faction-cards', 'boards', 'federation-tokens', 'final-scoring', 'planet-art', 'round-boosters',
        'reference-cards', 'reference-only', 'round-scoring', 'space-sectors', 'structures', 'technology', 'tokens-markers']
RX = re.compile(rb'data:image/(?:webp|png|jpeg);base64,([A-Za-z0-9+/=\s]+)')
rows, before, after = [], 0, 0
for top in SHIP:
    for root, _, files in os.walk(os.path.join(src, top)):
        for f in sorted(files):
            if not f.endswith('.svg'):
                continue
            raw = open(os.path.join(root, f), 'rb').read()
            m = RX.findall(raw)
            if len(m) != 1:
                print('skip', f, len(m)); continue
            data = base64.b64decode(re.sub(rb'\s', b'', m[0]))
            im = Image.open(io.BytesIO(data)); im.load()
            if im.mode not in ('RGB', 'RGBA'):
                im = im.convert('RGBA')
            rel = os.path.relpath(os.path.join(root, f[:-4] + '.webp'), src).replace('\\', '/')
            out = os.path.join(dst, rel)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            kw = dict(quality=88, method=4)
            if im.mode == 'RGBA':
                kw['alpha_quality'] = 100
            im.save(out, 'WEBP', **kw)
            if os.path.getsize(out) > len(data):  # lossy came out bigger: keep the source bytes
                open(out, 'wb').write(data)
            before += len(data); after += os.path.getsize(out)
            rows.append({'path': 'art/' + rel, 'w': im.width, 'h': im.height, 'bytes': os.path.getsize(out)})
json.dump(rows, open(os.path.join(dst, 'art-index.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(rows), 'files', before // 1024, 'KB ->', after // 1024, 'KB')
