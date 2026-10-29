// Pull the 14 factions' display data from the repo content files: node fx.js <contentDir> > factions.json
const fs = require('fs'), path = require('path');
const dir = process.argv[2], out = [];
const SP = { q: 'QIC', k: 'دانش', o: 'سنگ معدن', c: 'اعتبار' };
const RX = {
  abilityFa: /abilityFa:\s*(['`])([\s\S]*?)\1\s*[,\n}]/,
  piFa: /piFa:\s*(['`])([\s\S]*?)\1\s*[,\n}]/
};
for (const f of ['base.ts', 'factions-a.ts', 'factions-b.ts', 'factions-c.ts']) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const hits = [...src.matchAll(/id: '([a-z-]+)', nameFa: '([^']+)', nameEn: (['"])(.+?)\3, home: '(\w)'/g)];
  hits.forEach((m, i) => {
    const block = src.slice(m.index, i + 1 < hits.length ? hits[i + 1].index : undefined);
    const pick = (k) => {
      const r = block.match(RX[k]);
      return r ? r[2].replace(/\$\{SPEND_FA\.(\w)\}/g, (_, c) => SP[c]) : '';
    };
    out.push({ id: m[1], nameFa: m[2], nameEn: m[4], home: m[5], abilityFa: pick('abilityFa'), piFa: pick('piFa') });
  });
}
console.log(JSON.stringify(out, null, 1));
