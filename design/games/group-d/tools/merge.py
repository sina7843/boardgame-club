# Merge built boards of one group into the live canvas index.
# usage: py -I -X utf8 merge.py <live canvas.json> <group-b|group-c> <title> Slug1 Slug2 ...
import json, re, sys, os
live, grp, title = sys.argv[1], sys.argv[2], sys.argv[3]
slugs = sys.argv[4:]
c = json.load(open(live, encoding='utf-8'))
root = 'E:/AI/Claude/bgv-groupa/canvas/project/'
x = 0
for slug in slugs:
    k = f'{grp}/{slug}.dc.html'
    s = open(root + k, encoding='utf-8').read()
    w, h = map(int, re.search(r'"width":(\d+),"height":(\d+)', s).groups())
    t = re.search(r'<title>([^<]*)</title>', s).group(1).replace('، میز بازی', '') + ': میز، تیره و گوشی'
    c['boards'][k] = {'h': h, 'w': w, 'x': x, 'y': 0, 'page': grp, 'title': t}
    if k not in c['order']: c['order'].append(k)
    x += w + 80
nid = grp.replace('group-', 'g') + '-title'
c['notes'][nid] = {'kind': 'title1', 'maxW': max(1440, x - 80), 'page': grp, 'text': title, 'w': 240, 'x': 0, 'y': -320}
c.setdefault('noteOrder', [])
if nid not in c['noteOrder']: c['noteOrder'].append(nid)
os.makedirs(root, exist_ok=True)
json.dump(c, open(root + 'canvas.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(json.dumps({f'project/{grp}/{s}.dc.html': f'project/{grp}/{s}.dc.html' for s in slugs}, ensure_ascii=False))
