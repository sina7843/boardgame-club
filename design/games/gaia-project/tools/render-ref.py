# Reference images for QA: renders each Gaia reference page with headless Chrome, one at a time (low RAM),
# trims the empty page bottom and saves <id>@<width>.jpg. py -I render-ref.py <html dir> <img dir> <profile dir>
import os, subprocess, sys
from PIL import Image, ImageChops

html, img, profile = sys.argv[1:4]
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
SCREENS = {  # id: (width, window height, trim the bottom)
    'Gaia-Table-Desktop': (1440, 2700, False), 'Gaia-Table-Desktop-EN': (1440, 2700, False),
    'Gaia-Table-Desktop-Dark': (1440, 2700, False),
    'Gaia-Turn-Mobile': (390, 844, False), 'Gaia-Tech-Mobile': (390, 844, False),
    'Gaia-Actions-Mobile': (390, 844, False), 'Gaia-Board-Mobile': (390, 844, False),
    'Gaia-Scoring-Mobile': (390, 844, False), 'Gaia-Leech-Mobile': (390, 844, False),
    'GameKit-Spec': (1440, 3000, True), 'Gaia-Actions-Spec': (1440, 3600, True), 'Gaia-Factions': (1440, 3800, True),
}
os.makedirs(img, exist_ok=True)
only = sys.argv[4:] or list(SCREENS)
for sid in only:
    w, h, trim = SCREENS[sid]
    png = os.path.join(img, sid + '.tmp.png')
    url = 'file:///' + os.path.abspath(os.path.join(html, 'gaia', sid + '.html')).replace('\\', '/')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
                    '--disable-extensions', '--force-device-scale-factor=1', '--allow-file-access-from-files',
                    f'--user-data-dir={os.path.abspath(profile)}', '--virtual-time-budget=6000', f'--window-size={w},{h}',
                    f'--screenshot={os.path.abspath(png)}', url], check=True, timeout=120,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    im = Image.open(png).convert('RGB')
    if trim:  # cut the flat page colour below the content (+40px margin)
        bg = Image.new('RGB', im.size, im.getpixel((2, im.height - 2)))
        box = ImageChops.difference(im, bg).getbbox()
        if box: im = im.crop((0, 0, w, min(im.height, box[3] + 40)))
    out = os.path.join(img, f'{sid}@{w}.jpg')
    im.save(out, 'JPEG', quality=90, optimize=True)
    os.remove(png)
    print(sid, im.size, os.path.getsize(out) // 1024, 'KB')
