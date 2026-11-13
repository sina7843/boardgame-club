# Fresh-unzip check of the handoff zip: forward-slash entries, CRC, and every path the package names resolves
# (reference pages' src/href/url, content-id-map, cards, art-index, screens.json, paths written in the docs).
# py -I -X utf8 verify-zip.py <zip> <empty temp dir>
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
D = os.path.join(root, 'repo', 'design', 'games', 'blood-rage')
ART = os.path.join(D, 'art')
missing = []

def need(base, rel, why):
    if not os.path.exists(os.path.normpath(os.path.join(base, rel))):
        missing.append(f'{why}: {rel}')

# reference pages
hdir = os.path.join(D, 'reference', 'html', 'blood-rage')
pages = [f for f in os.listdir(hdir) if f.endswith('.html')]
for f in pages:
    h = open(os.path.join(hdir, f), encoding='utf8').read()
    for m in set(re.findall(r'(?:src|href)="(\.\.?/[^"]+)"', h) + re.findall(r'url\((\.\.?/[^)]+)\)', h)):
        need(hdir, m, 'html/' + f)
# data maps: every .webp string resolves under art/
def walk(v):
    if isinstance(v, dict):
        for x in v.values(): yield from walk(x)
    elif isinstance(v, list):
        for x in v: yield from walk(x)
    elif isinstance(v, str):
        for m in re.findall(r'([a-z0-9-]+/[A-Za-z0-9_.-]+\.webp)', v): yield m
for f in ['data/content-id-map.json', 'data/cards.json']:
    for p in walk(json.load(open(os.path.join(D, f), encoding='utf8'))): need(ART, p, f)
for k in json.load(open(os.path.join(D, 'data', 'art-index.json'), encoding='utf8')): need(ART, k, 'art-index')
for s in json.load(open(os.path.join(D, 'reference', 'screens.json'), encoding='utf8'))['screens']:
    for r in s['reference']: need(os.path.join(D, 'reference'), r, 'screens.json')
# paths written in the docs
docs = [os.path.join(D, f) for f in ['HANDOFF.md', 'ENGINE.md', 'COMPONENTS.md', 'QA-CHECKLIST.md']] + [os.path.join(root, 'START-HERE.md')]
for f in docs:
    t = open(f, encoding='utf8').read()
    for p in set(re.findall(r'`((?:data|reference|art)/[A-Za-z0-9_./@-]+\.(?:json|pdf|jpg|webp|html))`', t)):
        need(D, p.replace('<id>', ''), os.path.basename(f))
    for p in set(re.findall(r'`(repo/[A-Za-z0-9_./-]+\.(?:md|json))`', t)): need(root, p, os.path.basename(f))
for f in ['bgv-bloodrage-implement.md', 'bgv-bloodrage-qa.md', 'bgv-bloodrage-fix.md']: need(os.path.join(root, 'repo', '.claude', 'commands'), f, 'command')
need(os.path.join(root, 'repo', '.claude', 'agents'), 'bgv-bloodrage-qa.md', 'agent')
for f in ['HANDOFF.md', 'ENGINE.md', 'COMPONENTS.md', 'QA-CHECKLIST.md', 'CHANGELOG.md', 'layout.json']: need(D, f, 'package')
n_art = sum(len(fs) for _, _, fs in os.walk(ART))
print(len(pages), 'pages checked;', n_art, 'art files;', 'missing:', len(missing))
for m in missing[:40]: print('  MISSING', m)
sys.exit(1 if missing or back or bad else 0)
