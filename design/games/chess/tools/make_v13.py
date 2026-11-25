# Build BGV-Chess-Handoff-v1.3 from v1.2 + the 2026-11-24 design update + LiveFix docs + chesslike sounds.
# step 1: py -I -X utf8 make_v13.py stage   (then edit docs by hand)
# step 2: py -I -X utf8 make_v13.py zip
import json, os, re, shutil, subprocess, sys, tempfile, zipfile
from PIL import Image

W = 'E:/AI/Claude/bgv-chess'
V = 'E:/AI/Claude/bgv-chess-v13'
HO = 'X:/Work/01_Clients/دراگون/boardgameverse/Handoff-2026-11'
LF = f'{HO}/BGV-Chess-LiveFix-2026-11-23'
OLD = f'{V}/pkg/BGV-Chess-Handoff-v1.2'
NAME = 'BGV-Chess-Handoff-v1.3'
PKG = f'{V}/pkg/{NAME}'
G = f'{PKG}/repo/design/games/chess'


def stage():
    if os.path.exists(PKG):
        shutil.rmtree(PKG)
    shutil.copytree(OLD, PKG)
    # data + layout + screens.json (from the new build)
    subprocess.run(['node', '--experimental-strip-types', '--no-warnings', f'{W}/tools/gen-handoff-data.mjs', G], check=True, cwd=f'{W}/tools')
    # reference: replace the 44 built artboards, keep D35-prompts (dc + img) from v1.2
    shutil.copytree(f'{W}/canvas/project/ds/bgv', f'{G}/reference/html/ds/bgv', dirs_exist_ok=True)
    for f in sorted(os.listdir(f'{W}/canvas/build/project/chess')):
        n = f[:-8]
        Image.open(f'{W}/shots/v13/{n}.png').convert('RGB').save(f'{G}/reference/img/{n}.jpg', quality=86, optimize=True)
        shutil.copy(f'{W}/canvas/build/project/chess/{f}', f'{G}/reference/dc/{f}')
        h = open(f'{W}/preview/{n}.html', encoding='utf8').read()
        h = h.replace('/canvas/project/ds/bgv/', 'ds/bgv/')
        h = re.sub(r'/canvas2/assets/classic/classic-([wb])-([kqrbnp])\.webp', r'../../art/pieces/classic/\1-\2.webp', h)
        open(f'{G}/reference/html/{n}.html', 'w', encoding='utf8').write(h)
    # tools
    for f in ['lib.mjs', 'css.mjs', 'scenes.mjs', 'parts.mjs', 'desktop.mjs', 'phone.mjs', 'spec.mjs', 'build.mjs', 'gen-handoff-data.mjs', 'qa-render.py']:
        shutil.copy(f'{W}/tools/{f}', f'{G}/tools/{f}')
    shutil.copy(f'{V}/make_v13.py', f'{G}/tools/make_v13.py')
    # LiveFix docs + evidence
    os.makedirs(f'{G}/livefix', exist_ok=True)
    for f in ['CHESS-FIX-SPEC.md', 'CHESS-LIVE-TEST.md']:
        shutil.copy(f'{LF}/{f}', f'{G}/livefix/{f}')
    shutil.copytree(f'{LF}/screenshots', f'{G}/livefix/screenshots', dirs_exist_ok=True)
    # sounds: the approved set only
    os.makedirs(f'{G}/sounds', exist_ok=True)
    shutil.copytree(f'{LF}/sounds/chesslike', f'{G}/sounds/chesslike', dirs_exist_ok=True)
    os.makedirs(f'{G}/tools/sounds', exist_ok=True)
    for f in ['synth_chesslike.py', 'analyze_files.py', 'compare.py', 'chesslike-vs-reference.txt']:
        shutil.copy(f'{LF}/sounds/{f}', f'{G}/tools/sounds/{f}')
    shutil.copy(f'{V}/sounds-preview.html', f'{G}/sounds/preview.html')
    # Claude Code command
    shutil.copy(f'{LF}/.claude/commands/bgv-chess-livefix.md', f'{PKG}/repo/.claude/commands/bgv-chess-livefix.md')
    # GPT prompt for bot faces
    os.makedirs(f'{G}/prompts', exist_ok=True)
    shutil.copy(f'{V}/GPT-bot-avatars.md', f'{G}/prompts/GPT-bot-avatars.md')
    print('staged', PKG)


