# Reference images for QA, one headless Chrome at a time (low RAM). py -I render-ref.py <html dir> <img dir>
# BR-Desktop: full at 1440, the table part at 1024 and 768 (responsive); BR-Mobile-Spec at 2580, and each phone
# (§25-§30) cut out at 390x844 from it (positions read from the page with --dump-dom).
import json, os, re, subprocess, sys
from PIL import Image

html, img = sys.argv[1], sys.argv[2]
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
os.makedirs(img, exist_ok=True)
profile = os.path.abspath(os.path.join(img, '..', '_chrome'))
base = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--disable-extensions', '--force-device-scale-factor=1', '--allow-file-access-from-files', f'--user-data-dir={profile}', '--virtual-time-budget=6000']
url = lambda p: 'file:///' + os.path.abspath(p).replace(os.sep, '/')

def shot(page, out, w, h, q=86):
    png = out + '.tmp.png'
    subprocess.run([CHROME, *base, f'--window-size={w},{h}', f'--screenshot={os.path.abspath(png)}', url(page)], check=True, timeout=240, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    im = Image.open(png).convert('RGB')
    os.remove(png)
    im.save(out, 'JPEG', quality=q, optimize=True)
    print(os.path.basename(out), im.size, os.path.getsize(out) // 1024, 'KB')
    return im

desk = os.path.join(html, 'BR-Desktop.html')
mob = os.path.join(html, 'BR-Mobile-Spec.html')
shot(desk, os.path.join(img, 'BR-Desktop@1440.jpg'), 1440, 9360, 82)
shot(desk, os.path.join(img, 'BR-Desktop-table@1024.jpg'), 1024, 3400)
shot(desk, os.path.join(img, 'BR-Desktop-table@768.jpg'), 768, 3600)
spec = shot(mob, os.path.join(img, 'BR-Mobile-Spec@2580.jpg'), 2580, 3300, 84)

# phone frames: probe their rectangles
src = open(mob, encoding='utf-8').read()
probe = src.replace('</body>', "<script>addEventListener('load',()=>{document.body.setAttribute('data-probe',JSON.stringify([...document.querySelectorAll('.bdr-dev')].map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y)]})))})</script></body>")
tmp = os.path.join(html, '_probe.html')
open(tmp, 'w', encoding='utf-8').write(probe)
dom = subprocess.run([CHROME, *base, '--window-size=2580,3300', '--dump-dom', url(tmp)], capture_output=True, timeout=240).stdout.decode('utf-8', 'ignore')
os.remove(tmp)
rects = json.loads(re.search(r'data-probe="([^"]*)"', dom).group(1).replace('&quot;', '"'))
for no, (x, y) in zip(range(25, 31), rects):
    out = os.path.join(img, f'BR-Phone-{no}@390.jpg')
    spec.crop((x, y, x + 390, y + 844)).save(out, 'JPEG', quality=88, optimize=True)
    print(os.path.basename(out))
