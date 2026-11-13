// The list of Ark Nova artboards and the body of each one (8 boards; the canvas is near its 512-file cap).
const FL = require('./an-flows');
const MB = require('./an-mobile');
const SP = require('./an-spec');
function screens(P) {
  const desk = (l) => `<div class="bgv-tablescreen bgv-tablescreen--desk an-desk" dir="ltr">
${P.gamebar(l)}
<div class="an-main" dir="${l.dir}">
${P.actionBar(l)}
${P.handZone(l)}
${P.displayZone(l)}
${P.associationZone(l)}
${P.zooZone(l, 0)}
</div>
${P.rail(l)}
</div>`;
  const out = [
    { id: 'AN-Table-Desktop', title: 'آرک نوا، میز دسکتاپ', lang: 'fa', w: 1440, h: 3380, body: desk },
    { id: 'AN-Table-Desktop-Dark', title: 'آرک نوا، میز دسکتاپ، تیره', lang: 'fa', theme: 'dark', w: 1440, h: 3380, body: desk },
    { id: 'AN-Actions-Desktop', title: 'آرک نوا، هر کنش قدم‌به‌قدم', lang: 'fa', w: 1440, h: 2900, extraCss: FL.CSS, body: (l) => FL.actionsDesktop(l, P) },
    { id: 'AN-Phases-Desktop', title: 'آرک نوا، مرحله‌ها', lang: 'fa', w: 1440, h: 1780, extraCss: FL.CSS, body: (l) => FL.phasesDesktop(l, P) },
    { id: 'AN-Turn-Mobile', title: 'آرک نوا، گوشی: باغ‌وحش، بوردها، دست، بازیکنان', lang: 'fa', w: 1816, h: 960, extraCss: FL.CSS + MB.CSS, body: (l) => MB.turnMobile(l, P) },
    { id: 'AN-Flows-Mobile', title: 'آرک نوا، گوشی: ساخت، حیوانات، انجمن، انتخاب آغازین', lang: 'fa', w: 1816, h: 960, extraCss: FL.CSS + MB.CSS, body: (l) => MB.flowsMobile(l, P) },
    { id: 'AN-Spec', title: 'آرک نوا: کنش‌ها، پروتکل موتور و اندازه‌گیری', lang: 'fa', w: 1440, h: 2820, extraCss: FL.CSS + SP.CSS, body: (l) => SP.spec(l, P) },
    { id: 'AN-Components', title: 'آرک نوا: همهٔ کامپوننت‌ها', lang: 'fa', w: 1440, h: 6510, extraCss: FL.CSS + SP.CSS, body: (l) => SP.components(l, P) }
  ];
  const only = process.env.AN_ONLY ? process.env.AN_ONLY.split(',') : null;
  return only ? out.filter((b) => only.includes(b.id)) : out;
}
module.exports = { screens };
