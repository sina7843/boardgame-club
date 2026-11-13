// The two Blood Rage artboards (the canvas has only 2 free file slots): BR-Desktop = table + every phase;
// BR-Mobile-Spec = phones + action spec + component sheet.
const P = require('./bdr-parts');
const PH = require('./bdr-phases');
const MB = require('./bdr-mobile');
const SP = require('./bdr-spec');
const { M, ME, C } = require('./bdr-lib');

function table(l) {
  const s = M;
  const slot = P.pickedSlot();
  const spots = P.invadeTargets(s).flatMap(({ p }) => P.empty(s, p).map((v) => ({ slot: v, on: v === slot, ghost: v === slot ? `${C.clans.find((c) => c.id === s.clans[ME]).slug}-card-026-troll-token` : null })));
  const victims = s.figures.filter((f) => f.seat !== ME && f.kind === 'warrior' && P.provOfFig(f) === P.PICK.province).map((f) => f.id);
  return `<div class="bgv-tablescreen bgv-tablescreen--desk bdr-desk bdr" dir="ltr" data-age="${s.age}" data-phase="${s.phase}">
${P.gamebar(l)}
<div class="bdr-main" dir="${l.dir}">
${P.actionBar(l)}
${P.mapBox(l, { spots, fx: victims })}
${P.handZone(l)}
${P.sheetsZone(l, { mine: { invade: (k) => (k === 'monster' ? 'picked' : k === 'warrior' ? 'selectable' : null) } })}
</div>
${P.rail(l)}
</div>`;
}

function screens() {
  return [
    { id: 'BR-Desktop', title: 'بلاد ریج، دسکتاپ: میز و همهٔ فازها', lang: 'fa', w: 1440, h: PH.HEIGHT, extraCss: PH.CSS, body: (l) => table(l) + PH.phases(l) },
    { id: 'BR-Mobile-Spec', title: 'بلاد ریج: گوشی، اقدام‌ها، کامپوننت‌ها', lang: 'fa', w: SP.WIDTH, h: SP.HEIGHT, extraCss: MB.CSS + SP.CSS, body: (l) => MB.phones(l) + SP.spec(l) }
  ];
}
module.exports = { screens, table };
