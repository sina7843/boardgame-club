# Box photos from the BGG snapshot → apps/web/public/covers/box/<gameId>.webp (max 640 px, self-hosted).
# Run after scripts/bgg-sync.mjs. Requires Pillow.
import io, json, pathlib, urllib.request
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'apps/web/public/covers/box'
out.mkdir(parents=True, exist_ok=True)
games = json.loads((root / 'apps/web/src/data/bgg.json').read_text('utf-8'))['games']
for game_id, g in games.items():
    if not g.get('image'):
        continue
    req = urllib.request.Request(g['image'], headers={'User-Agent': 'persian-boardgame-webapp bgg-sync'})
    with urllib.request.urlopen(req, timeout=60) as r:
        img = Image.open(io.BytesIO(r.read()))
    img = img.convert('RGBA' if img.mode in ('RGBA', 'LA', 'P') else 'RGB')
    img.thumbnail((640, 640))
    img.save(out / f'{game_id}.webp', 'WEBP', quality=80, method=6)
    print(game_id, img.size)
