# Reference images for QA: renders each Ark Nova reference page with headless Chrome, one at a time (low RAM), and
# saves <id>@<width>.jpg. py -I render-ref.py <html dir> <img dir> [ids...]
import os, subprocess, sys
from PIL import Image
html, img = sys.argv[1], sys.argv[2]
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
SCREENS = {'AN-Table-Desktop': (1440, 3380), 'AN-Table-Desktop-Dark': (1440, 3380), 'AN-Actions-Desktop': (1440, 2900),
           'AN-Phases-Desktop': (1440, 1780), 'AN-Turn-Mobile': (1816, 960), 'AN-Flows-Mobile': (1816, 960),
           'AN-Spec': (1440, 2820), 'AN-Components': (1440, 6510)}
os.makedirs(img, exist_ok=True)
prof = os.path.abspath(os.path.join(img, '..', '..', '..', '..', '..', '..', '..', 'work', '_chrome'))
for sid in sys.argv[3:] or list(SCREENS):
    w, h = SCREENS[sid]
    png = os.path.abspath(os.path.join(img, sid + '.tmp.png'))
    url = 'file:///' + os.path.abspath(os.path.join(html, sid + '.html')).replace(os.sep, '/')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--disable-extensions',
                    '--force-device-scale-factor=1', '--allow-file-access-from-files', f'--user-data-dir={prof}',
                    '--virtual-time-budget=8000', f'--window-size={w},{h}', f'--screenshot={png}', url],
                   check=True, timeout=180, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    im = Image.open(png).convert('RGB')
    out = os.path.join(img, f'{sid}@{w}.jpg')
    im.save(out, 'JPEG', quality=86, optimize=True); os.remove(png)
    print(sid, im.size, os.path.getsize(out) // 1024, 'KB')
