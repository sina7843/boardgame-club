"""Order BGA Heat USA circuit cells into spaces (2 lanes each) along the direction of travel -> tools/cards-d/heat-usa.json.
Cells come from the public tutorial setup (sources/bga/materials.json, circuitDatas.cells: id -> {x,y,a} on the 1650×1100 board)."""
import json, math
SRC = 'X:/Work/01_Clients/دراگون/boardgameverse/Games Redesign/other games/heat/sources/bga/materials.json'
cd = json.load(open(SRC, encoding='utf-8'))['data']['circuitDatas']
cells = {int(k): (v['x'], v['y'], v['a']) for k, v in cd['cells'].items()}
ids = sorted(cells)
# pair lanes: each cell with its nearest other cell (lanes ~32 px apart, spaces further)
used, spaces = set(), []
for i in ids:
    if i in used: continue
    j = min((k for k in ids if k != i and k not in used), key=lambda k: math.dist(cells[i][:2], cells[k][:2]))
    used |= {i, j}
    spaces.append((i, j))
cen = lambda s: ((cells[s[0]][0] + cells[s[1]][0]) / 2, (cells[s[0]][1] + cells[s[1]][1]) / 2)
start = [s for s in spaces if cd['startingCells'][0] in s][0]
order = [start]; left = [s for s in spaces if s != start]
# direction: from the start space, go toward the space whose id is next after the start cells' max id (ids grow along travel on BGA)
while left:
    cur = cen(order[-1])
    nxt = min(left, key=lambda s: math.dist(cur, cen(s)) + (0 if len(order) > 1 else (0 if min(s) > max(order[0]) else 1e6)))
    order.append(nxt); left.remove(nxt)
gaps = [round(math.dist(cen(order[k]), cen(order[k + 1]))) for k in range(len(order) - 1)]
out = {'board': [1650, 1100], 'corners': cd['corners'], 'spaces': [[list(cells[a]), list(cells[b]), a, b] for a, b in order]}
json.dump(out, open('E:/AI/Claude/bgv-groupa/tools/cards-d/heat-usa.json', 'w'), indent=0)
print(len(order), 'spaces; max gap', max(gaps), 'gaps>80:', [k for k, g in enumerate(gaps) if g > 80][:10])
print('first ids', [min(s) for s in order[:8]])
