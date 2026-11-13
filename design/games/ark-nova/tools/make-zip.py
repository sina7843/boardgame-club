# Zip a folder with forward-slash entry names (works on every OS): py -I make-zip.py <folder> <out.zip>
import os, sys, zipfile

src, out = sys.argv[1], sys.argv[2]
base = os.path.dirname(os.path.abspath(src))
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, _, files in os.walk(src):
        for f in sorted(files):
            p = os.path.join(root, f)
            z.write(p, os.path.relpath(p, base).replace(os.sep, '/'))
with zipfile.ZipFile(out) as z:
    names = z.namelist()
    bad = [n for n in names if chr(92) in n]
    print(len(names), 'entries; backslash names:', len(bad), '; crc errors:', z.testzip())
print(round(os.path.getsize(out) / 2 ** 20, 1), 'MB')
