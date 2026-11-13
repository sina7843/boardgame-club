# One headless-Chrome screenshot of a local page (low RAM: one at a time). py -I shot.py <html> <out.png> <w> <h>
import os, subprocess, sys
html, out, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
prof = os.path.abspath(os.path.join(os.path.dirname(out), '_chrome'))
url = 'file:///' + os.path.abspath(html).replace(os.sep, '/')
subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--disable-extensions',
                '--force-device-scale-factor=1', '--allow-file-access-from-files', f'--user-data-dir={prof}',
                '--virtual-time-budget=6000', f'--window-size={w},{h}', f'--screenshot={os.path.abspath(out)}', url],
               check=True, timeout=120, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print(out, os.path.getsize(out) // 1024, 'KB')
