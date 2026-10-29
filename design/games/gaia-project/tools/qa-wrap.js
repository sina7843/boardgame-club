// Turn each .dc.html artboard into a plain page (helmet -> head, no DC script) for local QA: node qa-wrap.js <gaiaDir>
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.dc.html'))) {
  let h = fs.readFileSync(path.join(dir, f), 'utf8');
  const helmet = (h.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1];
  h = h.replace(/<helmet>[\s\S]*?<\/helmet>/, '').replace(/<script src="\.\/support\.js"><\/script>/, '')
       .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '').replace(/<\/?x-dc>/g, '')
       .replace('</head>', helmet + '\n</head>');
  fs.writeFileSync(path.join(dir, '_qa-' + f.replace('.dc.html', '.html')), h);
}
