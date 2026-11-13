# Check overlay: real pieces placed with geo.json on the night board. py overlay.py <flat dir> <out.jpg> [S=2000]
import sys, json
from PIL import Image, ImageDraw
F, out = sys.argv[1], sys.argv[2]
S = int(sys.argv[3]) if len(sys.argv) > 3 else 2000
g = json.load(open('E:/AI/Claude/bgv-brass/work/geo.json'))
k = S / 1000
board = Image.open(F + '/boards/board-night.png').convert('RGB').resize((S, S))
def put(path, cx, cy, w, h=None, rot=0):
    im = Image.open(F + '/' + path).convert('RGBA')
    if h is None: h = w * im.size[1] / im.size[0]
    im = im.resize((max(1, int(w * k)), max(1, int(h * k))))
    if rot: im = im.rotate(-rot, expand=True, resample=Image.BICUBIC)
    board.paste(im, (int(cx * k - im.size[0] / 2), int(cy * k - im.size[1] / 2)), im)
cols = ['red', 'yellow', 'purple', 'grey']
i = 0
for lid, (x, y, a) in g['LINKS'].items():
    put(f'links/link-{cols[i % 4]}-{"canal" if i % 2 else "rail"}.png', x, y, g['LINK_W'], g['LINK_H'], a); i += 1
i = 0
for loc, sl in g['SLOTS'].items():
    for (x, y) in sl:
        put(f'industry-tiles/tile-coal-1-{cols[i % 4]}-{"front" if i % 3 else "back"}.png', x, y, g['SLOT'] - 2); i += 1
for m, d in g['MERCHANTS'].items():
    for (x, y) in d['spaces']: put('merchants/merchant-cotton.png', x, y, g['MERCHANT_W'])
    for (x, y) in d['beer']: put('resources/beer-barrel.png', x, y, 13)
for p in range(1, 8):
    for x in g['COAL_X']: put('resources/coal-cube.png', x, 516.7 - (p - 1) * 29.45, g['CUBE'])
for p in range(1, 6):
    for x in g['IRON_X']: put('resources/iron-cube.png', x, 516.7 - (p - 1) * 29.45, g['CUBE'])
d = ImageDraw.Draw(board)
for n, (x, y) in g['TRACK'].items():
    d.ellipse([x * k - 5, y * k - 5, x * k + 5, y * k + 5], outline=(255, 0, 0), width=3)
for j, (x, y) in enumerate(g['ORDER']): put(f'characters/character-{cols[j]}-front.png', x, y, 46)
for (x, y) in g['FRAMES'].values(): put('card-backs/card-back.png', x, y, 76)
board.save(out, quality=82)
