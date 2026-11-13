# Adds the 12 tag icons to the flat set from BGA's badges.png (same repo as the other source sheets), in the set's own
# format: sources/<sha12>-badges.png, source-sheets/badges.{svg,png}, markers/tags/tag-<name>.{svg,png}, thumbnails, and
# asset-manifest.json rows. Cells are cut at native size (115 px), no redraw. py -I add-tags.py <badges.png> <flat set dir>
import base64, hashlib, io, json, os, shutil, sys
from PIL import Image

src, flat = sys.argv[1], sys.argv[2]
URL = 'https://raw.githubusercontent.com/elaskavaia/bga-mars/main/img/badges.png'
ORDER = ['city', 'event', 'earth', None, 'plant', 'space', 'jovian', 'science', 'building', 'power', 'microbe', 'animal', 'wild']  # .badge.tag_* in the BGA css (index 3 = EventAggro)
raw = open(src, 'rb').read()
sha = hashlib.sha256(raw).hexdigest()
srel = f'sources/{sha[:12]}-badges.png'
shutil.copyfile(src, os.path.join(flat, srel))
sheet = Image.open(src).convert('RGBA')
cell = sheet.width // 13


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


rows = []
rows.append({'id': 'source-sheet-badges', 'name': 'BGA tag badges sheet', 'category': 'source-sheets', **write(sheet, 'source-sheets/badges', 'badges.png, complete original source image', 'Original artwork, extracted without redraw or recolouring; lossless WebP embedded.'),
             'source': srel, 'sourceURL': URL, 'sourceKind': 'BGA-digital-counterpart', 'sourceSHA256': sha, 'note': 'Added 2026-10-29 for the player-panel tag counts (user approved the download).'})
for i, name in enumerate(ORDER):
    if not name: continue
    im = sheet.crop((i * cell, 0, (i + 1) * cell, sheet.height))
    rows.append({'id': f'tag-{name}', 'name': f'{name.title()} tag', 'category': 'markers', **write(im, f'markers/tags/tag-{name}', f'{name} tag', 'Official BGA tag badge, cut at native size; no redraw.'),
                 'source': srel, 'sourceURL': URL, 'sourceKind': 'BGA-digital-counterpart', 'crop': {'left': i * cell, 'top': 0, 'width': cell, 'height': sheet.height}, 'sourceSHA256': sha})
mp = os.path.join(flat, 'data', 'asset-manifest.json')
m = json.load(open(mp, encoding='utf8'))
ids = {r['id'] for r in rows}
m = [r for r in m if r.get('id') not in ids] + rows
json.dump(m, open(mp, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(rows), 'assets added; manifest', len(m))
