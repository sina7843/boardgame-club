"""Extract Ticket to Ride USA map geometry (cities, routes with slot transforms and colour) from the art pack's export-spec into tools/cards-d/ttr-usa.json."""
import json, re, math
SPEC = 'X:/Work/01_Clients/دراگون/boardgameverse/Games Redesign/other games/ticket-to-ride/ready to use/data/export-spec.json'
d = json.load(open(SPEC, encoding='utf-8'))
h = [x for x in d['jobs'] if x['id'] == 'usa-map'][0]['html']
vb = [float(v) for v in re.search(r'viewBox="([-\d. ]+)"', h).group(1).split()]
cities = []
for m in re.finditer(r'<g class="ttr-city"><g transform="translate\(([-\d.]+) ([-\d.]+)\)">.*?<text y="[-\d.]+" class="ttr-plaque__t">([^<]+)</text>', h, re.S):
    cities.append({'name': m.group(3), 'x': float(m.group(1)), 'y': float(m.group(2))})
def near(x, y):
    best = min(cities, key=lambda c: (c['x'] - x) ** 2 + (c['y'] - y) ** 2)
    return best['name'], math.hypot(best['x'] - x, best['y'] - y)
routes = []
parts = h.split('<g class="ttr-route')
for p in parts[1:]:
    path = re.search(r'<path d="M([-\d.]+) ([-\d.]+) Q[-\d. ]+ ([-\d.]+) ([-\d.]+)"', p)
    if not path: continue
    x1, y1, x2, y2 = map(float, path.groups())
    slots = []
    for s in re.finditer(r'<g transform="translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\)"><rect x="[-\d.]+" y="[-\d.]+" width="([\d.]+)"[^>]*class="ttr-slot__shadow"></rect><rect[^>]*class="ttr-slot" fill="url\(#ttr-c-(\d+)\)"', p):
        slots.append([round(float(s.group(1)), 1), round(float(s.group(2)), 1), round(float(s.group(3)), 1), round(float(s.group(4)), 1)])
        col = int(s.group(5))
    a, da = near(x1, y1); b, db = near(x2, y2)
    routes.append({'a': a, 'b': b, 'len': len(slots), 'color': col if slots else None, 'slots': slots})
json.dump({'viewBox': vb, 'cities': cities, 'routes': routes}, open('E:/AI/Claude/bgv-groupa/tools/cards-d/ttr-usa.json', 'w', encoding='utf-8'), ensure_ascii=False)
print(len(cities), 'cities', len(routes), 'routes', 'viewBox', vb)
from collections import Counter
print(Counter(r['color'] for r in routes))
for r in routes[:6]: print(r['a'], r['b'], r['len'], r['color'])
