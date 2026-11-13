# Reference images for QA: renders each TM reference page with headless Chrome, one at a time (low RAM), and saves
# <id>@<width>.jpg. Chrome's window is at least 500 px wide, so phones render at 500 and the 390 px frame is cropped
# (the frame sits at the right edge of an RTL page). py -I render-ref.py <html dir> <img dir> [ids...]
import os, subprocess, sys
from PIL import Image

html, img = sys.argv[1], sys.argv[2]
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
SCREENS = {  # id: (width, height)
    'TM-Table-Desktop': (1440, 3920), 'TM-Table-Desktop-EN': (1440, 3920), 'TM-Table-Desktop-Dark': (1440, 3920),
    'TM-Setup-Desktop': (1440, 1660), 'TM-Research-Desktop': (1440, 1160),
    'TM-Turn-Mobile': (390, 844), 'TM-Hand-Mobile': (390, 844), 'TM-Actions-Mobile': (390, 844), 'TM-Board-Mobile': (390, 844),
    'TM-Choice-Mobile': (390, 844), 'TM-Research-Mobile': (390, 844), 'TM-Draft-Mobile': (390, 844), 'TM-Setup-Mobile': (390, 844),
    'TM-Actions-Spec': (1440, 2400), 'TM-Board-Spec': (1440, 2240), 'TM-Components': (1440, 4860),
}
os.makedirs(img, exist_ok=True)
profile = os.path.abspath(os.path.join(img, '..', '_chrome'))
for sid in sys.argv[3:] or list(SCREENS):
    w, h = SCREENS[sid]
    png = os.path.join(img, sid + '.tmp.png')
    page = os.path.join(html, sid + '.html')
    if not os.path.exists(page): page = os.path.join(html, '_qa-' + sid + '.html')
    url = 'file:///' + os.path.abspath(page).replace(os.sep, '/')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--disable-extensions',
                    '--force-device-scale-factor=1', '--allow-file-access-from-files', f'--user-data-dir={profile}',
                    '--virtual-time-budget=6000', f'--window-size={max(w, 500)},{h}', f'--screenshot={os.path.abspath(png)}', url],
                   check=True, timeout=120, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    im = Image.open(png).convert('RGB')
    if w < 500:
        im = im.crop((im.width - w, 0, im.width, h))
    out = os.path.join(img, f'{sid}@{w}.jpg')
    im.save(out, 'JPEG', quality=88, optimize=True)
    os.remove(png)
    print(sid, im.size, os.path.getsize(out) // 1024, 'KB')
