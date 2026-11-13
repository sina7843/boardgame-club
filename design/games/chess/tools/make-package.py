# Build BGV-Chess-Handoff-v1.0 (+ zip) and verify it from a fresh unzip.
# py -I -X utf8 make-package.py
import json, os, re, shutil, subprocess, zipfile, tempfile
from PIL import Image

W = 'E:/AI/Claude/bgv-chess'
NAME = 'BGV-Chess-Handoff-v1.0'
PKG = f'{W}/package/{NAME}'
G = f'{PKG}/repo/design/games/chess'
ART = 'X:/Work/01_Clients/دراگون/boardgameverse/Games Redesign/chess'
if os.path.exists(PKG):
    shutil.rmtree(PKG)
for d in ['art/pieces/classic/png', 'art/boards', 'data', 'reference/img', 'reference/html', 'reference/dc', 'reference/rules', 'tests', 'tools']:
    os.makedirs(f'{G}/{d}', exist_ok=True)
os.makedirs(f'{PKG}/repo/.claude/commands', exist_ok=True)
os.makedirs(f'{PKG}/repo/.claude/agents', exist_ok=True)

# docs
for f in ['HANDOFF', 'ENGINE', 'RULES', 'COMPONENTS', 'QA-CHECKLIST', 'CHANGELOG']:
    shutil.copy(f'{W}/package/docs/{f}.md', f'{G}/{f}.md')
shutil.copy(f'{W}/RULES-TEST-REPORT.md', f'{G}/RULES-TEST-REPORT.md')
for f in ['bgv-chess-implement', 'bgv-chess-qa', 'bgv-chess-fix']:
    shutil.copy(f'{W}/package/commands/{f}.md', f'{PKG}/repo/.claude/commands/{f}.md')
shutil.copy(f'{W}/package/commands/agent-bgv-chess-qa.md', f'{PKG}/repo/.claude/agents/bgv-chess-qa.md')

# data + layout + screens.json
subprocess.run(['node', '--experimental-strip-types', '--no-warnings', f'{W}/tools/gen-handoff-data.mjs', G], check=True, cwd=f'{W}/tools')

# art: classic (webp 256 + png 512), other sets (svg), boards (svg)
for f in os.listdir(f'{W}/canvas2/assets/classic'):
    shutil.copy(f'{W}/canvas2/assets/classic/{f}', f'{G}/art/pieces/classic/{f.replace("classic-", "")}')
for c in 'wb':
    for t in 'kqrbnp':
        shutil.copy(f'{ART}/pieces/classic/{c}-{t}.png', f'{G}/art/pieces/classic/png/{c}-{t}.png')
for s in ['flat', 'walnut', 'clay', 'persian', 'glass', 'neon']:
    os.makedirs(f'{G}/art/pieces/{s}', exist_ok=True)
    for c in 'wb':
        for t in 'kqrbnp':
            shutil.copy(f'{ART}/images/pieces/{s}/{c}-{t}.svg', f'{G}/art/pieces/{s}/{c}-{t}.svg')
shutil.copytree(f'{ART}/images/boards', f'{G}/art/boards', dirs_exist_ok=True)

# reference: images (jpg), offline html (+ DS copy), canvas sources
DS = f'{W}/canvas/project/ds/bgv'
shutil.copytree(DS, f'{G}/reference/html/ds/bgv', dirs_exist_ok=True)
for f in sorted(os.listdir(f'{W}/canvas/build/project/chess')):
    n = f[:-8]
    Image.open(f'{W}/shots/v4/{n}.png').convert('RGB').save(f'{G}/reference/img/{n}.jpg', quality=86, optimize=True)
    shutil.copy(f'{W}/canvas/build/project/chess/{f}', f'{G}/reference/dc/{f}')
    h = open(f'{W}/preview/{n}.html', encoding='utf8').read()
    h = h.replace('/canvas/project/ds/bgv/', 'ds/bgv/')
    h = re.sub(r'/canvas2/assets/classic/classic-([wb])-([kqrbnp])\.webp', r'../../art/pieces/classic/\1-\2.webp', h)
    open(f'{G}/reference/html/{n}.html', 'w', encoding='utf8').write(h)
open(f'{G}/reference/rules/FIDE-Laws.url', 'w', encoding='utf8').write('[InternetShortcut]\nURL=https://handbook.fide.com/chapter/E012023\n')

