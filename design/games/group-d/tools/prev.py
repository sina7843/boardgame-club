# Local static preview of group artboards: py -I -X utf8 prev.py <file.dc.html>... -> preview/*.html + jobs.json
import re, json, sys, os
import glob
LOC = {}
for _f in glob.glob('E:/AI/Claude/bgv-groupa/art/local-map*.json'): LOC.update(json.load(open(_f, encoding='utf-8')))
os.makedirs('E:/AI/Claude/bgv-groupa/preview', exist_ok=True)
jobs = []
for f in sys.argv[1:]:
    s = open(f, encoding='utf-8').read()
    helmet = re.search(r'<helmet>(.*?)</helmet>', s, re.S).group(1)
    body = s.split('</helmet>', 1)[1].split('</x-dc>')[0]
    w, h = map(int, re.search(r'"width":(\d+),"height":(\d+)', s).groups())
    for k, v in LOC.items():
        body = body.replace(k, v); helmet = helmet.replace(k, v)
    html = ('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">'
            '<link rel="stylesheet" href="file:///E:/AI/Claude/bgv-fb/cv13/project/ds/bgv/tokens.css">'
            '<link rel="stylesheet" href="file:///E:/AI/Claude/bgv-fb/ds/project/components/bundle.css">'
            '<style>@font-face{font-family:Peyda;src:url(file:///E:/AI/Claude/bgv-fb/fonts/peyda/Peyda-Regular.woff2);font-weight:400}'
            '@font-face{font-family:Peyda;src:url(file:///E:/AI/Claude/bgv-fb/fonts/peyda/Peyda-Bold.woff2);font-weight:700}'
            '@font-face{font-family:Peyda;src:url(file:///E:/AI/Claude/bgv-fb/fonts/peyda/Peyda-Black.woff2);font-weight:900}</style>'
            + helmet + '</head><body style="margin:0">' + body + '</body></html>')
    name = os.path.basename(f).replace('.dc.html', '')
    out = f'E:/AI/Claude/bgv-groupa/preview/{name}.html'
    open(out, 'w', encoding='utf-8').write(html)
    jobs.append({'url': 'file:///' + out, 'out': out.replace('.html', '.png'), 'width': w, 'height': 900, 'full': True})
json.dump(jobs, open('E:/AI/Claude/bgv-groupa/preview/jobs' + (os.environ.get('JOBS_TAG','')) + '.json', 'w'))
print(len(jobs), 'previews')