def refresh():
    """Re-copy built artboards, data and tools into the staged package without touching the edited docs."""
    subprocess.run(['node', '--experimental-strip-types', '--no-warnings', f'{W}/tools/gen-handoff-data.mjs', G], check=True, cwd=f'{W}/tools')
    for f in sorted(os.listdir(f'{W}/canvas/build/project/chess')):
        n = f[:-8]
        Image.open(f'{W}/shots/v13/{n}.png').convert('RGB').save(f'{G}/reference/img/{n}.jpg', quality=86, optimize=True)
        shutil.copy(f'{W}/canvas/build/project/chess/{f}', f'{G}/reference/dc/{f}')
        h = open(f'{W}/preview/{n}.html', encoding='utf8').read()
        h = h.replace('/canvas/project/ds/bgv/', 'ds/bgv/')
        h = re.sub(r'/canvas2/assets/classic/classic-([wb])-([kqrbnp])\.webp', r'../../art/pieces/classic/\1-\2.webp', h)
        open(f'{G}/reference/html/{n}.html', 'w', encoding='utf8').write(h)
    for f in ['lib.mjs', 'css.mjs', 'scenes.mjs', 'parts.mjs', 'desktop.mjs', 'phone.mjs', 'spec.mjs', 'build.mjs', 'gen-handoff-data.mjs', 'qa-render.py']:
        shutil.copy(f'{W}/tools/{f}', f'{G}/tools/{f}')
    shutil.copy(f'{V}/make_v13.py', f'{G}/tools/make_v13.py')
    print('refreshed')


def zip_and_verify():
    ZIP = f'{HO}/{NAME}.zip'
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
    tmp = tempfile.mkdtemp(dir=f'{V}/pkg')
    with zipfile.ZipFile(ZIP) as z:
        assert not [n for n in z.namelist() if '\\' in n]
        assert z.testzip() is None
        z.extractall(tmp)
    root = f'{tmp}/{NAME}/repo/design/games/chess'
    errors = []
    for f in ['HANDOFF.md', 'ENGINE.md', 'RULES.md', 'RULES-TEST-REPORT.md', 'COMPONENTS.md', 'QA-CHECKLIST.md', 'CHANGELOG.md', 'layout.json', 'livefix/CHESS-FIX-SPEC.md', 'livefix/CHESS-LIVE-TEST.md', 'sounds/preview.html', 'prompts/GPT-bot-avatars.md']:
        if not os.path.exists(f'{root}/{f}'):
            errors.append('missing ' + f)
    for f in os.listdir(f'{root}/data'):
        json.load(open(f'{root}/data/{f}', encoding='utf8'))
    scr = json.load(open(f'{root}/reference/screens.json', encoding='utf8'))['screens']
    for s in scr:
        for k in ['img', 'html', 'dc']:
            if not os.path.exists(f'{root}/{s[k]}'):
                errors.append('missing ' + s[k])
    for a in json.load(open(f'{root}/data/art-index.json', encoding='utf8'))['pieces']:
        if not os.path.exists(f'{root}/{a["file"]}'):
            errors.append('missing ' + a['file'])
    for s in scr:
        html = open(f'{root}/{s["html"]}', encoding='utf8').read()
        for u in re.findall(r'(?:href|src)="([^"#:]+)"|url\("((?:\.\./|ds/)[^"]+)"\)', html):
            u = u[0] or u[1]
            if not os.path.exists(os.path.normpath(os.path.join(f'{root}/reference/html', u))):
                errors.append(f'{s["id"]}: broken {u}')
    ev = ['move-self', 'move-opponent', 'capture', 'castle', 'move-check', 'promote', 'game-start', 'game-end', 'low-time', 'illegal', 'premove', 'notify']
    for e in ev:
        for ext in ['mp3', 'ogg']:
            if not os.path.exists(f'{root}/sounds/chesslike/{e}.{ext}'):
                errors.append(f'missing sound {e}.{ext}')
    # every screenshot named in the LiveFix docs exists
    for d in ['livefix/CHESS-FIX-SPEC.md', 'livefix/CHESS-LIVE-TEST.md']:
        for m in set(re.findall(r'`((?:m|ux)\d\d)`', open(f'{root}/{d}', encoding='utf8').read())):
            if not any(f.startswith(m) for f in os.listdir(f'{root}/livefix/screenshots')):
                errors.append(f'{d}: screenshot {m} missing')
    for c in ['commands/bgv-chess-implement.md', 'commands/bgv-chess-qa.md', 'commands/bgv-chess-fix.md', 'commands/bgv-chess-livefix.md', 'agents/bgv-chess-qa.md']:
        if not os.path.exists(f'{tmp}/{NAME}/repo/.claude/{c}'):
            errors.append('missing .claude/' + c)
    shutil.rmtree(tmp)
    print(f'{len(files)} entries, {os.path.getsize(ZIP) / 1048576:.1f} MB, screens {len(scr)}')
    print('VERIFY', 'PASS' if not errors else 'FAIL', *errors[:30], sep='\n')


if __name__ == '__main__':
    {'stage': stage, 'refresh': refresh, 'zip': zip_and_verify}[sys.argv[1]]()
