# Adds the 13 corporation logos to the flat set from BGA's corps_logos.png (same repo as the other source sheets), in
# the set's own format: sources/<sha12>-corps_logos.png, source-sheets/corps_logos.{svg,png},
# markers/corp-logos/logo-<corp>.{svg,png}, thumbnails, asset-manifest.json rows. Each 334x100 cell is trimmed to its
# visible pixels only (no scaling, no redraw). py -I add-logos.py <corps_logos.png> <flat set dir>
import json, os, shutil, sys, hashlib
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from importlib import util
spec = util.spec_from_file_location('tags', os.path.join(os.path.dirname(__file__), 'add-tags.py'))

src, flat = sys.argv[1], sys.argv[2]
URL = 'https://raw.githubusercontent.com/elaskavaia/bga-mars/main/img/corps_logos.png'
GRID = [['beginner-corporation', 'credicor', 'ecoline', 'helion', 'interplanetary-cinematics', 'inventrix', 'mining-guild'],
        ['phobolog', 'saturn-systems', 'teractor', 'tharsis-republic', 'thorgate', 'united-nations-mars-initiative', None]]
raw = open(src, 'rb').read()
sha = hashlib.sha256(raw).hexdigest()
srel = f'sources/{sha[:12]}-corps_logos.png'
shutil.copyfile(src, os.path.join(flat, srel))
sheet = Image.open(src).convert('RGBA')
cw, ch = sheet.width // 7, sheet.height // 2

import base64, io
def write(im, rel, title, desc):
    buf = io.BytesIO(); im.save(buf, 'WEBP', lossless=True); w = buf.getvalue()
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{im.width}" height="{im.height}" viewBox="0 0 {im.width} {im.height}">'
           f'<title>{title}</title><desc>{desc}</desc><image width="{im.width}" height="{im.height}" '
           f'href="data:image/webp;base64,{base64.b64encode(w).decode()}"/></svg>')
    os.makedirs(os.path.dirname(os.path.join(flat, rel)), exist_ok=True)
    open(os.path.join(flat, rel + '.svg'), 'w', encoding='utf8').write(svg)
    im.save(os.path.join(flat, rel + '.png'))
    th = os.path.join(flat, 'thumbnails', rel + '.webp'); os.makedirs(os.path.dirname(th), exist_ok=True)
    t = im.copy(); t.thumbnail((240, 240)); t.save(th, 'WEBP', quality=85)
    return {'svg': rel + '.svg', 'png': rel + '.png', 'preview': 'thumbnails/' + rel + '.webp', 'width': im.width, 'height': im.height,
            'svgSHA256': hashlib.sha256(svg.encode()).hexdigest(), 'embeddedMime': 'image/webp', 'compression': 'lossless WebP',
            'rasterWidth': im.width, 'rasterHeight': im.height, 'transparent': True, 'embeddedImages': 1, 'editableVector': False}

rows = [{'id': 'source-sheet-corps-logos', 'name': 'BGA corporation logos sheet', 'category': 'source-sheets',
         **write(sheet, 'source-sheets/corps_logos', 'corps_logos.png, complete original source image', 'Original artwork, extracted without redraw or recolouring; lossless WebP embedded.'),
         'source': srel, 'sourceURL': URL, 'sourceKind': 'BGA-digital-counterpart', 'sourceSHA256': sha, 'note': 'Added 2026-10-29 for the player-panel corporation logos (user approved the download).'}]
for r, row in enumerate(GRID):
    for c, name in enumerate(row):
        if not name: continue
        box = (c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)
        cell = sheet.crop(box)
        bb = cell.getbbox() or (0, 0, cw, ch)
        im = cell.crop(bb)
        rows.append({'id': f'corp-logo-{name}', 'name': f'{name} logo', 'category': 'markers',
                     **write(im, f'markers/corp-logos/logo-{name}', f'{name} logo', 'Official BGA corporation logo, cut at native size and trimmed to visible pixels; no redraw.'),
                     'source': srel, 'sourceURL': URL, 'sourceKind': 'BGA-digital-counterpart',
                     'crop': {'left': box[0] + bb[0], 'top': box[1] + bb[1], 'width': bb[2] - bb[0], 'height': bb[3] - bb[1]}, 'sourceSHA256': sha})
mp = os.path.join(flat, 'data', 'asset-manifest.json')
m = json.load(open(mp, encoding='utf8'))
ids = {x['id'] for x in rows}
m = [x for x in m if x.get('id') not in ids] + rows
json.dump(m, open(mp, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
cp = os.path.join(flat, 'data', 'component-coverage.json')
c = json.load(open(cp, encoding='utf8'))
if not any(x.get('component') == 'Corporation logos' for x in c):
    c.append({'component': 'Corporation logos', 'physicalCount': None, 'designs': 13, 'available': 13, 'status': 'complete', 'folder': 'markers/corp-logos', 'flat': True,
              'note': 'Added 2026-10-29 from BGA corps_logos.png (sources/), trimmed native cells; used in the player panels like BGA.'})
    json.dump(c, open(cp, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(rows), 'assets added; manifest', len(m))
