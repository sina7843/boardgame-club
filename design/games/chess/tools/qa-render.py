# Render every chess artboard preview (one Chrome, sequential), record heights, build contact sheets.
# py -I -X utf8 qa-render.py [port]
import json, os, subprocess, sys
from PIL import Image

ROOT = 'E:/AI/Claude/bgv-chess'
PORT = sys.argv[1] if len(sys.argv) > 1 else '8791'
OUT = f'{ROOT}/shots/v4'
os.makedirs(OUT, exist_ok=True)
names = sorted(f[:-8] for f in os.listdir(f'{ROOT}/canvas/build/project/chess') if f.endswith('.dc.html'))
jobs = [{'url': f'http://127.0.0.1:{PORT}/preview/{n}.html', 'out': f'{OUT}/{n}.png',
         'width': 470 if n.startswith('P') else 1520, 'height': 900, 'full': True} for n in names]
json.dump(jobs, open(f'{ROOT}/shots/jobs-v4.json', 'w'))
subprocess.run(['node', 'E:/AI/Claude/bgv-ds21/tools/render.mjs', f'{ROOT}/shots/jobs-v4.json'], check=True)

h = {}
for n in names:
    key = 'SPEC' if n == 'Chess-Spec' else n.split('-')[0]
    h[key] = Image.open(f'{OUT}/{n}.png').height + 20
json.dump(h, open(f'{ROOT}/canvas/build/heights.json', 'w'))

def sheet(files, cols, scale, w, name):
    ims = [Image.open(f'{OUT}/{f}.png') for f in files]
    W = int(w * scale); H = int(max(i.height for i in ims) * scale)
    rows = (len(ims) + cols - 1) // cols
    s = Image.new('RGB', (W * cols, H * rows), 'white')
    for i, im in enumerate(ims):
        s.paste(im.resize((W, int(im.height * scale))), ((i % cols) * W, (i // cols) * H))
    s.save(f'{ROOT}/shots/{name}.png')

D = [n for n in names if n.startswith('D')]
P = [n for n in names if n.startswith('P')]
for k in range(0, len(D), 4):
    sheet(D[k:k + 4], 2, 0.45, 1520, f'qa-d{k // 4 + 1}')
for k in range(0, len(P), 10):
    sheet(P[k:k + 10], 5, 0.55, 470, f'qa-p{k // 10 + 1}')
print('rendered', len(names))
