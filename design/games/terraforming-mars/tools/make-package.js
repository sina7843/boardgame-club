// Assembles BGV-TerraformingMars-Handoff-v2.0 from the docs, the web art, the canvas build and the flat-set manifests.
// node make-package.js   (run build-tm.js and render-ref.py first; paths below are the E: work folder)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const W = path.join(__dirname, '..');
const FLAT = 'X:/Work/01_Clients/دراگون/boardgameverse/Games Redesign/terraforming-mars/ready to use - flat';
const RULES = 'X:/Work/01_Clients/دراگون/boardgameverse/Games Redesign/terraforming-mars/reference-assets/sources/rulebook.pdf';
const PKG = path.join(W, 'package', 'BGV-TerraformingMars-Handoff-v2.0');
const D = path.join(PKG, 'repo', 'design', 'games', 'terraforming-mars');

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

// art (same tree as the flat set + icons/), its index goes to data/
cpdir(path.join(W, 'art'), path.join(D, 'art'), (n) => n.endsWith('.webp'));
const idx = JSON.parse(fs.readFileSync(path.join(W, 'art', 'art-index.json'), 'utf8'));
fs.mkdirSync(path.join(D, 'data'), { recursive: true });
fs.writeFileSync(path.join(D, 'data', 'art-index.json'), JSON.stringify(idx, null, 1));

// data
execFileSync('node', [path.join(__dirname, 'gen-idmap.js'), path.join(D, 'art'), path.join(W, 'work', 'mock.json'), path.join(D, 'data')], { stdio: 'inherit' });
execFileSync('node', [path.join(__dirname, 'gen-layout.js'), path.join(D, 'layout.json')], { stdio: 'inherit' });
const mock = JSON.parse(fs.readFileSync(path.join(W, 'work', 'mock.json'), 'utf8'));
delete mock.cards; // full card list is data/cards.json
fs.writeFileSync(path.join(D, 'data', 'mock-state.json'), JSON.stringify({ note: 'Reference position of the artboards (generation 5, viewer = seat 0, Ecoline), checked with games/terraforming-mars/src/core.ts by tools/mock-state.mjs: hand legality, costs, projects, milestones, awards, card actions, legal greenery/city/ocean spaces, scores, tags.', ...mock }, null, 1));
for (const f of ['asset-manifest.json', 'approved-file-mapping.json', 'component-coverage.json', 'coordinate-review.json', 'physical-inventory.json', 'package-info.json']) cp(path.join(FLAT, 'data', f), path.join(D, 'data', 'publisher-' + f));

// reference: canvas sources, offline pages (+ their art and DS css), images, screens.json, rules
const B = path.join(W, 'canvas', 'build', 'project');
for (const f of fs.readdirSync(path.join(B, 'tm'))) {
  if (f.endsWith('.dc.html')) cp(path.join(B, 'tm', f), path.join(D, 'reference', 'dc', f));
  if (f.startsWith('_qa-')) cp(path.join(B, 'tm', f), path.join(D, 'reference', 'html', 'tm', f.slice(4)));
}
cpdir(path.join(B, 'assets', 'games', 'tm'), path.join(D, 'reference', 'html', 'assets', 'games', 'tm'));
cp(path.join(B, 'ds', 'bgv', 'tokens.css'), path.join(D, 'reference', 'html', 'ds', 'bgv', 'tokens.css'));
cp(path.join(B, 'ds', 'bgv', 'components', 'bundle.css'), path.join(D, 'reference', 'html', 'ds', 'bgv', 'components', 'bundle.css'));
cpdir(path.join(W, 'work', 'ref-img'), path.join(D, 'reference', 'img'), (n) => n.endsWith('.jpg'));
cp(path.join(W, 'docs', 'design', 'screens.json'), path.join(D, 'reference', 'screens.json'));
cp(RULES, path.join(D, 'reference', 'rules', 'rulebook.pdf'));

// design tools (to rebuild the artboards and the package)
for (const f of fs.readdirSync(__dirname)) if (/\.(js|mjs|py)$/.test(f)) cp(path.join(__dirname, f), path.join(D, 'tools', f));
cp(path.join(W, 'docs', 'design', 'tools-README.md'), path.join(D, 'tools', 'README.md'));

let n = 0, bytes = 0;
const walk = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, e.name); if (e.isDirectory()) walk(q); else { n++; bytes += fs.statSync(q).size; } } };
walk(PKG);
console.log('package', n, 'files', (bytes / 2 ** 20).toFixed(1), 'MB');
