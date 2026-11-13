# Assemble the handoff folder (run gen-handoff-data.js and render-ref.py first). py -I -X utf8 make-package.py
import json, os, shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RTU = r'X:\Work\01_Clients\دراگون\boardgameverse\Games Redesign\blood-rage\ready to use'
PKG = os.path.join(ROOT, 'package', 'BGV-BloodRage-Handoff-v1.0')
G = os.path.join(PKG, 'repo', 'design', 'games', 'blood-rage')
J = lambda *p: os.path.join(*p)

def cp(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)

# docs
cp(J(ROOT, 'docs', 'START-HERE.md'), J(PKG, 'START-HERE.md'))
for f in ['HANDOFF', 'ENGINE', 'COMPONENTS', 'QA-CHECKLIST', 'CHANGELOG']:
    cp(J(ROOT, 'docs', 'design', f + '.md'), J(G, f + '.md'))
for kind in ['commands', 'agents']:
    for f in os.listdir(J(ROOT, 'docs', 'claude', kind)):
        cp(J(ROOT, 'docs', 'claude', kind, f), J(PKG, 'repo', '.claude', kind, f))

# art (web) + index, publisher data
for cat in os.listdir(J(ROOT, 'art')):
    if os.path.isdir(J(ROOT, 'art', cat)):
        shutil.copytree(J(ROOT, 'art', cat), J(G, 'art', cat), dirs_exist_ok=True)
idx = json.load(open(J(ROOT, 'art', 'art-index.json')))
json.dump({k + '.webp': v for k, v in idx.items()}, open(J(G, 'data', 'art-index.json'), 'w'), indent=1)
for src, dst in [('asset-manifest.json', 'publisher-asset-manifest.json'), ('component-coverage.json', 'publisher-component-coverage.json'), ('bga-materials.json', 'publisher-bga-materials.json'), ('source-provenance.json', 'publisher-source-provenance.json')]:
    cp(J(RTU, 'data', src), J(G, 'data', dst))

# reference: images, offline html (+ds, assets), canvas sources, rulebook, screens.json
shutil.copytree(J(ROOT, 'work', 'ref', 'img'), J(G, 'reference', 'img'), dirs_exist_ok=True)
shutil.copytree(J(ROOT, 'work', 'ref', 'html'), J(G, 'reference', 'html'), dirs_exist_ok=True)
for f in ['BR-Desktop.dc.html', 'BR-Mobile-Spec.dc.html']:
    cp(J(ROOT, 'canvas', 'build', 'project', 'blood-rage', f), J(G, 'reference', 'dc', f))
cp(J(ROOT, 'rules-dl', 'BLR001-Rulebook.pdf'), J(G, 'reference', 'rules', 'BLR001-Rulebook.pdf'))
S = lambda id, w, h, kind, state, img, html=None: {'id': id, 'width': w, 'height': h, 'theme': 'light', 'lang': 'fa', 'kind': kind, 'state': state, 'reference': [f'img/{img}'] + ([f'html/blood-rage/{html}.html', f'dc/{html}.dc.html'] if html else [])}
phones = {25: 'Invade with auto-zoom, Angerboda picked, Troll effect in the dock (main)', 26: 'Actions sheet with BGA labels (main)', 27: "Gods' Gifts pick 3 of 6", 28: 'Battle: figure STR, secret card (battle)', 29: 'My clan sheet, 3 columns left to right (main)', 30: 'End of Age 2 sheet: quest, Ragnarök, Valhalla (afterBattle)'}
screens = {
    'note': 'Canvas page «۱۶. پایلوت BGA: بلاد ریج» (https://claude.ai/artifact/61m4wUqVQ373pFLzuqsier). state = key in data/mock-state.json. BR-Desktop is responsive: compare the table at 1440, 1024 and 768. kind spec = not compared pixel by pixel.',
    'screens': [S('BR-Desktop', 1440, 9360, 'screen', 'main (table) + frames §2, §20-§24', 'BR-Desktop@1440.jpg', 'BR-Desktop'),
                S('BR-Desktop', 1024, 3400, 'screen', 'main; player boards in a row on top, clan sheets 3 columns', 'BR-Desktop-table@1024.jpg', 'BR-Desktop'),
                S('BR-Desktop', 768, 3600, 'screen', 'main at 768', 'BR-Desktop-table@768.jpg', 'BR-Desktop')]
               + [S(f'BR-Phone-{n}', 390, 844, 'screen', t, f'BR-Phone-{n}@390.jpg', 'BR-Mobile-Spec') for n, t in phones.items()]
               + [S('BR-Mobile-Spec', 2580, 3300, 'spec', '§31 actions, §32 decisions, §33 contract, §34 component sheet', 'BR-Mobile-Spec@2580.jpg', 'BR-Mobile-Spec')]
}
json.dump(screens, open(J(G, 'reference', 'screens.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# tools (optional for the dev team) + the two raw inputs gen-data.js reads
T = J(G, 'tools')
for f in os.listdir(J(ROOT, 'tools')):
    if f.endswith(('.js', '.py')) and not f.startswith('_'):
        cp(J(ROOT, 'tools', f), J(T, f))
cp(J(ROOT, 'docs', 'design', 'tools-README.md'), J(T, 'README.md'))
for f in ['geo.json', 'cards.json']:
    cp(J(ROOT, 'work', f), J(G, 'tools', 'work', f))

n, size = 0, 0
for r, _, fs in os.walk(PKG):
    for f in fs:
        n += 1
        size += os.path.getsize(J(r, f))
print('package', n, 'files', round(size / 2 ** 20, 1), 'MB')
