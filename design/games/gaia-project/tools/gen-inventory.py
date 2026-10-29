# Markdown table of every Gaia component (from the publisher set's component-coverage.json), with where the
# handoff uses it and what is missing. py -I gen-inventory.py <component-coverage.json> <art dir> > inventory.md
import json, os, sys

cov = json.load(open(sys.argv[1], encoding='utf8'))
art = sys.argv[2]
USE = {  # component -> where it appears in COMPONENTS.md
    'Space sectors': '§3.2', 'Faction boards': '§7', 'Research board': '§4', 'Scoring board': '§5',
    'Standard technology tiles': '§4.2–4.3، §7.6', 'Advanced technology tiles': '§4.1', 'Round boosters': '§6، §7.4',
    'Round scoring tiles': '§5.1', 'Final scoring tiles': '§5.2', 'Federation tokens': '§4.8، §7.6',
    'Space stations': '§3.9', 'Action tokens': '§4.7، §7.6', 'Record tokens': 'جای مصرف در دیزاین تعیین نشده',
    'Gaia planet tokens': '§3.7', 'Lost planet token': '§3.10', 'Mines': '§3.6، §7.2', 'Trading stations': '§3.6، §7.2',
    'Research labs': '§3.6، §7.2', 'Academies': '§3.6، §7.2', 'Planetary institutes': '§3.6، §7.2', 'Gaiaformers': '§3.7',
    'Satellites': '§3.8، §4.4، §5.3–5.4', 'Player tokens': '§3.7 (گایاساز)', 'Credit markers': '§2، §8 (آیکون)',
    'Ore markers': '§2، §8 (آیکون)', 'Knowledge markers': '§2، §8 (آیکون)', 'QIC': '§2، §8 (آیکون)',
    'Power tokens': '§7.3', 'Brainstone': '§7.3 (تاکلون‌ها)', 'First player marker': 'ریل، نفر اول دور بعد (اختیاری)',
    'Turn order card': 'مرجع؛ در UI لازم نیست', 'Player aids': 'مرجع؛ راهنمای بازی', 'Terraforming reference card': 'مرجع؛ چرخهٔ زمین‌سازی',
    'Automa faction cards': 'خارج از این فاز (بازی تک‌نفره)', 'Automa decision cards': 'خارج از این فاز', 'Automa player aid': 'خارج از این فاز',
    'Main rulebook': 'مرجع قانون', 'Automa rulebook': 'مرجع قانون (تک‌نفره)', 'Planet artwork': '§2، §3، §5.4',
}
GAP = {  # status words -> Persian note for the team
    'fronts-only': 'پشت توکن‌ها نیست',
    'low-resolution': 'کیفیت پایین',
    'partial-low-resolution': 'ناقص و کیفیت پایین',
    'available-English-fronts': 'فقط روی انگلیسی؛ پشت نیست',
    'missing-original-card-scans': 'اسکن کارت‌ها نیست؛ دادهٔ آن در data/automa-data.json',
    'missing-independent-art': 'هنر جدا نیست؛ فقط در دفترچهٔ قانون',
}
rows = []
for c in cov:
    if not c.get('component'):
        continue
    folder = c.get('folder') or ''
    where = ('`reference/rules/' + os.path.basename(folder) + '`') if folder.startswith('reference-documents') else (('`art/' + folder + '/`') if folder else '—')
    gap = GAP.get(c['status'], '')
    if 'Record tokens' == c['component']: gap = 'پشت توکن پیدا نشده'
    rows.append(f"| {c['component']} | {c.get('physicalQuantity') or '—'} | {where} | {USE.get(c['component'], '—')} | {gap or '✅'} |")
print('| قطعه | تعداد در جعبه | پوشه | کجای این سند | کمبود |')
print('| --- | --- | --- | --- | --- |')
print('\n'.join(rows))
