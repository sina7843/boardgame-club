# tools (design side only, not for the site)

Rebuild the artboards after a design change (Node 24, Python 3 with Pillow + numpy, Chrome):

1. `node --experimental-strip-types mock2.mjs 3 mock.json` inside a copy of `games/ark-nova/src` with stubbed `zod` / `@bg/game-sdk` (see the header of `mock2.mjs`) → the engine-built position (`data/mock-state.json`).
2. `py -I pack-art.py "<ready to use - flat>" <bga icon cuts> ../art` (+ `cut-bga-icons.py` for `art/ui`, `building-cells.py` for `data/building-cells.json`).
3. `node build-an.js <canvas root>` → `project/ark-nova/*.dc.html`; `qa-wrap.js` → offline pages; `render-ref.py` → reference images; `measure.py` → real heights.
4. `to-blob.js` + `canvas-edit.js` publish to the canvas (images live in the canvas asset store).
5. `make-package.js` + `make-zip.py` → this handoff.

Geometry helpers: `gridcrop.py` (grid overlay to measure), `check-maps.py` (engine cells on all 10 maps), `an-lib.js` (`fitBuilding`, all constants mirrored in `layout.json`).
