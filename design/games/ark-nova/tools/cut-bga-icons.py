# Cut every .icon-* cell of the local BGA sprite img__icons.png (2048x2048) using its background-position/size rule.
# Cell side = 2048*100/size (square guess), then trimmed to its alpha box. py -I cut-bga-icons.py <arknova.css> <icons.png> <out>
import re, sys, os
from PIL import Image
css, png, out = sys.argv[1:4]
S = Image.open(png).convert('RGBA'); W = S.width
t = open(css, encoding='utf8').read()
rx = re.compile(r'\.(icon-[a-z0-9-]+)\{background-position:([\d.]+)% ([\d.]+)%;background-size:([\d.]+)%\}')
seen = {}
for name, px, py_, bs in rx.findall(t):
    if name in seen: continue
    cw = W * 100 / float(bs)
    x = (W - cw) * float(px) / 100; y = (W - cw) * float(py_) / 100
    ratio = 1.0
    m = re.search(r'\.' + name + r'[,{][^}]*?height:([\d.]+)(em|px)[^}]*?width:([\d.]+)(em|px)', t)
    if m and m.group(2) == m.group(4): ratio = float(m.group(1)) / float(m.group(3))
    ch = cw * ratio
    y = (W - ch) * float(py_) / 100
    box = (round(x), round(y), round(x + cw), round(y + ch))
    im = S.crop(box); bb = im.getbbox()
    if not bb: continue
    im = im.crop(bb)
    seen[name] = box
    im.save(os.path.join(out, name + '.png'))
print(len(seen))
