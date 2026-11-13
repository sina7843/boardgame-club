// The list of Brass artboards and the body of each one.
const { M } = require('./br-lib');
const MB = require('./br-mobile');
const SPEC = require('./br-spec');
const COMP = require('./br-components');

function screens(P) {
  const S = M.main;
  const desk = (l) => `<div class="bgv-tablescreen bgv-tablescreen--desk br-desk br" dir="ltr" data-seq="${S.state.seq}" data-era="${S.state.era}" data-round="${S.state.round}">
${P.gamebar(l)}
<div class="br-main" dir="${l.dir}">
${P.actionBar(l, S)}
${P.handZone(l, S)}
${P.boardZone(l, S)}
</div>
${P.rail(l, S)}
</div>`;
  return [
    { id: 'Brass-Table-Desktop', title: 'برس، میز دسکتاپ', lang: 'fa', w: 1440, h: 1740, body: desk },
    { id: 'Brass-Table-Desktop-EN', title: 'Brass, desktop table', lang: 'en', w: 1440, h: 1740, body: desk },
    { id: 'Brass-Table-Desktop-Dark', title: 'برس، میز دسکتاپ، تیره', lang: 'fa', theme: 'dark', w: 1440, h: 1740, body: desk },
    ...[['Brass-Turn-Mobile', 'برس، گوشی: ساخت با بزرگ‌نمایی خودکار', MB.turnMobile], ['Brass-Sell-Mobile', 'برس، گوشی: فروش به تاجر', MB.sellMobile], ['Brass-Actions-Mobile', 'برس، گوشی: شیت اقدام‌ها', MB.actionsMobile], ['Brass-Mat-Mobile', 'برس، گوشی: صفحهٔ صنعت من', MB.matMobile], ['Brass-EraEnd-Mobile', 'برس، گوشی: پایان دورهٔ کانال', MB.eraEndMobile]].map(([id, title, fn]) => ({ id, title, lang: 'fa', w: 390, h: 844, fixed: true, extraCss: MB.CSS, body: (l) => fn(l) })),
    { id: 'Brass-Phases-Desktop', title: 'برس: دور اول کانال، پایان دوره، پایان بازی، آموزش', lang: 'fa', w: 1440, h: 4110, extraCss: MB.CSS + SPEC.CSS, body: (l) => SPEC.phasesDesktop(l) },
    { id: 'Brass-Actions-Spec', title: 'برس: همهٔ اقدام‌ها از کد', lang: 'fa', w: 1440, h: 1360, extraCss: SPEC.CSS, body: (l) => SPEC.actionsSpec(l) },
    { id: 'Brass-Components', title: 'برس: همهٔ کامپوننت‌ها', lang: 'fa', w: 1440, h: 5160, extraCss: MB.CSS + SPEC.CSS + COMP.CSS, body: (l) => COMP.components(l) }
  ];
}
module.exports = { screens };