# tests + tools
t = open(f'{W}/engine/rules-test.mjs', encoding='utf8').read()
t = '// Point these two imports at games/chess/src/rules.ts and pgn.ts of the repo before running.\n' + t
open(f'{G}/tests/rules-test.mjs', 'w', encoding='utf8').write(t)
for f in ['lib.mjs', 'css.mjs', 'scenes.mjs', 'parts.mjs', 'desktop.mjs', 'phone.mjs', 'spec.mjs', 'build.mjs', 'gen-handoff-data.mjs', 'qa-render.py', 'make-package.py']:
    shutil.copy(f'{W}/tools/{f}', f'{G}/tools/{f}')
open(f'{G}/tools/README.md', 'w', encoding='utf8').write("""# ابزار بازسازی (برای طراح؛ تیم فنی لازم ندارد)

- `build.mjs`: همهٔ آرت‌بوردها را از `scenes.mjs` می‌سازد. وضعیت‌ها با موتور شطرنج بازی می‌شوند، پس حرکت غیرقانونی خطای ساخت است.
- `gen-handoff-data.mjs`: `layout.json`، `data/*.json` و `reference/screens.json` را می‌سازد.
- `qa-render.py`: همهٔ آرت‌بوردها را با یک Chrome رندر می‌کند و برگه‌های تماس QA را می‌سازد.
- `make-package.py`: همین بسته و زیپ را می‌سازد و از یک باز کردن تازه چک می‌کند.

مسیرها مال دستگاه طراح‌اند (`E:/AI/Claude/bgv-chess`).
""")

# zip (forward slashes) + verify from a fresh unzip
ZIP = f'{W}/package/{NAME}.zip'
if os.path.exists(ZIP):
    os.remove(ZIP)
files = []
with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, _, fs in os.walk(PKG):
        for f in fs:
            full = os.path.join(root, f)
            arc = NAME + '/' + os.path.relpath(full, PKG).replace('\\', '/')
            z.write(full, arc)
            files.append(arc)

tmp = tempfile.mkdtemp(dir=f'{W}/package')
with zipfile.ZipFile(ZIP) as z:
    bad = [n for n in z.namelist() if '\\' in n]
    assert not bad, bad
    assert z.testzip() is None
    z.extractall(tmp)
root = f'{tmp}/{NAME}/repo/design/games/chess'
errors = []
for f in ['HANDOFF.md', 'ENGINE.md', 'RULES.md', 'RULES-TEST-REPORT.md', 'COMPONENTS.md', 'QA-CHECKLIST.md', 'CHANGELOG.md', 'layout.json']:
    if not os.path.exists(f'{root}/{f}'):
        errors.append('missing ' + f)
for f in os.listdir(f'{root}/data'):
    json.load(open(f'{root}/data/{f}', encoding='utf8'))
scr = json.load(open(f'{root}/reference/screens.json', encoding='utf8'))['screens']
for s in scr:
    for k in ['img', 'html', 'dc']:
        if not os.path.exists(f'{root}/{s[k]}'):
            errors.append('missing ' + s[k])
art = json.load(open(f'{root}/data/art-index.json', encoding='utf8'))['pieces']
for a in art:
    if not os.path.exists(f'{root}/{a["file"]}'):
        errors.append('missing ' + a['file'])
for s in scr:   # every local url in the offline html must resolve
    html = open(f'{root}/{s["html"]}', encoding='utf8').read()
    for u in re.findall(r'(?:href|src)="([^"#:]+)"|url\("((?:\.\./|ds/)[^"]+)"\)', html):
        u = u[0] or u[1]
        if not os.path.exists(os.path.normpath(os.path.join(f'{root}/reference/html', u))):
            errors.append(f'{s["id"]}: broken {u}')
for c in ['commands/bgv-chess-implement.md', 'commands/bgv-chess-qa.md', 'commands/bgv-chess-fix.md', 'agents/bgv-chess-qa.md']:
    if not os.path.exists(f'{tmp}/{NAME}/repo/.claude/{c}'):
        errors.append('missing .claude/' + c)
shutil.rmtree(tmp)
size = os.path.getsize(ZIP) / 1048576
print(f'{len(files)} entries, {size:.1f} MB, screens {len(scr)}, pieces {len(art)}')
print('VERIFY', 'PASS' if not errors else 'FAIL', *errors[:20], sep='\n')
