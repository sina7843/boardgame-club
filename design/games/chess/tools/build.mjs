// node --experimental-strip-types build.mjs
// → canvas/build/project/chess/*.dc.html (one artboard per screen) + preview/*.html + canvas/build/boards.json
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { dcFile, fa } from './lib.mjs';
import { CSS, cssFor } from './css.mjs';
import { desktopShots } from './desktop.mjs';
import { phoneShots } from './phone.mjs';
import { specBody } from './spec.mjs';

const OUT = 'E:/AI/Claude/bgv-chess/canvas/build/project/chess';
const PRE = 'E:/AI/Claude/bgv-chess/preview';
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true }); mkdirSync(PRE, { recursive: true });
// measured heights (from preview renders), see measure step; fallbacks below
const H = existsSync('E:/AI/Claude/bgv-chess/canvas/build/heights.json') ? JSON.parse(readFileSync('E:/AI/Claude/bgv-chess/canvas/build/heights.json', 'utf8')) : {};
const pad = (n) => String(n).padStart(2, '0');
const boards = [
  ...desktopShots().map((s) => ({ key: `chess/D${pad(s.n)}-${s.slug}.dc.html`, title: `دسکتاپ ${fa(s.n)}: ${s.title}`, w: 1520, h: H[`D${pad(s.n)}`] ?? 1120, body: s.html, group: 'desk' })),
  ...phoneShots().sort((a, b) => a.n - b.n).map((s) => ({ key: `chess/P${pad(s.n)}.dc.html`, title: `گوشی ${fa(s.n)}: ${s.title}`, w: 470, h: H[`P${pad(s.n)}`] ?? 1020, body: s.html, group: 'phone' })),
  { key: 'chess/Chess-Spec.dc.html', title: 'مشخصات برای تیم فنی', w: 1520, h: H.SPEC ?? 4100, body: specBody(), group: 'spec' },
];
const head = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/canvas/project/ds/bgv/tokens.css"><link rel="stylesheet" href="/canvas/project/ds/bgv/components/bundle.css"><style>${CSS}</style></head><body>`;
for (const b of boards) {
  const html = dcFile({ title: b.title, w: b.w, h: b.h, css: cssFor(true), body: b.body });
  writeFileSync(`${OUT}/${b.key.slice(6)}`, html);
  writeFileSync(`${PRE}/${b.key.slice(6).replace('.dc.html', '.html')}`, head + b.body + '</body></html>');
}
// canvas layout: desktop 3 per row, phones 6 per row, spec last
const entries = {}; const notes = {};
let y = 300;
const desk = boards.filter((b) => b.group === 'desk');
notes['chess-title-desk'] = { x: 0, y: 0, text: `شطرنج، دسکتاپ (${fa(desk.length)} صفحه)`, kind: 'title1', maxW: 4720, page: 'chess' };
for (let i = 0; i < desk.length; i += 3) {
  const row = desk.slice(i, i + 3); const rh = Math.max(...row.map((b) => b.h));
  row.forEach((b, j) => { entries[b.key] = { x: j * 1600, y, w: b.w, h: b.h, page: 'chess', title: b.title }; });
  y += rh + 120;
}
y += 300;
const ph = boards.filter((b) => b.group === 'phone');
notes['chess-title-phone'] = { x: 0, y: y - 300, text: `شطرنج، گوشی ۳۹۰ (${fa(boards.filter((b) => b.group === 'phone').length)} صفحه)`, kind: 'title1', maxW: 3300, page: 'chess' };
for (let i = 0; i < ph.length; i += 6) {
  const row = ph.slice(i, i + 6); const rh = Math.max(...row.map((b) => b.h));
  row.forEach((b, j) => { entries[b.key] = { x: j * 550, y, w: b.w, h: b.h, page: 'chess', title: b.title }; });
  y += rh + 120;
}
y += 300;
const sp = boards.find((b) => b.group === 'spec');
notes['chess-title-spec'] = { x: 0, y: y - 300, text: 'شطرنج، مشخصات برای تیم فنی', kind: 'title1', maxW: 1520, page: 'chess' };
entries[sp.key] = { x: 0, y, w: sp.w, h: sp.h, page: 'chess', title: sp.title };
writeFileSync('E:/AI/Claude/bgv-chess/canvas/build/boards.json', JSON.stringify({ boards: entries, notes }, null, 1));
console.log(boards.length, 'artboards');
