// CSS of the Blood Rage artboards (becomes games/blood-rage/src/renderer.css). Colours and sizes come from DS tokens;
// the only hard-coded values are the clan colours (BGA materials, COMPONENTS.md §0), the sea frame and piece shadows.
// Everything is scoped under .bdr so it can live next to Gaia (.gp), TM (.tm) and Brass (.br) without touching DS files.
module.exports = `
body{margin:0}
.bdr{--pick:#E8A642;--bdr-wolf:#9D3644;--bdr-serpent:#DFA471;--bdr-raven:#428AA7;--bdr-bear:#856348;--bdr-ram:#70A15E;
 --bdr-wolf-ink:#8A2B38;--bdr-serpent-ink:#8C5A26;--bdr-raven-ink:#2D6E88;--bdr-bear-ink:#6E4F36;--bdr-ram-ink:#4E7F3D;
 --bdr-sea:#1B2A33;--bdr-plate:rgba(10,12,16,.82);--bdr-blood:#7E1F17;--bdr-parch:#E9DFCB;--bdr-parch-ink:#3B2A1B}
.bdr[data-theme="dark"]{--bdr-wolf-ink:#F08C99;--bdr-serpent-ink:#F2C08F;--bdr-raven-ink:#8CCBE4;--bdr-bear-ink:#D9B391;--bdr-ram-ink:#A6D894}
.bdr[lang="en"]{font-family:var(--font-latin)}
.bdr-num{unicode-bidi:isolate;direction:ltr}
.bdr-ic{display:inline-block;block-size:18px;inline-size:auto;vertical-align:-4px}
/* desktop frame: game column + sticky rail on the right (BGA) */
.bdr-desk{grid-template-columns:minmax(0,1fr) 360px;grid-template-rows:var(--gamebar-h) auto;block-size:auto;min-block-size:900px;align-items:start}
.bdr-desk>.bgv-gamebar{grid-column:1/-1;grid-row:1}
.bdr-main{grid-column:1;grid-row:2;display:flex;flex-direction:column;gap:14px;min-inline-size:0}
.bdr-rail{grid-column:2;grid-row:2;position:sticky;inset-block-start:0;max-block-size:100dvh;overflow:auto;display:grid;gap:8px;align-content:start}
.bdr-lang{display:inline-flex;padding:3px;gap:2px;border-radius:var(--radius-sm);background:var(--surface-sunken);box-shadow:var(--shadow-field)}
.bdr-lang button{block-size:30px;padding-inline:10px;border:0;border-radius:6px;background:none;font:inherit;font-size:13px;font-weight:700;color:var(--text-muted);cursor:pointer}
.bdr-lang button[aria-pressed="true"]{background:var(--selected);color:var(--on-selected)}
/* status / action bar (BGA page title + action buttons): text, the actions with their cost, then the steps */
.bdr-bar{position:sticky;inset-block-start:0;z-index:var(--z-dock);display:flex;flex-direction:column;gap:8px;padding:10px 16px;border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow-card),inset 0 0 0 1px var(--line);font-size:15px;line-height:1.6;color:var(--text)}
.bdr-bar.is-waiting{background:var(--surface-sunken)}
.bdr-bar__row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.bdr-bar__text{flex:1 1 360px;min-inline-size:0}
.bdr-bar__text b{color:var(--heading);font-weight:900}
.bdr-bar .bgv-btn{white-space:nowrap}
.bdr-bar__hint{margin:0;font-size:12.5px;line-height:1.6;color:var(--text-muted)}
.bdr-kinds{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.bdr-bar .bdr-kinds .bgv-btn{padding-inline:10px;gap:6px}
.bdr-kinds .bgv-btn[aria-pressed="true"]{background:var(--selected);color:var(--on-selected);box-shadow:none}
.bdr-kinds .bgv-btn[aria-pressed="true"] .bdr-pill{background:rgba(255,255,255,.18);color:inherit}
.bdr-kinds .bgv-btn:disabled .bdr-pill{opacity:.7}
.bdr-pill{display:inline-flex;align-items:center;gap:3px;padding:0 7px;block-size:24px;border-radius:var(--radius-pill);background:var(--surface-sunken);font-size:13px;font-weight:900;color:var(--heading);vertical-align:middle;white-space:nowrap}
.bdr-pill .bdr-ic{block-size:16px}
.bdr-rage{display:inline-flex;align-items:center;gap:2px;font-weight:900;color:var(--bdr-blood)}
.bdr[data-theme="dark"] .bdr-rage{color:#F0AAA3}
.bdr-rage img{block-size:18px;border-radius:50%}
.bdr-steps{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.bdr-step{display:inline-flex;align-items:center;gap:4px;block-size:26px;padding-inline:9px;border-radius:var(--radius-pill);font-size:12.5px;font-weight:700;background:var(--surface-sunken);color:var(--text-muted)}
.bdr-step.is-done{background:var(--success-soft);color:var(--success)}
.bdr-step.is-cur{background:var(--invite-soft);color:var(--heading)}
.bdr-step .bgv-icon{inline-size:14px;block-size:14px}
.bdr-targets{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
.bdr-target{display:inline-flex;align-items:center;gap:6px;min-block-size:38px;padding:3px 10px 3px 6px;border-radius:var(--radius-sm);border:1.5px dashed var(--pick);background:var(--surface);font:inherit;font-size:13.5px;color:var(--text);cursor:pointer}
.bdr-target img{block-size:30px;inline-size:auto}
.bdr-target small{color:var(--text-muted);font-size:12px}
.bdr-target[aria-selected="true"],.bdr-target.is-on{border-style:solid;border-width:2.5px;background:var(--invite-soft);color:var(--heading);font-weight:700}
.bdr-target:disabled{border-color:var(--line);color:var(--on-btn-disabled);cursor:default;background:var(--btn-disabled)}
.bdr-target:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.bdr-sum{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:8px 12px;border-radius:var(--radius-sm);background:var(--surface-sunken);font-size:14px}
.bdr-sum b{font-weight:900;color:var(--heading)}
.bdr-sum__fx{flex-basis:100%;font-size:13.5px;color:var(--text)}
.bdr-sum__fx b{color:var(--danger)}
.bdr-sum__total{margin-inline-start:auto;font-size:15px}
/* zones on felt */
.bdr-zone{padding:14px;gap:10px;display:flex;flex-direction:column}
.bdr-zone__head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--felt-ink);font-size:14px}
.bdr-zone__head h2{margin:0;font-size:15px;font-weight:900;color:var(--felt-ink)}
.bdr-zone__head small{color:var(--felt-muted);font-size:12.5px}
.bdr-zone__head .bgv-btn{margin-inline-start:auto}
/* cards: BGA card faces (English, user choice), Persian name under each, Persian text in the tooltip */
.bdr-card{position:relative;display:block;margin:0;padding:0;border:0;background:none;border-radius:6px;cursor:pointer;inline-size:var(--cw,150px);flex:none}
.bdr-card>img{display:block;inline-size:100%;block-size:auto;border-radius:6px;box-shadow:0 1px 0 rgba(0,0,0,.35),0 3px 8px rgba(0,0,0,.3)}
.bdr-card[data-pick="selectable"]>img{outline:2.5px dashed var(--pick);outline-offset:3px}
.bdr-card[data-pick="picked"]{transform:translateY(-10px)}
.bdr-card[data-pick="picked"]>img{outline:3.5px solid var(--pick);outline-offset:3px}
.bdr-card[data-pick="off"]>img{filter:saturate(.35) brightness(.7)}
.bdr-card:disabled,.bdr-card[aria-disabled="true"]{cursor:default}
.bdr-card:focus-visible{outline:3px solid var(--focus-on-felt);outline-offset:5px}
.bdr-card .bdr-check{inset-block-start:-9px;inset-inline-end:-9px}
.bdr-check{position:absolute;inline-size:26px;block-size:26px;border-radius:50%;background:var(--pick);color:var(--ink-felt);display:grid;place-items:center;box-shadow:0 0 0 2px var(--ink-felt);z-index:3}
.bdr-check .bgv-icon{inline-size:16px;block-size:16px;stroke-width:3}
.bdr-cardtag{position:absolute;inset-block-end:6px;left:50%;transform:translateX(-50%);max-inline-size:94%;padding:1px 7px;border-radius:var(--radius-pill);background:var(--bdr-plate);color:#FFFFFF;font-size:11.5px;font-weight:700;white-space:nowrap;z-index:2}
.bdr-hand{display:flex;flex-wrap:wrap;gap:16px 12px;justify-content:center;align-items:flex-end;padding-block-start:10px}
.bdr-hcard{display:grid;justify-items:center;gap:6px}
.bdr-hcard small{font-size:12.5px;color:var(--felt-ink);max-inline-size:var(--cw,150px);text-align:center;line-height:1.4;font-weight:700}
.bdr-hcard small i{display:block;font-style:normal;font-weight:400;color:var(--felt-muted);font-size:11.5px}
/* tooltip (hover / long-press): English card enlarged + Persian translation */
.bdr-tip{display:grid;grid-template-columns:auto 1fr;gap:12px;inline-size:420px;padding:12px;border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow-float),inset 0 0 0 1px var(--line);color:var(--text);font-size:14px;line-height:1.7}
.bdr-tip img{inline-size:150px;border-radius:6px}
.bdr-tip h3{margin:0;font-size:16px;font-weight:900;color:var(--heading)}
.bdr-tip h3 small{display:block;font-family:var(--font-latin);font-size:12.5px;font-weight:700;color:var(--text-muted)}
.bdr-tip p{margin:6px 0 0}
.bdr-tip .bdr-tip__meta{display:flex;flex-wrap:wrap;gap:6px;margin-block-start:8px}
/* ---------- the map: BGA board (1600 units) on the sea ---------- */
.bdr-mapbox{position:relative;border-radius:var(--radius-md);overflow:hidden;background:var(--bdr-sea) center/cover no-repeat;box-shadow:var(--shadow-card)}
.bdr-mapbox__tools{position:absolute;inset-inline-start:12px;inset-block-start:50%;transform:translateY(-50%);display:grid;gap:8px;z-index:5}
.bdr-mapbox__top{position:absolute;inset-block-start:12px;inset-inline:12px;display:flex;align-items:flex-start;gap:8px;z-index:5;pointer-events:none}
.bdr-mapbox__top>*{pointer-events:auto}
.bdr-mapbox__logo{inline-size:150px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
.bdr-mapbox__bottom{position:absolute;inset-block-end:12px;inset-inline-start:12px;display:flex;gap:8px;z-index:5}
.bdr-age{margin-inline-start:auto;display:grid;gap:2px;padding:6px 14px;border-radius:var(--radius-md);background:var(--bdr-plate);color:#FFFFFF;text-align:center;box-shadow:0 0 0 1px rgba(255,255,255,.14)}
.bdr-age b{font-size:17px;font-weight:900}
.bdr-age small{font-size:12px;color:#D8CDBA}
.bdr-mapbtn{display:inline-flex;align-items:center;gap:6px;block-size:40px;padding-inline:10px;border:0;border-radius:var(--radius-sm);background:var(--bdr-plate);color:#FFFFFF;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:0 0 0 1px rgba(255,255,255,.18)}
.bdr-mapbtn img{block-size:26px}
.bdr-mapbtn .bgv-icon{inline-size:20px;block-size:20px}
.bdr-mapbtn b{font-weight:900}
.bdr-map{position:relative;margin-inline:auto;aspect-ratio:1;container-type:inline-size}
.bdr-map>.bdr-base{position:absolute;inset:0;display:block;inline-size:100%;block-size:100%}
.bdr-at{position:absolute;transform:translate(-50%,-50%)}
.bdr-tok{inline-size:7.5%;filter:drop-shadow(0 2px 2px rgba(0,0,0,.55));cursor:pointer}
.bdr-tok.is-mine{filter:drop-shadow(0 0 0 #FFF) drop-shadow(0 2px 2px rgba(0,0,0,.55))}
.bdr-tok.is-ghost{opacity:.82;filter:drop-shadow(0 0 .6cqi var(--pick)) drop-shadow(0 0 .3cqi var(--pick))}
.bdr-tok.is-doomed{filter:drop-shadow(0 0 .5cqi #FF5A2A) drop-shadow(0 2px 2px rgba(0,0,0,.55))}
.bdr-tok.is-sel{border-radius:50%;filter:drop-shadow(0 0 .45cqi var(--pick)) drop-shadow(0 0 .2cqi var(--pick)) drop-shadow(0 0 .2cqi var(--pick))}
.bdr-tok.is-fx{filter:grayscale(.2) drop-shadow(0 0 .6cqi #E0505C);opacity:.9}
.bdr-x{position:absolute;inset-inline-end:8%;inset-block-start:4%;inline-size:34%;z-index:4}
.bdr-reward{inline-size:4.4%;border-radius:.4cqi;box-shadow:0 1px 3px rgba(0,0,0,.6)}
.bdr-reward.is-done{inline-size:4.4%}
.bdr-destroyed{inline-size:10.6%;border-radius:50%;filter:drop-shadow(0 2px 4px rgba(0,0,0,.7))}
.bdr-doom{inline-size:4.4%;box-shadow:0 0 0 .25cqi rgba(255,255,255,.65),0 2px 5px rgba(0,0,0,.7);border-radius:.3cqi}
.bdr-mlabel{position:absolute;transform:translate(-50%,0);padding:.15cqi .8cqi;border-radius:var(--radius-pill);background:var(--bdr-plate);color:#FFFFFF;font-size:max(11px,1.25cqi);font-weight:700;white-space:nowrap;line-height:1.5}
/* targets of the current action: amber dashed ring; picked = solid ring */
.bdr-spot{position:absolute;transform:translate(-50%,-50%);inline-size:4.6%;aspect-ratio:1;padding:0;border:0;border-radius:50%;background:transparent;cursor:pointer;box-shadow:0 0 0 .3cqi var(--pick),0 0 0 .55cqi rgba(0,0,0,.45)}
.bdr-spot img{inline-size:70%;margin:15%;display:block;opacity:.95}
.bdr-spot.is-on{box-shadow:0 0 0 .45cqi var(--pick),0 0 1.4cqi .2cqi var(--pick)}
.bdr-spot:focus-visible{outline:3px solid var(--focus-on-felt);outline-offset:4px}
.bdr-prov{position:absolute;transform:translate(-50%,-50%);padding:.2cqi .9cqi;border-radius:var(--radius-pill);border:.25cqi dashed var(--pick);background:rgba(10,12,16,.6);color:#FFFFFF;font-size:max(11px,1.3cqi);font-weight:700;white-space:nowrap}
.bdr-prov.is-on{border-style:solid;background:var(--pick);color:var(--ink-felt)}
/* ---------- rail ---------- */
.bdr-dash{padding:12px;display:grid;gap:10px}
.bdr-dash__tools{display:flex;gap:4px;justify-content:flex-end}
.bdr-saga{display:grid;grid-template-columns:repeat(6,1fr);gap:3px}
.bdr-saga span{display:grid;place-items:center;min-block-size:44px;padding:3px;border-radius:6px;background:var(--surface-sunken);font-size:11px;line-height:1.35;text-align:center;color:var(--text-muted);font-weight:700}
.bdr-saga span.is-done{color:var(--success);background:var(--success-soft)}
.bdr-saga span.is-cur{background:var(--selected);color:var(--on-selected)}
.bdr-ages{display:grid;gap:4px;margin:0;padding:0;list-style:none}
.bdr-ages li{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:var(--radius-sm);font-size:13px;background:var(--surface-sunken)}
.bdr-ages li.is-cur{background:var(--invite-soft);color:var(--heading);font-weight:700}
.bdr-ages li.is-past{opacity:.6}
.bdr-ages img{block-size:24px;border-radius:3px}
.bdr-ages b{font-weight:900}
.bdr-ages small{margin-inline-start:auto;font-size:12px;white-space:nowrap}
/* player panel (BGA br_board): clan, glory, rage, cards, first player, stats x/max, figures */
.bdr-panel{display:grid;gap:8px;padding:10px 12px;border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow-card),inset 0 0 0 1px var(--line);border-inline-start:5px solid var(--cc)}
.bdr-panel.is-turn{box-shadow:var(--shadow-card),inset 0 0 0 2px var(--pick)}
.bdr-panel.is-out{background:var(--surface-sunken)}
.bdr-panel__head{display:flex;align-items:center;gap:10px}
.bdr-panel__clan{inline-size:48px;block-size:48px;border-radius:50%;box-shadow:0 0 0 2px var(--cc)}
.bdr-panel__id{flex:1;min-inline-size:0;display:grid;gap:1px}
.bdr-panel__id b{font-size:15px;font-weight:900;display:flex;align-items:center;gap:6px}
.bdr-panel__id small{font-size:12px;color:var(--text-muted)}
.bdr-glory{display:grid;place-items:center;inline-size:54px;block-size:54px;border-radius:50%;background:var(--selected);color:var(--on-selected);line-height:1}
.bdr-glory b{font-size:21px;font-weight:900}
.bdr-glory small{font-size:10.5px;font-weight:700;opacity:.85}
.bdr-panel__row{display:flex;align-items:stretch;gap:6px}
.bdr-ragebox{position:relative;display:grid;place-items:center;inline-size:58px;block-size:58px;flex:none}
.bdr-ragebox img{position:absolute;inset:0;inline-size:100%;block-size:100%;border-radius:4px}
.bdr-ragebox b{position:relative;font-size:26px;font-weight:900;color:#FFFFFF;text-shadow:0 1px 2px rgba(0,0,0,.8)}
.bdr-box{flex:1;display:grid;place-items:center;gap:0;padding:4px 2px;border-radius:var(--radius-sm);background:var(--surface-sunken);text-align:center}
.bdr-box__v{display:inline-flex;align-items:center;gap:4px;font-size:17px;font-weight:900;color:var(--heading)}
.bdr-box__v img{block-size:24px}
.bdr-box small{font-size:11px;color:var(--text-muted);line-height:1.3}
.bdr-box.is-full .bdr-box__v{color:var(--danger)}
.bdr-stats{display:flex;gap:6px}
.bdr-stat{flex:1;display:flex;align-items:center;justify-content:center;gap:4px;block-size:32px;border-radius:var(--radius-pill);background:var(--surface-sunken);font-size:13.5px;font-weight:900;color:var(--heading)}
.bdr-stat img{inline-size:22px;block-size:22px;border-radius:50%}
.bdr-stat small{font-weight:700;color:var(--text-muted);font-size:12px}
.bdr-stat.is-legend{box-shadow:inset 0 0 0 1.5px var(--pick)}
.bdr-panel__foot{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.bdr-fp{block-size:22px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))}
.bdr-chipcount{display:inline-flex;align-items:center;gap:4px;block-size:28px;padding-inline:8px;border-radius:var(--radius-pill);background:var(--surface-sunken);font-size:12.5px;font-weight:700;color:var(--text)}
.bdr-chipcount img{block-size:20px}
.bdr-chipcount b{font-weight:900;color:var(--heading)}
.bdr-panel__foot .bgv-btn{margin-inline-start:auto}
.bdr-log{max-block-size:260px;overflow:auto}
/* ---------- clan sheets (BGA: 9 card slots, upgrades on top) ---------- */
.bdr-sheets{display:grid;gap:12px}
.bdr-sheet{display:grid;gap:8px;padding:12px;border-radius:var(--radius-md);background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.bdr-sheet.is-me{background:rgba(255,255,255,.11);box-shadow:inset 0 0 0 2px var(--cc)}
.bdr-sheet__head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--felt-ink)}
.bdr-sheet__head img.bdr-cl{inline-size:34px;block-size:34px;border-radius:50%;box-shadow:0 0 0 2px var(--cc)}
.bdr-sheet__head h3{margin:0;font-size:15px;font-weight:900}
.bdr-sheet__head small{color:var(--felt-muted);font-size:12.5px}
.bdr-sheet__head .bdr-sheet__btns{margin-inline-start:auto;display:flex;gap:6px}
.bdr-slots{display:grid;grid-template-columns:repeat(9,var(--sw,106px));gap:6px;justify-content:center}
.bdr-slot{position:relative;inline-size:var(--sw,106px);aspect-ratio:150/230}
.bdr-slot>img{position:absolute;inset:0;inline-size:100%;block-size:100%;border-radius:5px;box-shadow:0 1px 0 rgba(0,0,0,.35),0 3px 6px rgba(0,0,0,.25)}
.bdr-slot>img.is-up{transform:translate(0,0)}
.bdr-slot__q{position:absolute;inset-block-end:6%;inset-inline:8%;display:flex;justify-content:center}
.bdr-slot__q img{inline-size:46%;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,.6);transform:rotate(-6deg)}
.bdr-slot__q b{position:absolute;inset-block-start:-10px;inset-inline-end:14%;min-inline-size:22px;block-size:22px;border-radius:11px;background:var(--bdr-blood);color:#FFF;font-size:12.5px;font-weight:900;display:grid;place-items:center;box-shadow:0 0 0 2px #FFF}
.bdr-reserve{display:flex;flex-wrap:wrap;align-items:center;gap:4px 2px;padding:6px 10px;border-radius:var(--radius-sm);background:rgba(0,0,0,.22)}
.bdr-reserve>span{font-size:12.5px;color:var(--felt-muted);margin-inline-end:8px}
.bdr-reserve .bdr-rtok{position:relative;inline-size:58px;padding:0;border:0;background:none;cursor:pointer}
.bdr-reserve .bdr-rtok img{inline-size:100%;display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))}
.bdr-reserve .bdr-rtok[data-pick="selectable"]{border-radius:50%;box-shadow:0 0 0 2px var(--pick) inset}
.bdr-reserve .bdr-rtok[data-pick="picked"] img{filter:drop-shadow(0 0 6px var(--pick)) drop-shadow(0 0 3px var(--pick))}
.bdr-reserve .bdr-rtok[data-pick="off"] img{opacity:.45}
.bdr-reserve .bdr-rtok b{position:absolute;inset-block-end:-2px;inset-inline-end:-2px;min-inline-size:20px;block-size:20px;border-radius:10px;background:var(--bdr-plate);color:#FFF;font-size:12px;font-weight:900;display:grid;place-items:center}
.bdr-reserve .bdr-sep{inline-size:1px;align-self:stretch;background:rgba(255,255,255,.18);margin-inline:8px}
/* ---------- phase frames ---------- */
.bdr-frame{display:grid;gap:12px;padding:20px;border-radius:var(--radius-lg);background:var(--surface);box-shadow:var(--shadow-card),inset 0 0 0 1px var(--line)}
.bdr-frame>h2{margin:0;font-size:20px;font-weight:900;color:var(--heading);display:flex;align-items:center;gap:10px}
.bdr-frame>h2 .bdr-no{display:inline-grid;place-items:center;min-inline-size:32px;block-size:32px;padding-inline:6px;border-radius:var(--radius-pill);background:var(--selected);color:var(--on-selected);font-size:15px}
.bdr-frame>p{margin:0;font-size:14px;line-height:1.8;color:var(--text-muted);max-inline-size:1100px}
.bdr-cols{display:grid;gap:14px;align-items:start}
.bdr-panelbox{display:grid;gap:10px;padding:14px;border-radius:var(--radius-md);background:var(--surface-sunken);box-shadow:inset 0 0 0 1px var(--line)}
.bdr-panelbox h3{margin:0;font-size:15px;font-weight:900;color:var(--heading);display:flex;gap:8px;align-items:center}
.bdr-panelbox h3 img{block-size:26px}
.bdr-panelbox p{margin:0;font-size:13.5px;line-height:1.8}
.bdr-battle{display:grid;gap:6px}
.bdr-bline{display:grid;grid-template-columns:170px 64px 70px 1fr;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-sm);background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);border-inline-start:5px solid var(--cc)}
.bdr-bline.is-win{box-shadow:inset 0 0 0 2px var(--success)}
.bdr-bline.is-lose{opacity:.85}
.bdr-bline__who{display:flex;align-items:center;gap:8px;font-weight:900;font-size:14px}
.bdr-bline__who img{inline-size:30px;border-radius:50%}
.bdr-bline__who small{display:block;font-weight:400;font-size:11.5px;color:var(--text-muted)}
.bdr-bline__figs{display:flex;flex-wrap:wrap;gap:2px;align-items:center}
.bdr-bline__figs img{inline-size:46px}
.bdr-bline__figs span{font-size:12px;color:var(--text-muted);margin-inline-start:4px}
.bdr-bline__str{display:grid;place-items:center;inline-size:52px;block-size:52px;border-radius:50%;background:var(--bdr-blood);color:#FFFFFF;font-size:24px;font-weight:900;line-height:1;box-shadow:0 0 0 3px rgba(255,255,255,.7)}
.bdr-bline__str small{display:none}
.bdr-bline__card{display:flex;gap:6px;align-items:center;justify-content:flex-end}
.bdr-bline__card img{inline-size:60px;border-radius:4px}
.bdr-result{display:flex;flex-wrap:wrap;gap:6px 14px;padding:10px 12px;border-radius:var(--radius-sm);background:var(--success-soft);color:var(--text);font-size:13.5px;line-height:1.7}
.bdr-result b{color:var(--heading)}
.bdr-result.is-bad{background:var(--danger-soft)}
.bdr-q{display:grid;gap:8px;justify-items:center;text-align:center;font-size:13px}
.bdr-q img{inline-size:110px;border-radius:5px}
.bdr-q .bgv-badge{font-size:12px}
.bdr-ok{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:var(--radius-pill);background:var(--success-soft);color:var(--success);font-weight:900;font-size:12.5px}
.bdr-no2{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:var(--radius-pill);background:var(--danger-soft);color:var(--danger);font-weight:900;font-size:12.5px}
.bdr-table{inline-size:100%;border-collapse:collapse;font-size:13.5px}
.bdr-table th,.bdr-table td{padding:7px 8px;text-align:start;border-block-end:1px solid var(--line);vertical-align:top}
.bdr-table th{font-size:12.5px;color:var(--text-muted);font-weight:700}
.bdr-table td b{font-weight:900;color:var(--heading)}
.bdr-table tr.is-win td{background:var(--invite-soft)}
.bdr-table code{font-family:ui-monospace,Consolas,monospace;font-size:12px;direction:ltr;unicode-bidi:isolate;background:var(--surface-sunken);padding:1px 5px;border-radius:4px}
.bdr-statboard{position:relative;inline-size:100%;aspect-ratio:800/347}
.bdr-statboard>img{inline-size:100%;display:block}
.bdr-statboard .bdr-stok{position:absolute;inline-size:11%;transform:translate(-50%,-50%);border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.6)}
.bdr-valh{display:flex;flex-wrap:wrap;gap:6px 14px}
.bdr-valh>div{display:flex;align-items:center;gap:2px;padding:4px 8px;border-radius:var(--radius-sm);background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);border-inline-start:4px solid var(--cc)}
.bdr-valh img{inline-size:52px}
.bdr-note{margin:0;padding:8px 12px;border-radius:var(--radius-sm);background:var(--info-soft);color:var(--text);font-size:13px;line-height:1.75}
.bdr-note b{color:var(--heading)}
/* ---------- review 1: BGA layout (measured on BGA 1440 px: play column 1178 + boards 240) ---------- */
.bgv-tablescreen--desk.bdr-desk.bdr{grid-template-columns:minmax(0,1fr) 300px}
.bdr-bar{padding:10px 14px}
.bdr-bar__row{justify-content:center}
.bdr-bar__text{flex:0 1 auto;margin:0;text-align:center;font-size:16px}
.bdr-bar__note{margin:0;text-align:center;font-size:13px;line-height:1.7;color:var(--text-muted)}
.bdr-bar__note b{color:var(--danger)}
.bdr-mapbox__logo{position:absolute;inset-block-start:10px;left:12px;inline-size:180px;z-index:5;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
.bdr-mapbox .bdr-mapbox__tools{inset-inline-start:12px}
.bdr-mapbox .bdr-mapbox__bottom{inset-inline-start:auto;inset-inline-end:auto;left:12px}
.bdr-mapbox__battle{position:absolute;inset-block-start:12px;left:50%;transform:translateX(-50%);z-index:5}
.bdr-pager{position:absolute;right:12px;top:12px;display:grid;gap:8px;justify-items:center;z-index:6}
.bdr-agebadge{block-size:40px;padding-inline:14px;border:0;border-radius:var(--radius-sm);background:var(--surface);color:var(--heading);font:inherit;font-size:16px;font-weight:900;box-shadow:var(--shadow-tile-sm);cursor:pointer}
.bdr-mapbox>.bdr-map{position:absolute;left:50%;transform:translateX(-50%);inset-block-start:0}
.bdr-tok{inline-size:11%}
.bdr-pdone{display:flex;align-items:center;gap:.5cqi;padding:.5cqi .8cqi;border-radius:.5cqi;background:rgba(0,0,0,.86);color:#FFFFFF;font-size:max(10px,1.05cqi);line-height:1.35;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.6)}
.bdr-pdone img{inline-size:3.2cqi;border-radius:.3cqi}
.bdr-ztitle{margin:0;text-align:center;font-size:18px;font-weight:900;color:var(--felt-ink)}
.bdr-zsub{margin:0;text-align:center;font-size:13px;color:var(--felt-muted)}
.bdr-handzone .bdr-hand{justify-content:flex-start;padding-block-start:6px}
.bdr-sheetszone{padding:10px}
.bdr-sheets{gap:10px}
.bdr-sheet{justify-items:center;gap:10px;padding:12px 10px 16px;background:rgba(255,255,255,.12);box-shadow:none}
.bdr-sheet__name{margin:0;font-size:18px;font-weight:900;color:var(--felt-ink)}
.bdr-sheet .bdr-sheet__name{filter:brightness(1.6)}
.bdr-sheet__btns{display:flex;gap:8px;justify-content:center}
.bdr-slots{grid-template-columns:repeat(var(--cols,5),var(--sw,150px));gap:10px}
.bdr-slot.is-void{visibility:hidden}
.bdr-slot__inv{position:absolute;inset:0;display:grid;place-items:center;border-radius:5px;box-shadow:inset 0 0 0 3px var(--pick);background:rgba(232,166,66,.12)}
.bdr-slot__inv img{inline-size:30%;filter:drop-shadow(0 1px 2px rgba(0,0,0,.8))}
.bdr-slot__inv.is-on{box-shadow:inset 0 0 0 4px var(--pick),0 0 12px var(--pick);background:rgba(232,166,66,.25)}
.bdr-frame,.bdr-cols>*,.bdr-panelbox{min-inline-size:0}
.bdr-panelbox{grid-template-columns:minmax(0,1fr)}
.bdr-bline__sum{font-size:12.5px;color:var(--text-muted)}
.bdr-bline__card{justify-content:center}
.bdr-resgrid{display:grid;grid-template-columns:repeat(4,90px);gap:6px;justify-content:center}
.bdr-resgrid img{inline-size:100%}
/* BGA player board */
.bdr-panel{gap:6px;padding:10px 12px;border-inline-start:0;box-shadow:var(--shadow-card),inset 0 0 0 1px var(--line),inset 0 4px 0 var(--cc)}
.bdr-panel.is-turn{box-shadow:var(--shadow-card),inset 0 0 0 2px var(--pick),inset 0 5px 0 var(--cc)}
.bdr-panel__head{display:flex;align-items:center;gap:8px;font-size:15px}
.bdr-panel__head b{font-weight:900}
.bdr-panel__head .bgv-clock{margin-inline-start:auto}
.bdr-panel__score{font-size:14px;color:var(--text-muted)}
.bdr-panel__score b{font-size:16px;font-weight:900;color:var(--heading)}
.bdr-panel__score small{font-size:12px}
.bdr-panel__line1{display:flex;align-items:center;gap:10px}
.bdr-panel__clan{inline-size:58px;block-size:58px;border-radius:50%;box-shadow:0 0 0 2px var(--cc)}
.bdr-ragebox{inline-size:52px;block-size:52px}
.bdr-cardbox{position:relative;display:grid;place-items:center;inline-size:34px;block-size:52px}
.bdr-cardbox img{position:absolute;inset:0;inline-size:100%;block-size:100%;border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.25)}
.bdr-cardbox b{position:relative;font-size:20px;font-weight:900;color:#1A1A1A}
.bdr-fp{block-size:28px;margin-inline-start:auto}
.bdr-stats{gap:5px}
.bdr-stat{block-size:30px;font-size:13px}
.bdr-panel__more{justify-self:start}

/* ---------- review 2: responsive (BGA breakpoints: clan sheet 9 cols >=1720, 5 cols, 3 cols <=1090) ---------- */
.bdr-mapbox{block-size:var(--mh,720px)}
.bdr-slots{grid-template-columns:repeat(var(--cols,5),minmax(0,var(--sw,150px)))}
.bdr-slot{inline-size:100%}
.bdr-frame [style*="overflow:hidden"]{max-inline-size:100%}
.bdr-frame .bgv-dialog{max-inline-size:100%!important}
.bdr-frame .bgv-dialog,.bdr-frame .bgv-dialog__body,.bdr-frame .bgv-dialog__body>*,.bdr-bar,.bdr-bar__row{min-inline-size:0}
@media (min-width:1720px){.bdr-sheetszone .bdr-slots{--cols:9!important}.bdr-sheetszone .bdr-slot.is-void{display:none}}
@media (max-width:1100px){
 .bgv-tablescreen--desk.bdr-desk.bdr{grid-template-columns:minmax(0,1fr);grid-template-rows:var(--gamebar-h) auto auto}
 .bdr-desk.bdr>.bdr-rail{grid-column:1;grid-row:2;position:static;max-block-size:none;display:flex;gap:8px;overflow-x:auto;padding-block-end:4px}
 .bdr-rail>.bdr-panel{flex:0 0 248px}
 .bdr-rail>section{flex:0 0 300px;max-block-size:250px;overflow:auto}
 .bdr-desk.bdr>.bdr-main{grid-column:1;grid-row:3}
 .bdr-sheetszone .bdr-slots{--cols:3!important}
 .bdr-sheetszone .bdr-slot.is-void{display:none}
 .bdr-cols{grid-template-columns:minmax(0,1fr)!important}
 .bdr-frame [style*="grid-template-columns:200px 1fr"]{grid-template-columns:minmax(0,1fr)!important}
 .bdr-frame .bgv-dialog{inline-size:auto!important}
}
@media (max-width:760px){
 .bdr-mapbox{block-size:auto;aspect-ratio:1}
 .bdr-mapbox__logo{inline-size:110px}
 .bdr-mapbox__tools{display:none}
 .bdr-hand{gap:8px}
 .bdr-handzone .bdr-card{--cw:104px!important}
 .bdr-frame{padding:14px}
 .bdr-frame [style*="repeat(4,1fr)"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
 .bdr-bline{grid-template-columns:1fr 56px 60px;row-gap:4px}
 .bdr-bline__sum{grid-column:1/-1}
 .bdr-table{font-size:12.5px}
}
`;
