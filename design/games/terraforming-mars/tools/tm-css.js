// CSS of the TM artboards (becomes games/terraforming-mars/src/renderer.css). Colours and sizes come from DS tokens;
// the only hard-coded values are the player colours, the production plate and the piece shadows (COMPONENTS.md §0).
module.exports = `
body{margin:0}
.tm{--pick:#E8A642;--tm-red:#E5483F;--tm-blue:#3F8FE5;--tm-green:#4FBF5A;--tm-yellow:#F0C419;--tm-black:#2B2B2B;--tm-prod:#6B3A1C;--tm-plate:rgba(13,26,35,.82);
 --tm-red-ink:#C8322A;--tm-blue-ink:#2A72C4;--tm-green-ink:#2E8A3B;--tm-yellow-ink:#9A7700;--tm-black-ink:#2B2B2B}
.tm[data-theme="dark"]{--tm-red-ink:#FF7B70;--tm-blue-ink:#7DB6F5;--tm-green-ink:#7FD98A;--tm-yellow-ink:#F5D04A;--tm-black-ink:#D8D8D8}
.tm[lang="en"]{font-family:var(--font-latin)}
.tm-ic{display:inline-block;block-size:18px;inline-size:auto;vertical-align:-4px}
.tm-num,.tm-costpill,.tm-prodv{unicode-bidi:isolate;direction:ltr}
/* desktop frame: game column + sticky rail on the right (like BGA) */
.tm-desk{grid-template-columns:minmax(0,1fr) 360px;grid-template-rows:var(--gamebar-h) auto;block-size:auto;min-block-size:900px;align-items:start}
.tm-desk>.bgv-gamebar{grid-column:1/-1;grid-row:1}
.tm-main{grid-column:1;grid-row:2;display:flex;flex-direction:column;gap:14px;min-inline-size:0}
.tm-rail{grid-column:2;grid-row:2;position:sticky;inset-block-start:0;max-block-size:100dvh;overflow:auto;display:grid;gap:8px;align-content:start}
.tm-lang{display:inline-flex;padding:3px;gap:2px;border-radius:var(--radius-sm);background:var(--surface-sunken);box-shadow:var(--shadow-field)}
.tm-lang button{block-size:30px;padding-inline:10px;border:0;border-radius:6px;background:none;font:inherit;font-size:13px;font-weight:700;color:var(--text-muted);cursor:pointer}
.tm-lang button[aria-pressed="true"]{background:var(--selected);color:var(--on-selected)}
/* status / action bar (BGA) */
.tm-bar{position:sticky;inset-block-start:0;z-index:var(--z-dock);display:flex;flex-direction:column;gap:8px;padding:10px 16px;border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow-card),inset 0 0 0 1px var(--line);font-size:15px;line-height:1.6;color:var(--text)}
.tm-bar.is-waiting{background:var(--surface-sunken)}
.tm-bar__row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.tm-bar__text{flex:1 1 360px;min-inline-size:0}
.tm-bar__text b{color:var(--heading);font-weight:900}
.tm-bar .bgv-btn{white-space:nowrap}
.tm-bar__hint{margin:0;font-size:12.5px;line-height:1.6;color:var(--text-muted)}
.tm-costpill{display:inline-flex;align-items:center;gap:3px;padding:0 7px;block-size:24px;border-radius:var(--radius-pill);background:var(--surface-sunken);font-size:13px;font-weight:900;color:var(--heading);vertical-align:middle}
.tm-costpill .tm-ic{block-size:16px}
.tm-steps{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.tm-step{display:inline-flex;align-items:center;gap:4px;block-size:24px;padding-inline:8px;border-radius:var(--radius-pill);font-size:12px;font-weight:700;background:var(--surface-sunken);color:var(--text-muted)}
.tm-step.is-done{background:var(--success-soft);color:var(--success)}
.tm-step.is-cur{background:var(--invite-soft);color:var(--heading)}
.tm-step .bgv-icon{inline-size:14px;block-size:14px}
/* zones on felt */
.tm-zone{padding:14px;gap:10px;display:flex;flex-direction:column}
.tm-zone__head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--felt-ink);font-size:14px}
.tm-zone__head h2{margin:0;font-size:15px;font-weight:900;color:var(--felt-ink)}
.tm-zone__head small{color:var(--felt-muted);font-size:12.5px}
.tm-zone__head .bgv-btn{margin-inline-start:auto}
/* cards: the publisher art, never redrawn; unplayable cards are NOT faded (BGA) */
.tm-card{position:relative;display:block;margin:0;padding:0;border:0;background:none;border-radius:6px;cursor:pointer;inline-size:var(--cw,140px);flex:none}
.tm-card>img{display:block;inline-size:100%;block-size:auto;border-radius:6px;box-shadow:0 1px 0 rgba(0,0,0,.35),0 2px 6px rgba(0,0,0,.25)}
.tm-card[data-pick="selectable"]>img{outline:2px dashed var(--pick);outline-offset:2px}
.tm-card[data-pick="picked"]>img{outline:3px solid var(--pick);outline-offset:2px}
.tm-card[aria-disabled="true"],.tm-card:disabled{cursor:not-allowed}
.tm-card:focus-visible{outline:3px solid var(--focus-on-felt);outline-offset:4px}
.tm-card .tm-check{inset-block-start:-8px;inset-inline-end:-8px}
.tm-check{position:absolute;inline-size:26px;block-size:26px;border-radius:50%;background:var(--pick);color:var(--ink-felt);display:grid;place-items:center;box-shadow:0 0 0 2px var(--ink-felt);z-index:2}
.tm-check .bgv-icon{inline-size:16px;block-size:16px;stroke-width:3}
/* hand */
.tm-hand{display:flex;flex-wrap:wrap;gap:12px 10px;align-items:flex-start}
.tm-hand--desk{justify-content:center}
.tm-hcard{display:grid;justify-items:center;gap:5px;inline-size:var(--cw,140px)}
/* board, shown without its printed TR frame (window = layout.json marsBoard.crop) */
.tm-board{position:relative;inline-size:100%;aspect-ratio:920/774;overflow:hidden;border-radius:var(--radius-md);background:#05070F}
.tm-board>.tm-base{position:absolute;display:block;inline-size:111.304%;block-size:auto;left:-5.652%;top:-6.202%;max-inline-size:none}
.tm-board>.tm-at,.tm-at{position:absolute;transform:translate(-50%,-50%)}
.tm-tile{inline-size:7.35%;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.5))}
.tm-cube{inline-size:2%;pointer-events:none;filter:drop-shadow(0 1px 0 rgba(0,0,0,.6))}
.tm-cube--track{inline-size:2.9%}
.tm-cube--plaque{inline-size:2.56%}
.tm-spbtn,.tm-mabtn,.tm-hexbtn{position:absolute;transform:translate(-50%,-50%);border:0;padding:0;background:transparent;cursor:pointer;border-radius:8px}
.tm-spbtn{inline-size:15.9%;block-size:3.93%}
.tm-mabtn{inline-size:9.13%;block-size:6.97%}
.tm-spbtn:hover,.tm-mabtn:hover{box-shadow:0 0 0 3px var(--pick)}
.tm-spbtn:focus-visible,.tm-mabtn:focus-visible,.tm-hexbtn:focus-visible{outline:3px solid var(--focus-on-felt);outline-offset:2px}
.tm-spbtn:disabled,.tm-mabtn:disabled{cursor:default;box-shadow:none}
.is-avail{box-shadow:0 0 0 3px var(--pick)!important}
.tm-hexbtn{inline-size:7.26%;block-size:9.97%;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);border-radius:0}
.tm-picks{position:absolute;inset:0;inline-size:100%;block-size:100%;pointer-events:none}
.tm-hex{fill:rgba(232,166,66,.12);stroke:var(--pick);stroke-width:3;stroke-dasharray:8 5;stroke-linejoin:round}
.tm-hex--picked{fill:rgba(232,166,66,.32);stroke-width:4.5;stroke-dasharray:none}
.tm-board .tm-check{inline-size:22px;block-size:22px;transform:translate(-50%,-50%)}
.tm-bonus{position:absolute;transform:translate(-50%,0);display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border-radius:var(--radius-pill);background:var(--felt-control);color:var(--brand-ink);font-size:12px;font-weight:900;box-shadow:0 0 0 1.5px var(--ink-felt);white-space:nowrap}
.tm-bonus .tm-ic{block-size:14px}
.tm-boardplate{position:absolute;inset-block-start:8px;display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:var(--radius-pill);background:rgba(5,7,15,.72);color:#FFFFFF;font-size:13.5px;font-weight:700;line-height:1.5}
.tm-boardplate b{font-weight:900}
.tm-boardplate .tm-ic{block-size:20px}
.tm-boardplate--start{left:8px}
.tm-boardplate--end{right:8px}
/* BGA player dashboard pieces (rail panel and area header) */
.tm-score{display:grid;place-items:center;align-content:center;inline-size:50px;block-size:50px;flex:none;border-radius:50%;background:var(--tm-prod);color:#FFFFFF;box-shadow:0 0 0 2px #FFFFFF,0 0 0 3.5px var(--tm-prod);line-height:1}
.tm-score b{font-size:20px;font-weight:900}
.tm-score small{font-size:10.5px;font-weight:700;opacity:.92}
.tm-score--sm{inline-size:42px;block-size:42px}
.tm-score--sm b{font-size:17px}
.tm-tr{position:relative;display:inline-grid;place-items:center;inline-size:44px;block-size:34px;flex:none;border-radius:6px;background:url(../assets/games/tm/i-tr.webp) center/cover;box-shadow:0 0 0 1px rgba(0,0,0,.35)}
.tm-tr b{padding:0 4px;border-radius:5px;background:var(--tm-plate);color:#FFFFFF;font-size:15px;font-weight:900;line-height:1.3}
.tm-handn{display:inline-flex;align-items:center;gap:4px;block-size:34px;padding-inline:8px;border-radius:8px;background:var(--surface-sunken);font-size:15px;font-weight:900;color:var(--heading)}
.tm-handn .tm-ic{block-size:24px;border-radius:3px}
.tm-logo{display:flex;align-items:center;flex:none;block-size:34px}
.tm-logo img{display:block;block-size:100%;inline-size:auto;max-inline-size:132px;object-fit:contain}
.tm-r{display:grid;justify-items:center;gap:2px}
.tm-r__ic{display:grid;place-items:center}
.tm-r__ic .tm-ic{grid-area:1/1;block-size:44px}
.tm-r__ic b{grid-area:1/1;position:relative;min-inline-size:26px;padding:1px 5px 0;border-radius:7px;background:rgba(13,26,35,.78);color:#FFFFFF;font-size:19px;font-weight:900;line-height:1.3;text-align:center}
.tm .tm-prodv{min-inline-size:42px;padding:2px 6px;border-radius:6px;background:var(--tm-prod);color:#FFFFFF;font-size:16px;font-weight:900;text-align:center;line-height:1.45;text-shadow:0 1px 0 rgba(0,0,0,.6);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
.tm .tm-prodv.is-neg{background:var(--danger)}
.tm-tags{display:flex;flex-wrap:wrap;gap:5px 4px}
.tm-tagc{position:relative;display:grid;place-items:center;inline-size:40px;block-size:40px}
.tm-tagc img{grid-area:1/1;inline-size:100%;block-size:100%;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
.tm-tagc b{grid-area:1/1;position:relative;min-inline-size:22px;padding:1px 4px 0;border-radius:6px;background:rgba(13,26,35,.72);color:#FFFFFF;font-family:var(--font-latin);font-size:17px;font-weight:800;line-height:1.25;text-align:center}
.tm[lang="fa"] .tm-tagc b{font-family:inherit;font-weight:900}
.tm-tagc.is-zero{opacity:.38}
.tm-tagc--hex img{inline-size:88%;block-size:auto}
/* rail */
.tm-dash{padding:8px 12px;display:grid;gap:6px}
.tm-dash__tools{display:flex;justify-content:space-between}
.tm-dash__params{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
.tm-param{display:grid;justify-items:center;gap:2px;font-size:16px;color:var(--heading)}
.tm-param .tm-ic{block-size:36px}
.tm-param b{font-weight:900}
.tm-panel{padding:10px 12px;display:grid;gap:8px}
.tm-panel__head{display:flex;align-items:center;gap:8px;min-inline-size:0}
.tm-panel__id{flex:1;min-inline-size:0;display:grid;line-height:1.35}
.tm-panel__id b{font-size:15px;font-weight:900;display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-panel__id small{font-size:12.5px;color:var(--text-muted)}
.tm-fp{inline-size:28px;block-size:auto;flex:none}
.tm-panel__row{display:flex;align-items:center;gap:8px}
.tm-panel__row .tm-logo{flex:1;min-inline-size:0;justify-content:flex-end}
.tm-panel__row .tm-logo img{max-inline-size:100%}
.tm-panel__res{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:3px;padding:8px 3px 6px;border-radius:var(--radius-sm);background:var(--surface-sunken)}
.tm-log{max-block-size:300px;overflow:auto}
.tm-log .bgv-log__item{font-size:13.5px}
.tm-log .tm-ic{block-size:16px}
/* players area (BGA): header + collapsible sections */
.tm-player{display:grid;gap:12px;padding:12px;border-radius:var(--radius-md);background:var(--felt-plate);box-shadow:inset 0 0 0 2px var(--pc,transparent)}
/* area header like BGA: light Mars-dust plate in every theme (user choice), dark text */
.tm-ahead{--tm-red-ink:#C8322A;--tm-blue-ink:#2A72C4;--tm-green-ink:#2E8A3B;--tm-yellow-ink:#8A6A00;--tm-black-ink:#2B2B2B;display:flex;align-items:center;gap:10px 16px;flex-wrap:wrap;padding:10px 14px;border-radius:var(--radius-sm);background:linear-gradient(180deg,#F6ECDD,#E4CDAE);color:#1E2328;box-shadow:inset 0 0 0 1px rgba(107,58,28,.28),inset 0 1px 0 rgba(255,255,255,.7)}
.tm-ahead__name{display:inline-flex;align-items:center;block-size:30px;padding-inline:14px;border-radius:15px;background:#F4F5F6;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18);font-size:16px;font-weight:900}
.tm-ahead__name small{margin-inline-start:6px;font-size:12.5px;font-weight:700;color:#4A535B}
.tm-ahead .tm-logo{block-size:44px}
.tm-ahead .tm-score{inline-size:58px;block-size:58px;box-shadow:0 0 0 2px #FFFFFF,0 0 0 3.5px var(--tm-prod)}
.tm-ahead .tm-score b{font-size:23px}
.tm-ahead .tm-score small{font-size:11.5px}
.tm-ahead .tm-tr{inline-size:58px;block-size:44px}
.tm-ahead .tm-tr b{font-size:19px}
.tm-ahead .tm-handn{block-size:46px;padding-inline:10px;gap:6px;background:#FFFFFF;color:#1E2328;font-size:20px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}
.tm-ahead .tm-handn .tm-ic{block-size:34px}
.tm-ahead__res{display:flex;gap:10px;flex-wrap:wrap}
.tm-rs{display:flex;align-items:stretch}
.tm-rs>.tm-ic{block-size:46px;border-radius:4px}
.tm-rs__nums{display:grid;grid-template-rows:1fr auto;min-inline-size:42px}
.tm-rs__nums b{display:grid;place-items:center;padding-inline:4px;border-start-end-radius:4px;background:#FFFFFF;color:#1E2328;font-size:19px;font-weight:900;line-height:1.2;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}
.tm-ahead .tm-rs__nums .tm-prodv{min-inline-size:0;padding:1px 5px;border-radius:0;border-end-end-radius:4px;font-size:15px}
.tm-ahead .tm-tagc{inline-size:40px;block-size:40px}
.tm-ahead .tm-tagc b{font-size:17px;min-inline-size:22px}
.tm-ahead .tm-tagc.is-zero{opacity:.4}
.tm-ahead .tm-tags{gap:5px 4px}
.tm-ahead__tags{flex-basis:100%}
.tm-secs{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}
.tm-sec{display:grid;gap:8px;align-content:start;inline-size:calc(var(--cw) + 20px);padding:0 0 10px;border-radius:var(--radius-sm);border:1.5px dashed var(--felt-line)}
.tm-sec__head{display:flex;align-items:center;gap:4px;padding:6px 8px;border-radius:var(--radius-sm) var(--radius-sm) 0 0;background:var(--sec-bg);color:#FFFFFF}
.tm-sec--grey{--sec-bg:#5E6A72}.tm-sec--green{--sec-bg:#3E8E3A}.tm-sec--blue{--sec-bg:#2F6FB0}.tm-sec--red{--sec-bg:#B23A31}
.tm-sec__toggle{flex:1;min-inline-size:0;display:flex;align-items:center;gap:8px;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:start;cursor:pointer}
.tm-sec__n{display:grid;place-items:center;min-inline-size:26px;block-size:26px;border-radius:6px;background:rgba(0,0,0,.28);font-weight:900;font-size:14px}
.tm-sec__t{display:grid;line-height:1.25}
.tm-sec__t b{font-size:15px;font-weight:900}
.tm-sec__t small{font-size:11.5px;opacity:.88}
.tm-sec__menu{display:grid;place-items:center;inline-size:30px;block-size:30px;padding:0;border:0;border-radius:6px;background:rgba(255,255,255,.14);color:#FFFFFF;cursor:pointer}
.tm-sec__menu .bgv-icon{inline-size:18px;block-size:18px}
.tm-sec__toggle:focus-visible,.tm-sec__menu:focus-visible{outline:3px solid var(--focus-on-felt);outline-offset:2px}
.tm-sec.is-closed{padding:0;inline-size:auto;border-style:solid}
.tm-sec__body{padding-inline:10px}
.tm-grid{display:grid;gap:8px;justify-items:center}
.tm-stack{display:flex;flex-direction:column;align-items:center}
.tm-sec__body>.tm-card{inline-size:var(--cw)}
.tm-stack>.tm-card+.tm-card{margin-block-start:calc(var(--cw) * -1.406 * (1 - var(--band)))}
.tm-stack--blue{--band:.46}
.tm-stack--green{--band:.19}
.tm-stack--red{--band:.13}
.tm-stack>.tm-card:hover,.tm-stack>.tm-card:focus-visible{z-index:3}
.tm-cres{position:absolute;inset-block-start:30%;inset-inline-end:6%;display:inline-flex;align-items:center;gap:2px;padding:1px 6px 1px 2px;border-radius:var(--radius-pill);background:var(--tm-plate);color:#FFFFFF;font-size:13px;font-weight:900;direction:ltr}
.tm-cres .tm-ic{block-size:20px}
.tm-card>img.tm-cused{position:absolute;inset-block-start:4%;inset-inline-start:4%;inline-size:15%;block-size:auto;box-shadow:none;border-radius:0;filter:drop-shadow(0 1px 0 rgba(0,0,0,.6))}
/* payment (Game Kit 3 dock content) */
.tm-pay{display:grid;gap:6px}
.tm-payrow{display:grid;grid-template-columns:auto 1fr auto auto auto;align-items:center;gap:8px;font-size:14px}
.tm-payrow .tm-ic{block-size:22px}
.tm-payrow b{font-weight:900;color:var(--heading)}
.tm-payrow small{color:var(--text-muted);font-size:12.5px}
.tm-payrow.is-off{opacity:.45}
.tm-paysum{display:flex;justify-content:space-between;font-size:13.5px;color:var(--text);padding-block-start:4px;border-block-start:1px solid var(--line)}
.tm-paysum b{font-weight:900;color:var(--success)}
`;
