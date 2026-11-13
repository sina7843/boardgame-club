# Fresh-unzip check of the handoff zip: forward-slash entries, CRC, and every path the package names resolves
# (reference pages' src/href/url, content-id-map, art-index, layout, screens.json, art/ paths in the docs).
# py -I verify-zip.py <zip> <empty temp dir>
import json, os, re, shutil, sys, zipfile

zp, tmp = sys.argv[1], sys.argv[2]
shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
with zipfile.ZipFile(zp) as z:
    names = z.namelist()
    back = [n for n in names if '\\' in n]
    bad = z.testzip()
    z.extractall(tmp)
print(len(names), 'entries; backslash:', len(back), '; crc errors:', bad)
root = os.path.join(tmp, names[0].split('/')[0])
D = os.path.join(root, 'repo', 'design', 'games', 'ark-nova')
missing = []

def need(base, rel, why):
    if not os.path.exists(os.path.normpath(os.path.join(base, rel))):
        missing.append(f'{why}: {rel}')

# reference pages
hdir = os.path.join(D, 'reference', 'html', 'an')
pages = [f for f in os.listdir(hdir) if f.endswith('.html')]
for f in pages:
    h = open(os.path.join(hdir, f), encoding='utf8').read()
    for m in re.findall(r'(?:src|href)="(\.\.?/[^"]+)"', h) + re.findall(r'url\((\.\.?/[^)]+)\)', h):
        need(hdir, m, 'html/' + f)
# data maps
def walk(v):
    if isinstance(v, dict):
        for x in v.values(): yield from walk(x)
    elif isinstance(v, list):
        for x in v: yield from walk(x)
    elif isinstance(v, str) and v.startswith('art/') and not re.search(r'[<>{}|*]', v):
        yield v
for f in ['data/content-id-map.json', 'data/cards.json', 'layout.json']:
    for p in walk(json.load(open(os.path.join(D, f), encoding='utf8'))): need(D, p, f)
for row in json.load(open(os.path.join(D, 'data', 'art-index.json'), encoding='utf8')): need(D, row['path'], 'art-index')
for s in json.load(open(os.path.join(D, 'reference', 'screens.json'), encoding='utf8'))['screens']:
    for r in s['reference']: need(os.path.join(D, 'reference'), r, 'screens.json')
    need(hdir, s['id'] + '.html', 'screens.json html'); need(os.path.join(D, 'reference', 'dc'), s['id'] + '.dc.html', 'screens.json dc')
# art paths and package paths written in the docs
for f in ['HANDOFF.md', 'COMPONENTS.md', 'QA-CHECKLIST.md']:
    t = open(os.path.join(D, f), encoding='utf8').read()
    for p in set(re.findall(r'`(art/[A-Za-z0-9_./-]+\.webp)`', t)): need(D, p, f)
    for p in set(re.findall(r'`((?:data|reference)/[A-Za-z0-9_./-]+\.(?:json|pdf))`', t)): need(D, p, f)
for f in ['bgv-arknova-implement.md', 'bgv-arknova-qa.md', 'bgv-arknova-fix.md']: need(os.path.join(root, 'repo', '.claude', 'commands'), f, 'command')
need(os.path.join(root, 'repo', '.claude', 'agents'), 'bgv-arknova-qa.md', 'agent')
print(len(pages), 'pages checked;', 'missing:', len(missing))
for m in missing[:40]: print('  MISSING', m)
sys.exit(1 if missing or back or bad else 0)
