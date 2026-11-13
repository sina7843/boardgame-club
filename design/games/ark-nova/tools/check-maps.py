# Overlay engine cells (water=blue, rock=grey, upgrade=magenta, bonus=yellow) on each map at the measured hex centres.
# py -I check-maps.py <art/boards> <mock.json> <out.jpg>
import json, sys
from PIL import Image, ImageDraw
art, mock, out = sys.argv[1:4]
M = json.load(open(mock, encoding='utf8'))['maps']
X0, DX, Y0, DY = 327, 100.6, 132.3, 57.75
tiles = []
for mid in ['A', '0', '1', '2', '3', '4', '5', '6', '7', '8']:
    im = Image.open(f'{art}/map-{mid}.webp').convert('RGB').crop((230, 30, 1250, 920)); d = ImageDraw.Draw(im)
    m = M[mid]
    for col, cells in (((0, 120, 255), m['water']), ((90, 90, 90), m['rock']), ((255, 0, 255), m['upgrade']), ((255, 210, 0), list(m['bonuses'].keys()))):
        for c in cells:
            x, y = map(int, c.split('_')); cx, cy = X0 + DX * x - 230, Y0 + DY * y - 30
            d.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), outline=col, width=5)
    d.text((10, 10), 'map ' + mid, fill=(255, 0, 0))
    tiles.append(im.resize((im.width // 2, im.height // 2)))
W, H = tiles[0].size
sheet = Image.new('RGB', (W * 5, H * 2))
for i, t in enumerate(tiles): sheet.paste(t, ((i % 5) * W, (i // 5) * H))
sheet.save(out, quality=85)
