// CSS of the Ark Nova artboards (becomes games/ark-nova/src/renderer.css, everything under .an). Colours and sizes
// come from DS tokens; the only hard-coded values are the 4 seat colours (the wooden pieces), the panel plate and the
// piece shadows (COMPONENTS.md §0).
module.exports = `
body{margin:0}
.an{--pick:#E8A642;--an-red:#D7261E;--an-blue:#1F6FC0;--an-yellow:#F2C200;--an-black:#2A2A2A;--an-plate:rgba(13,26,35,.8);
 --an-red-ink:#B81E17;--an-blue-ink:#1A5FA6;--an-yellow-ink:#8A6D00;--an-black-ink:#2A2A2A;--an-paper:#F4EEDF;--an-wood:#5B3A22}
.an[data-theme="dark"]{--an-red-ink:#FF7F78;--an-blue-ink:#7DB4F0;--an-yellow-ink:#F5D04A;--an-black-ink:#D8D8D8}
.an-num{unicode-bidi:isolate;direction:ltr}
.an-ic{display:inline-block;block-size:18px;inline-size:auto;vertical-align:-4px}
/* desktop frame: game column + sticky rail (BGA) */
.an-desk{grid-template-columns:minmax(0,1fr) 360px;grid-template-rows:var(--gamebar-h) auto;block-size:auto;min-block-size:900px;align-items:start}
.an-desk>.bgv-gamebar{grid-column:1/-1;grid-row:1}
.an-main{grid-column:1;grid-row:2;display:flex;flex-direction:column;gap:14px;min-inline-size:0}
.an-rail{grid-column:2;grid-row:2;position:sticky;inset-block-start:0;max-block-size:100dvh;overflow:auto;display:grid;gap:8px;align-content:start}
/* status / action bar (BGA) */
.an-bar{position:sticky;inset-block-start:0;z-index:var(--z-dock);display:flex;flex-direction:column;gap:8px;padding:10px 16px;border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow-card),inset 0 0 0 1px var(--line);font-size:15px;line-height:1.6;color:var(--text)}
.an-bar__row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.an-bar__text{flex:1 1 360px;min-inline-size:0}
.an-bar__text b{color:var(--heading);font-weight:900}
.an-bar .bgv-btn{white-space:nowrap}
.an-bar__hint{margin:0;font-size:12.5px;line-height:1.6;color:var(--text-muted)}
.an-pill{display:inline-flex;align-items:center;gap:3px;padding:0 7px;block-size:24px;border-radius:var(--radius-pill);background:var(--surface-sunken);font-size:13px;font-weight:900;color:var(--heading);vertical-align:middle}
.an-pill .an-ic{block-size:17px}
.an-xseg{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:var(--radius-sm);background:var(--surface-sunken);box-shadow:var(--shadow-field)}
.an-xseg>span{display:inline-flex;align-items:center;gap:4px;padding-inline:6px 4px;font-size:13px;font-weight:700;color:var(--text-muted)}
.an-xseg button{min-inline-size:34px;block-size:30px;border:0;border-radius:6px;background:none;font:inherit;font-size:14px;font-weight:900;color:var(--text);cursor:pointer}
.an-xseg button[aria-pressed="true"]{background:var(--selected);color:var(--on-selected)}
.an-xseg button:disabled{color:var(--on-btn-disabled);cursor:not-allowed}
.an-strength{display:inline-grid;place-items:center;min-inline-size:22px;block-size:22px;padding-inline:4px;border-radius:5px;background:#1E1E1E;color:#FFFFFF;font-size:13px;font-weight:900;line-height:1}
.an-steps{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.an-step{display:inline-flex;align-items:center;gap:4px;block-size:24px;padding-inline:8px;border-radius:var(--radius-pill);font-size:12px;font-weight:700;background:var(--surface-sunken);color:var(--text-muted)}
.an-step.is-done{background:var(--success-soft);color:var(--success)}
.an-step.is-cur{background:var(--invite-soft);color:var(--heading)}
.an-step .bgv-icon{inline-size:14px;block-size:14px}
/* zones on felt */
.an-zone{padding:14px;gap:10px;display:flex;flex-direction:column}
.an-zone__head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--felt-ink);font-size:14px}
.an-zone__head h2{margin:0;font-size:15px;font-weight:900;color:var(--felt-ink)}
.an-zone__head small{color:var(--felt-muted);font-size:12.5px}
.an-zone__head .bgv-btn{margin-inline-start:auto}
/* cards: the publisher art (English), never redrawn; Persian name under the card, Persian text in the zoom */
.an-card{position:relative;display:block;margin:0;padding:0;border:0;background:none;border-radius:6px;cursor:pointer;inline-size:var(--cw,128px);flex:none;color:inherit;font:inherit}
.an-card>img{display:block;inline-size:100%;block-size:auto;aspect-ratio:400/558;border-radius:6px;box-shadow:0 1px 0 rgba(0,0,0,.35),0 2px 6px rgba(0,0,0,.25)}
.an-card[data-pick="selectable"]>img{outline:3px solid var(--pick);outline-offset:2px}
.an-card[data-pick="picked"]>img{outline:4px solid var(--pick);outline-offset:2px;transform:translateY(-6px)}
.an-card[aria-disabled="true"]{cursor:not-allowed}
.an-card:focus-visible{outline:3px solid var(--focus-on-felt);outline-offset:4px}
.an-card__fa{display:block;margin-block-start:4px;font-size:12.5px;font-weight:700;line-height:1.35;text-align:center;color:var(--felt-ink)}
.an-card__why{display:block;font-size:11.5px;font-weight:400;line-height:1.35;text-align:center;color:var(--felt-muted)}
.an-check{position:absolute;inset-block-start:-8px;inset-inline-end:-8px;inline-size:26px;block-size:26px;border-radius:50%;background:var(--pick);color:var(--ink-felt);display:grid;place-items:center;box-shadow:0 0 0 2px var(--ink-felt);z-index:2}
.an-check .bgv-icon{inline-size:16px;block-size:16px;stroke-width:3}
.an-hand{display:flex;flex-wrap:wrap;gap:14px 12px;align-items:flex-start;justify-content:center}
/* zoom (hover / long-press): big card + Persian name and rules text from the code */
.an-zoom{display:grid;grid-template-columns:auto 260px;gap:14px;padding:12px;border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow-float),inset 0 0 0 1px var(--line);color:var(--text);inline-size:max-content;max-inline-size:620px}
.an-zoom>img{inline-size:300px;border-radius:8px}
.an-zoom h3{margin:0 0 4px;font-size:17px;font-weight:900;color:var(--heading)}
.an-zoom p{margin:0 0 6px;font-size:13.5px;line-height:1.75}
.an-zoom small{color:var(--text-muted);font-size:12.5px}
/* boards: images with absolutely placed pieces (percent of the board) */
.an-boardimg{position:relative;inline-size:100%;border-radius:var(--radius-sm);overflow:hidden}
.an-boardimg>.an-base{display:block;inline-size:100%;block-size:auto}
.an-at{position:absolute;transform:translate(-50%,-50%)}
.an-piece{pointer-events:none;filter:drop-shadow(0 1.5px 1px rgba(0,0,0,.55))}
.an-main-board{aspect-ratio:3000/814}
.an-assoc{aspect-ratio:3000/1346}
.an-counter{inline-size:1.55%}
.an-cube{inline-size:1.2%}
.an-worker{inline-size:2.4%}
.an-fcard{inline-size:5.93%;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.45)}
.an-fcard.is-range{outline:3px solid var(--pick);outline-offset:1px}
.an-btile{inline-size:3.7%}
.an-brk{inline-size:2.6%}
.an-badge{position:absolute;transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:var(--radius-pill);background:var(--an-plate);color:#FFFFFF;font-size:12.5px;font-weight:900;white-space:nowrap}
.an-boards{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px;align-items:start}
.an-projrow{display:flex;gap:8px;justify-content:center}
.an-proj{position:relative;--cw:112px}
.an-proj .an-lvl{position:absolute;inline-size:14%;transform:translate(-50%,-50%);filter:drop-shadow(0 1px 1px rgba(0,0,0,.6))}
.an-proj .an-lvl-x{position:absolute;transform:translate(-50%,-50%);inline-size:20%;aspect-ratio:1;border-radius:50%;background:rgba(13,26,35,.8);color:#FFFFFF;display:grid;place-items:center;font-weight:900;font-size:12px}
.an-done{position:absolute;transform:translate(-50%,-50%);inline-size:4.6%;aspect-ratio:1;border-radius:50%;background:rgba(13,26,35,.78);color:#FFFFFF;display:grid;place-items:center}
.an-done .bgv-icon{inline-size:70%;block-size:70%;stroke-width:3}
.an-ptile{inline-size:8.6%}
.an-utile{inline-size:9.5%}
.an-hot{position:absolute;transform:translate(-50%,-50%);border:0;padding:0;background:transparent;border-radius:12px;cursor:pointer}
.an-hot.is-avail{box-shadow:0 0 0 3px var(--pick)}
.an-hot:focus-visible{outline:3px solid var(--focus-on-felt);outline-offset:2px}
/* zoo: map image + buildings + pieces, action cards hang below the map (BGA) */
.an-zoomap{position:relative}
.an-map{position:relative;aspect-ratio:2000/1041;border-radius:var(--radius-sm) var(--radius-sm) 0 0;overflow:visible}
.an-map>.an-base{display:block;inline-size:100%;block-size:auto;border-radius:var(--radius-sm)}
.an-bld{position:absolute;transform-origin:50% 50%;pointer-events:none;filter:drop-shadow(0 2px 2px rgba(0,0,0,.45))}
.an-zoomap .an-cube{inline-size:2.1%}
.an-zoomap .an-worker{inline-size:2.6%}
.an-zoomap .an-ptile{inline-size:7.4%}
.an-zoomap .an-utile{inline-size:6.6%}
.an-acts{position:relative;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1.6%;padding-inline:3.2%;margin-block-start:-2.6%}
.an-act{position:relative;display:block;padding:0;border:0;background:none;cursor:pointer;border-radius:8px;text-align:center;color:inherit;font:inherit}
.an-act>img{display:block;inline-size:100%;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,.35)}
.an-act.is-avail>img{outline:3px solid var(--pick);outline-offset:2px}
.an-act:disabled{cursor:default}
.an-act__str{position:absolute;inset-block-start:-12px;inset-inline-start:50%;transform:translateX(-50%);display:inline-grid;place-items:center;inline-size:30px;block-size:30px;border-radius:7px;background:#1E1E1E;color:#FFFFFF;font-size:17px;font-weight:900;box-shadow:0 0 0 2px #FFFFFF}
.an-act__toks{position:absolute;inset-block-start:34%;inset-inline-end:6%;display:flex;flex-direction:column;gap:4px}
.an-act__toks img{inline-size:34px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.6))}
.an-act__fa{display:block;margin-block-start:4px;font-size:12.5px;font-weight:700;color:var(--felt-ink)}
.an-hexes{position:absolute;inset:0;inline-size:100%;block-size:100%;pointer-events:none}
.an-hex{fill:rgba(232,166,66,.28);stroke:var(--pick);stroke-width:11;stroke-dasharray:20 10;stroke-linejoin:round}
.an-hex--ghost{fill:rgba(232,166,66,.15);stroke:#FFFFFF;stroke-width:14;stroke-dasharray:none}
.an-bld--ghost{opacity:.88;filter:drop-shadow(0 0 6px var(--pick)) drop-shadow(0 0 2px var(--pick))}
/* player area header (BGA dashboard) */
.an-player{display:grid;gap:12px;padding:12px;border-radius:var(--radius-md);background:var(--felt-plate);box-shadow:inset 0 0 0 2px var(--pc,transparent)}
.an-ahead{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;padding:10px 14px;border-radius:var(--radius-sm);background:linear-gradient(180deg,#F7F1E3,#E6D8B8);color:#1E2328;box-shadow:inset 0 0 0 1px rgba(91,58,34,.3),inset 0 1px 0 rgba(255,255,255,.7);
 --an-red-ink:#B81E17;--an-blue-ink:#1A5FA6;--an-yellow-ink:#8A6D00;--an-black-ink:#2A2A2A}
.an-ahead__name{display:inline-flex;align-items:center;gap:6px;block-size:30px;padding-inline:14px;border-radius:15px;background:#FFFFFF;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18);font-size:16px;font-weight:900}
.an-ahead__name small{font-size:12.5px;font-weight:700;color:#4A535B}
.an-ahead__map{font-size:13px;font-weight:700;color:#4A535B}
.an-cnts{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.an-cnt{display:inline-grid;place-items:center;position:relative}
.an-cnt>img{grid-area:1/1;block-size:40px;inline-size:auto}
.an-cnt>b{grid-area:1/1;position:relative;min-inline-size:24px;padding:1px 5px 0;border-radius:7px;background:rgba(13,26,35,.78);color:#FFFFFF;font-size:17px;font-weight:900;line-height:1.3;text-align:center}
.an-cnt--coin>b{background:none;font-size:18px;text-shadow:0 1px 1px rgba(0,0,0,.8)}
.an-icons{display:flex;flex-wrap:wrap;gap:4px}
.an-icn{position:relative;display:grid;place-items:center;inline-size:32px;block-size:32px}
.an-icn img{grid-area:1/1;inline-size:100%;block-size:100%;object-fit:contain}
.an-icn b{grid-area:1/1;align-self:end;justify-self:end;position:relative;min-inline-size:17px;margin:-4px -5px;padding:0 3px;border-radius:9px;background:#1E1E1E;color:#FFFFFF;font-size:12px;font-weight:900;line-height:1.45;text-align:center;box-shadow:0 0 0 1.5px #FFFFFF}
.an-icn.is-zero{opacity:.32}
.an-score{display:grid;place-items:center;align-content:center;inline-size:52px;block-size:52px;flex:none;border-radius:50%;background:#2E6B4F;color:#FFFFFF;box-shadow:0 0 0 2px #FFFFFF,0 0 0 3.5px #2E6B4F;line-height:1}
.an-score.is-neg{background:#7A2E2A;box-shadow:0 0 0 2px #FFFFFF,0 0 0 3.5px #7A2E2A}
.an-score b{font-size:18px;font-weight:900}
.an-score small{font-size:10.5px;font-weight:700;opacity:.92}
.an-tableau{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}
.an-tableau .an-card{--cw:84px}
.an-tableau .an-card__fa{font-size:11.5px}
.an-hit polygon{fill:transparent;stroke:none}
.an-tableau__label{flex-basis:100%;margin:0;font-size:13px;font-weight:700;color:var(--felt-muted)}
.an-row2{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start}
/* rail */
.an-dash{padding:8px 12px;display:grid;gap:8px}
.an-dash__tools{display:flex;justify-content:space-between}
.an-dash__info{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
.an-dinfo{display:grid;justify-items:center;gap:2px;font-size:12.5px;color:var(--text-muted)}
.an-dinfo b{font-size:16px;font-weight:900;color:var(--heading)}
.an-dinfo img{block-size:30px}
.an-panel{padding:10px 12px;display:grid;gap:8px}
.an-panel__head{display:flex;align-items:center;gap:8px;min-inline-size:0}
.an-panel__id{flex:1;min-inline-size:0;display:grid;line-height:1.35}
.an-panel__id b{font-size:15px;font-weight:900;display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.an-panel__id small{font-size:12.5px;color:var(--text-muted)}
.an-panel .an-cnts{padding:6px 4px;border-radius:var(--radius-sm);background:var(--surface-sunken);justify-content:space-between;gap:4px}
.an-panel .an-cnt>img{block-size:34px}
.an-panel .an-cnt>b{font-size:15px;min-inline-size:20px}
.an-panel .an-icn{inline-size:28px;block-size:28px}
.an-goal{font-size:12.5px;color:var(--text-muted)}
.an-goal b{color:var(--heading);font-weight:900}
.an-log{max-block-size:300px;overflow:auto}
.an-log .bgv-log__item{font-size:13.5px}
.an-log .an-ic{block-size:16px}
`;
