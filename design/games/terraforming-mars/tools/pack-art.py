# Web art for the TM handoff: pull the one raster out of each ready-to-use-flat SVG and save it as lossy webp at the
# same pixel size (coordinates stay valid). Corporation cards were enlarged 2x in the flat set; they go back to their
# native 450 px width. The BGA sprite sheets (resources 10x2, icons 14x2) are also cut into one file per icon.
# py -I pack-art.py <flat set dir> <out art dir>
import base64, io, json, os, re, sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
SHIP = ['boards', 'cards', 'markers', 'printed-panels', 'tiles', 'source-sheets']
RX = re.compile(rb'data:image/(?:webp|png|jpeg);base64,([A-Za-z0-9+/=\s]+)')
rows, before, after = [], 0, 0


def save(im, rel, srcbytes=None):
    global before, after
    out = os.path.join(dst, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    kw = dict(quality=88, method=4)
    if im.mode == 'RGBA':
        kw['alpha_quality'] = 100
    im.save(out, 'WEBP', **kw)
    if srcbytes and os.path.getsize(out) > len(srcbytes):  # lossy came out bigger: keep the source bytes
        open(out, 'wb').write(srcbytes)
    before += len(srcbytes or b''); after += os.path.getsize(out)
    rows.append({'path': 'art/' + rel.replace('\\', '/'), 'w': im.width, 'h': im.height, 'bytes': os.path.getsize(out)})


sheets = {}
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
            rel = os.path.relpath(os.path.join(root, f[:-4] + '.webp'), src)
            if top == 'cards' and os.path.basename(root) == 'corporations' and im.width > 450:
                im = im.resize((450, round(im.height * 450 / im.width)), Image.LANCZOS)
                data = None
            if top == 'source-sheets':
                sheets[f[:-4]] = im
            save(im, rel, data)

# one file per sprite cell (names from the BGA stylesheet sources/*terraformingmars.css: .tracker_*, .token_img)
RES = [['plant', 'animal', 'heat', 'mc', 'microbe', 'energy', 'science', 'steel', 'titanium', 'tr'],
       ['card', 'oxygen', 'temperature', None, 'fighter', 'first-player-bga', 'ocean', 'generation', None, None]]
ICO = [['card-sm', 'mc-sm', 'mc-xs', 'arrow', 'temperature-sm', 'oxygen-sm', 'greenery', 'city', 'ocean-tile', 'mc-lg', None, None, 'tr-sm', 'mars'],
       ['steel-value', 'titanium-value', 'land', 'greenery-hex', 'city-hex', 'tile-mars', 'tile-mining', 'tile-commercial', 'tile-nuclear',
        'tile-ecological', 'tile-lava', 'tile-mohole', 'tile-restricted', 'tile-industrial']]
for sheet, grid in (('resources', RES), ('icons', ICO)):
    im = sheets[sheet]
    cw, ch = im.width // len(grid[0]), im.height // len(grid)
    for r, row in enumerate(grid):
        for c, name in enumerate(row):
            if name:
                save(im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)), os.path.join('icons', name + '.webp'))

json.dump(rows, open(os.path.join(dst, 'art-index.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(rows), 'files', before // 1024, 'KB ->', after // 1024, 'KB')
