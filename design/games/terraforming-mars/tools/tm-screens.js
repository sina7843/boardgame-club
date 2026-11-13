// The list of TM artboards and the body of each one.
const MB = require('./tm-mobile');
const SPEC = require('./tm-spec');
const COMP = require('./tm-components');

function screens(P) {
  const desk = (l) => `<div class="bgv-tablescreen bgv-tablescreen--desk tm-desk" dir="ltr">
${P.gamebar(l)}
<div class="tm-main" dir="${l.dir}">
${P.actionBar(l)}
${P.handZone(l)}
${P.boardZone(l)}
<section class="bgv-felt tm-zone" aria-label="${l.t('محوطهٔ بازیکنان', 'Player areas')}">
${[0, 3, 1, 2].map((k) => P.playerArea(l, k)).join('\n')}
</section>
</div>
${P.rail(l)}
</div>`;
  const mob = (id, title, fn) => ({ id, title, lang: 'fa', w: 390, h: 844, fixed: true, extraCss: MB.CSS, body: (l) => fn(l) });
  return [
    { id: 'TM-Table-Desktop', title: 'ترافورمینگ مارس، میز دسکتاپ', lang: 'fa', w: 1440, h: 3920, body: desk },
    { id: 'TM-Table-Desktop-EN', title: 'Terraforming Mars, desktop table', lang: 'en', w: 1440, h: 3920, body: desk },
    { id: 'TM-Table-Desktop-Dark', title: 'ترافورمینگ مارس، میز دسکتاپ، تیره', lang: 'fa', theme: 'dark', w: 1440, h: 3920, body: desk },
    { id: 'TM-Setup-Desktop', title: 'ترافورمینگ مارس، نسل ۱: شرکت و کارت‌های آغازین', lang: 'fa', w: 1440, h: 1660, extraCss: SPEC.CSS, body: (l) => SPEC.setupDesktop(l, P) },
    { id: 'TM-Research-Desktop', title: 'ترافورمینگ مارس، پژوهش و درفت', lang: 'fa', w: 1440, h: 1160, extraCss: SPEC.CSS, body: (l) => SPEC.researchDesktop(l, P) },
    mob('TM-Turn-Mobile', 'ترافورمینگ مارس، گوشی: جای فضای سبز', MB.turnMobile),
    mob('TM-Hand-Mobile', 'ترافورمینگ مارس، گوشی: دست و پرداخت', MB.handMobile),
    mob('TM-Actions-Mobile', 'ترافورمینگ مارس، گوشی: شیت کنش‌ها', MB.actionsMobile),
    mob('TM-Board-Mobile', 'ترافورمینگ مارس، گوشی: صفحهٔ بازیکن', MB.boardMobile),
    mob('TM-Choice-Mobile', 'ترافورمینگ مارس، گوشی: تصمیم کارت', MB.choiceMobile),
    mob('TM-Research-Mobile', 'ترافورمینگ مارس، گوشی: پژوهش', MB.researchMobile),
    mob('TM-Draft-Mobile', 'ترافورمینگ مارس، گوشی: درفت', MB.draftMobile),
    mob('TM-Setup-Mobile', 'ترافورمینگ مارس، گوشی: انتخاب آغازین', MB.setupMobile),
    { id: 'TM-Actions-Spec', title: 'ترافورمینگ مارس: همهٔ کنش‌ها و جریان‌ها', lang: 'fa', w: 1440, h: 2400, extraCss: SPEC.CSS, body: (l) => SPEC.actionsSpec(l, P) },
    { id: 'TM-Components', title: 'ترافورمینگ مارس: همهٔ کامپوننت‌ها', lang: 'fa', w: 1440, h: 4860, extraCss: MB.CSS + SPEC.CSS + COMP.CSS, body: (l) => COMP.components(l) },
    { id: 'TM-Board-Spec', title: 'ترافورمینگ مارس: اندازه‌گیری صفحه‌ها', lang: 'fa', w: 1440, h: 2240, extraCss: SPEC.CSS, body: (l) => SPEC.boardSpec(l, P) }
  ];
}
module.exports = { screens };
