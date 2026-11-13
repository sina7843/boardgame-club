# List each flat SVG: viewBox and embedded image pixel size.
import sys, re, base64, io, os, json
from PIL import Image
root = sys.argv[1]
out = {}
for d, _, fs in os.walk(root):
    if any(x in d for x in ('sources','thumbnails','comparison','reproduction','data')): continue
    for f in fs:
        if not f.endswith('.svg'): continue
        p = os.path.join(d, f); t = open(p, encoding='utf-8').read()
        vb = re.search(r'viewBox="([^"]+)"', t)
        m = re.search(r'data:image/(\w+);base64,([A-Za-z0-9+/=]+)', t)
        wh = None
        if m:
            im = Image.open(io.BytesIO(base64.b64decode(m.group(2)))); wh = im.size
        out[os.path.relpath(p, root).replace(os.sep,'/')] = {'vb': vb.group(1) if vb else None, 'px': wh, 'kb': os.path.getsize(p)//1024}
json.dump(out, open(sys.argv[2],'w'), indent=0)
from collections import defaultdict
g = defaultdict(list)
for k,v in out.items(): g[k.split('/')[0]].append((k,v))
for k, lst in sorted(g.items()):
    pxs = [v['px'] for _,v in lst if v['px']]
    print(k, len(lst), 'px e.g.', lst[0][1]['px'], 'min', min(pxs, key=lambda x:x[0]*x[1]) if pxs else None, 'vb', lst[0][1]['vb'])
