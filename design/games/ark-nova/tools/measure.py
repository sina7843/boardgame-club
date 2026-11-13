# Real content height of each wrapped artboard: render with min-height removed, find where the page turns body-white.
# py -I measure.py <dir> <id:maxh>...
import os, subprocess, sys
import numpy as np
from PIL import Image
d = sys.argv[1]
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
for spec in sys.argv[2:]:
    sid, mh = spec.split(':'); mh = int(mh)
    src = os.path.join(d, '_qa-' + sid + '.html'); tmp = os.path.join(d, '_m-' + sid + '.html')
    h = open(src, encoding='utf8').read().replace('</head>', '<style>.an{min-height:0!important}body{background:#fff}</style></head>')
    open(tmp, 'w', encoding='utf8').write(h)
    png = os.path.abspath(os.path.join(d, '_m.png'))
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--force-device-scale-factor=1',
                    '--allow-file-access-from-files', '--user-data-dir=' + os.path.abspath(os.path.join(d, '..', '..', '..', 'work', '_chrome')),
                    '--virtual-time-budget=6000', f'--window-size=1440,{mh}', f'--screenshot={png}', 'file:///' + os.path.abspath(tmp).replace(os.sep, '/')],
                   check=True, timeout=120, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    a = np.asarray(Image.open(png).convert('RGB')).astype(int)
    nonwhite = np.where((a < 250).any(2).any(1))[0]
    print(sid, int(nonwhite.max()) + 1 if len(nonwhite) else 0)
    os.remove(tmp); os.remove(png)
