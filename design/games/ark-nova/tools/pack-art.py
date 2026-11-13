# Web art for the Ark Nova handoff: pull the one raster out of each ready-to-use-flat SVG and save it as lossy webp.
# Maps go to their viewBox size (2000x1041) so layout.json coordinates = viewBox units = pixels; cards to 400 px wide
# (zoom shows 400 px); everything else keeps its pixel size. Wooden pieces are 2x2 colour grids (blue, red / yellow, black)
# and are cut into one file per colour. Panel icons come from the local BGA sprite (cut-bga-icons.py output).
# py -I pack-art.py <flat set dir> <bga icons dir> <out art dir>
import base64, io, json, os, re, sys
from PIL import Image

src, bga, dst = sys.argv[1:4]
SKIP = {'sources', 'thumbnails', 'comparison', 'reproduction', 'data'}
RX = re.compile(rb'data:image/(?:webp|png|jpeg);base64,([A-Za-z0-9+/=\s]+)')
rows = []

def save(im, rel, q=86):
    out = os.path.join(dst, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    kw = dict(quality=q, method=5)
    if im.mode == 'RGBA': kw['alpha_quality'] = 90
    im.save(out, 'WEBP', **kw)
    rows.append({'path': 'art/' + rel.replace(os.sep, '/'), 'w': im.width, 'h': im.height, 'bytes': os.path.getsize(out)})

def trim(im):
    bb = im.getbbox() if im.mode == 'RGBA' else None
    return im.crop(bb) if bb else im

for top in sorted(os.listdir(src)):
    d = os.path.join(src, top)
    if top in SKIP or not os.path.isdir(d): continue
    for f in sorted(os.listdir(d)):
        if not f.endswith('.svg'): continue
        raw = open(os.path.join(d, f), 'rb').read()
        m = RX.findall(raw)
        if len(m) != 1: print('skip', top, f, len(m)); continue
        vb = [float(v) for v in re.search(rb'viewBox="([^"]+)"', raw).group(1).split()]
        im = Image.open(io.BytesIO(base64.b64decode(re.sub(rb'\s', b'', m[0])))); im.load()
        if im.mode not in ('RGB', 'RGBA'): im = im.convert('RGBA')
        name = f[:-4]
        if top == 'boards' and name.startswith('map-'):
            im = im.resize((int(vb[2]), int(vb[3])), Image.LANCZOS)
        elif top.startswith('cards-') or top == 'card-backs':
            im = im.convert('RGB').resize((400, round(im.height * 400 / im.width)), Image.LANCZOS)
        if top == 'wooden-pieces' and name != 'break-token':
            kind = {'association-workers': 'worker', 'player-cubes': 'cube', 'wooden-counters': 'counter'}[name]
            w, h = im.width // 2, im.height // 2
            for i, col in enumerate(['blue', 'red', 'yellow', 'black']):
                cell = im.crop(((i % 2) * w, (i // 2) * h, (i % 2 + 1) * w, (i // 2 + 1) * h)).convert('RGBA')
                save(trim(cell), os.path.join('pieces', f'{kind}-{col}.webp'))
            continue
        save(im, os.path.join(top, name + '.webp'), 82 if top == 'boards' else 86)

ICONS = {'appeal': 'icon-appeal', 'conservation': 'icon-conservation', 'reputation': 'icon-reputation', 'money': 'icon-money',
         'break': 'icon-break', 'xtoken': 'icon-xtoken', 'multiplier': 'icon-multiplier', 'hand': 'icon-hand', 'hand-cards': 'icon-hand-cards',
         'kiosk': 'icon-kiosk', 'add-worker': 'icon-add-worker', 'partner-zoo': 'icon-partner-zoo', 'upgrade-card': 'icon-upgrade-card',
         'income': 'icon-income', 'endgame': 'icon-endgame', 'sponsor-card': 'icon-sponsor-card', 'scoring-hand': 'icon-scoring-hand',
         'take-in-range': 'icon-take-in-range', 'clever': 'icon-clever', 'snapping': 'icon-snapping', 'immediate': 'icon-immediate',
         'venom': 'icon-venom', 'constriction': 'icon-constriction', 'conservation-project': 'icon-conservation-project', 'strength': 'icon-strength',
         'act-animals': 'icon-action-animals', 'act-build': 'icon-action-build', 'act-cards': 'icon-action-cards',
         'act-association': 'icon-action-association', 'act-sponsors': 'icon-action-sponsors', 'release': 'icon-release-animal',
         'rock': 'icon-rock', 'water': 'icon-water'}
for k, v in ICONS.items():
    save(Image.open(os.path.join(bga, v + '.png')).convert('RGBA'), os.path.join('ui', k + '.webp'), 90)

json.dump(rows, open(os.path.join(dst, 'art-index.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(rows), 'files', sum(r['bytes'] for r in rows) // 1024, 'KB')
