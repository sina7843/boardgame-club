// Assembles BGV-Brass-Handoff-v1.0 from the docs, the web art, the canvas build, the reference renders and the flat-set
// manifests. node make-package.js   (run build-br.js, render-ref.py and engine/mock.mjs first; paths are the E: work folder)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const W = path.join(__dirname, '..');
const FLAT = 'X:/Work/01_Clients/دراگون/boardgameverse/Games Redesign/brass-birmingham/ready to use - flat';
const RULES = FLAT + '/sources/bb627a11c769-official-rulebook.pdf';
const PKG = path.join(W, 'package', 'BGV-Brass-Handoff-v1.0');
const D = path.join(PKG, 'repo', 'design', 'games', 'brass');

const cp = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); };
const cpdir = (a, b, filter = () => true) => {
  for (const e of fs.readdirSync(a, { withFileTypes: true })) {
    const s = path.join(a, e.name), t = path.join(b, e.name);
    if (e.isDirectory()) cpdir(s, t, filter); else if (filter(e.name)) cp(s, t);
  }
};
fs.rmSync(PKG, { recursive: true, force: true });

// docs and Claude Code commands
cp(path.join(W, 'docs', 'START-HERE.md'), path.join(PKG, 'START-HERE.md'));
for (const f of ['HANDOFF.md', 'COMPONENTS.md', 'QA-CHECKLIST.md', 'CHANGELOG.md']) cp(path.join(W, 'docs', 'design', f), path.join(D, f));
cpdir(path.join(W, 'docs', 'claude'), path.join(PKG, 'repo', '.claude'));

// art: the whole web set, same tree as the flat set
cpdir(path.join(W, 'art'), path.join(D, 'art'), (n) => n.endsWith('.webp'));
const idx = JSON.parse(fs.readFileSync(path.join(W, 'art', 'art-index.json'), 'utf8'));
fs.mkdirSync(path.join(D, 'data'), { recursive: true });
fs.writeFileSync(path.join(D, 'data', 'art-index.json'), JSON.stringify(Object.entries(idx).map(([k, v]) => ({ path: `art/${k}.webp`, width: v.w, height: v.h, bytes: v.bytes, publisherSource: `ready to use - flat/${v.src}` })), null, 1));

// data + layout
execFileSync('node', [path.join(__dirname, 'gen-data.js'), D], { stdio: 'inherit' });
for (const f of ['asset-manifest.json', 'approved-file-mapping.json', 'component-coverage.json', 'coordinate-review.json', 'deck-instances.json', 'package-info.json']) cp(path.join(FLAT, 'data', f), path.join(D, 'data', 'publisher-' + f));

// reference: canvas sources, offline pages (+ their art and DS css), images, screens.json, rules
const B = path.join(W, 'canvas', 'build', 'project');
for (const f of fs.readdirSync(path.join(B, 'brass'))) {
  if (f.endsWith('.dc.html')) cp(path.join(B, 'brass', f), path.join(D, 'reference', 'dc', f));
  if (f.startsWith('_qa-')) cp(path.join(B, 'brass', f), path.join(D, 'reference', 'html', 'brass', f.slice(4)));
}
cpdir(path.join(B, 'assets', 'games', 'brass'), path.join(D, 'reference', 'html', 'assets', 'games', 'brass'));
cp(path.join(B, 'ds', 'bgv', 'tokens.css'), path.join(D, 'reference', 'html', 'ds', 'bgv', 'tokens.css'));
cp(path.join(B, 'ds', 'bgv', 'components', 'bundle.css'), path.join(D, 'reference', 'html', 'ds', 'bgv', 'components', 'bundle.css'));
cpdir(path.join(W, 'work', 'ref-img'), path.join(D, 'reference', 'img'), (n) => n.endsWith('.jpg'));
const SC = [
  ['Brass-Table-Desktop', 1440, 1740, 'light', 'fa', 'screen', 'main: Rail Era round 6, seat 0 action 1 of 2, Build → Birmingham space 4 (manufacturer II), card picked'],
  ['Brass-Table-Desktop-EN', 1440, 1740, 'light', 'en', 'screen', 'same as Brass-Table-Desktop, English game layer'],
  ['Brass-Table-Desktop-Dark', 1440, 1740, 'dark', 'fa', 'screen', 'same as Brass-Table-Desktop, dark theme'],
  ['Brass-Turn-Mobile', 390, 844, 'light', 'fa', 'screen', 'main: Build, auto-zoom on the 4 legal spaces, Birmingham picked, card step'],
  ['Brass-Sell-Mobile', 390, 844, 'light', 'fa', 'screen', 'main: Sell pottery Coventry → Nottingham with merchant beer'],
  ['Brass-Actions-Mobile', 390, 844, 'light', 'fa', 'screen', 'main: actions sheet over the hand tab'],
  ['Brass-Mat-Mobile', 390, 844, 'light', 'fa', 'screen', 'main: my mat tab with seat switcher'],
  ['Brass-EraEnd-Mobile', 390, 844, 'light', 'fa', 'screen', 'eraEnd: Canal Era scoring sheet'],
  ['Brass-Phases-Desktop', 1440, 4110, 'light', 'fa', 'spec', 'start, eraEnd, final, tutorial step 2, mat dialog'],
  ['Brass-Actions-Spec', 1440, 1360, 'light', 'fa', 'spec', 'every action from rules.ts'],
  ['Brass-Components', 1440, 5160, 'light', 'fa', 'spec', 'every component, numbered as COMPONENTS.md']
];
fs.writeFileSync(path.join(D, 'reference', 'screens.json'), JSON.stringify({
  note: 'Canvas page «۱۴. پایلوت BGA: برس» (https://claude.ai/artifact/61m4wUqVQ373pFLzuqsier). state = key in data/mock-state.json. Spec boards are not compared pixel by pixel.',
  screens: SC.map(([id, width, height, theme, lang, kind, state]) => ({ id, width, height, theme, lang, kind, state, reference: [`img/${id}@${width}.jpg`, `html/brass/${id}.html`, `dc/${id}.dc.html`] }))
}, null, 1));
cp(RULES, path.join(D, 'reference', 'rules', 'rulebook.pdf'));

// design tools (to rebuild the artboards and the package) + the engine scripts
for (const f of fs.readdirSync(__dirname)) if (/\.(js|mjs|py)$/.test(f)) cp(path.join(__dirname, f), path.join(D, 'tools', f));
for (const f of ['sim.mjs', 'mock.mjs', 'inspect.mjs']) cp(path.join(W, 'engine', f), path.join(D, 'tools', 'engine', f));
cpdir(path.join(W, 'engine', 'node_modules'), path.join(D, 'tools', 'engine', 'node_modules'));
cp(path.join(W, 'docs', 'design', 'tools-README.md'), path.join(D, 'tools', 'README.md'));

let n = 0, bytes = 0;
const walk = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, e.name); if (e.isDirectory()) walk(q); else { n++; bytes += fs.statSync(q).size; } } };
walk(PKG);
console.log('package', n, 'files', (bytes / 2 ** 20).toFixed(1), 'MB');
