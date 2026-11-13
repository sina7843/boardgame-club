# پرامپت ساخت آواتارهای بردگیم‌ورس با GPT

دو پرامپت است: اولی ۲۴ آواتار آماده برای صفحه‌ی ثبت نام می‌سازد، دومی لایه‌های سازنده‌ی آواتار در پروفایل را. هر کدام را جدا به GPT بده.

بهتر است اول با پرامپت ۱ فقط ۴ آواتار بخواهی (عبارت «24» را موقتاً «4» کن). اگر سبک را پسندیدی، بقیه را در همان گفتگو بخواه تا سبک یکی بماند.

---

## پرامپت ۱: مجموعه‌ی آواتار آماده (SVG)

```
You are an illustrator and SVG engineer. Create a set of 24 profile avatars for "Boardgameverse" (بردگیم‌ورس), a Persian online board-game website. Deliver each avatar as its own clean, hand-written SVG file.

STYLE
- Soft 3D "toy / clay figure" look, like a premium mobile-game avatar: rounded volumes, gentle top-left key light, soft ambient shadow, subtle rim light. Create the 3D feel ONLY with linearGradient and radialGradient fills and a few soft shapes for shadows — no photo textures.
- Head-and-shoulders portrait, centered, facing slightly toward the viewer, friendly expression, eyes open. Whole figure fits inside a circle (the site crops avatars to a circle): keep everything important inside a centered circle of radius 230 in a 512×512 viewBox.
- Background: a filled circle (r=256) in one flat brand colour per avatar, with a faint radial highlight. Rotate through these backgrounds: #142B3B (navy), #20394A (felt blue), #E8A642 (amber), #FAF5EC (cream), #8ED0C8 (teal), #F2A9C4 (pink), #A7C7F2 (sky), #C9B7F0 (lavender).
- Brand accent colours you may use in clothes and props: navy #142B3B, amber #E8A642, cream #FAF5EC, deep amber #D8942F.
- Each avatar carries ONE small board-game detail so the set feels made for this site: a die earring, a meeple pin, a card tucked behind the ear, a chess-knight necklace, a backgammon checker badge, a tiny UNO-style colour card (no logo, no letters), a hexagon tile brooch, a pawn hair clip.

CAST (mix them; no two alike)
- 14 people: different ages (teen to older adult), genders and skin tones; hairstyles from short to long and curly; 3 of the women wear a loose, colourful headscarf; 3 people wear glasses; 2 have beards. Contemporary casual clothes (hoodie, shirt, sweater, scarf). Make them look like people you could meet in Tehran, Shiraz or Tabriz without stereotypes or traditional costumes.
- 6 "meeple" characters: board-game meeple shapes with faces and small accessories (cap, scarf, headphones, crown, glasses, backpack).
- 4 animal mascots playing board games: a cat, a fox, an owl, a Persian leopard cub — each holding or wearing a game piece.

TECHNICAL RULES (important — the site renders these inline; files that break these rules will be rejected)
- <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">; no fixed width/height in other units.
- Only these elements: svg, g, path, circle, ellipse, rect, defs, linearGradient, radialGradient, stop, clipPath. Optionally ONE feGaussianBlur filter for the soft floor shadow.
- NO <image>, NO <text>, NO <style> blocks, NO CSS classes, NO <foreignObject>, NO <script>, NO external references, NO embedded raster data, NO xlink:href to anything outside the file.
- Every id must be unique across the whole set: prefix ids with the file name, e.g. "av07-skin", "av07-hair-grad".
- Colours as hex only. No opacity on whole groups; put opacity on fills (fill-opacity) where needed.
- Keep paths simple: at most ~120 path elements and under 45 KB per file. Round coordinates to 1 decimal.
- No text, letters, numbers, logos or real game branding anywhere in the art.
- It must still read clearly at 32×32 px: strong silhouette, high contrast between face, hair and background.

OUTPUT
- File names av01.svg … av24.svg.
- After the files, give a table: file name, background colour, who it is (short Persian description, e.g. «دختر نوجوان با هدفون و گوشواره‌ی تاس»).
```

---

## پرامپت ۲: لایه‌های سازنده‌ی آواتار (SVG)

```
Using the exact same style, light and palette as the avatar set above, create a layered avatar kit for an in-profile avatar builder. Every layer is a separate SVG in the same 512×512 viewBox and must line up perfectly when stacked in this order:

1. background (8 variants: the 8 brand background circles)
2. body / shoulders + clothing (10 variants: hoodie, shirt, sweater, scarf, jacket… in brand colours)
3. head / face shape with skin (8 skin tones × 3 face shapes = 24 variants)
4. eyes (8 variants), 5. eyebrows (6), 6. mouth (8), 7. nose (4)
8. hair (16 variants, including 4 headscarf styles and bald/very short) — hair must sit correctly on all 3 face shapes
9. glasses (5 variants + none), 10. facial hair (5 variants + none)
11. board-game accessory (10 variants: die earring, meeple pin, card behind ear, knight necklace, checker badge, colour card, hexagon brooch, pawn clip, crown, headphones)

Rules:
- Same technical rules as the first set (no image/text/style/script, unique prefixed ids like "kit-hair07-grad", hex colours, under 25 KB per layer).
- Skin colour must come from ONE fill on the head layer so the builder can recolour it: give that path id "kit-skin" and use fill="#E0A884" as the default.
- Hair colour likewise: the main hair path(s) use fill="#3B2A20" and carry data-recolor="hair".
- Anchor points: eyes centred at y=250, mouth at y=318, shoulders start at y=400. Keep these the same in every variant.
- File names: kit-<layer>-<nn>.svg (e.g. kit-hair-07.svg).
- At the end, give a JSON manifest: [{ "layer": "hair", "id": "kit-hair-07", "file": "kit-hair-07.svg", "labelFa": "موی فرفری بلند" }, …].
```

---

## بعد از ساخت

- فایل‌ها را در `Games Redesign/avatars/ready to use` بگذار. من چک می‌کنم که قاعده‌های فنی رعایت شده باشد (بدون `image`، `text` و `style`، و idهای یکتا)، بعد آن‌ها را به دیزاین سیستم و صفحه‌های ثبت نام و پروفایل وصل می‌کنم.
- اگر فایلی قاعده را رعایت نکرده بود، همان را با پیغام «این فایل `<image>` دارد، بدون آن دوباره بساز» به GPT برگردان.
