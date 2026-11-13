// Tiny static server for previewing the Gaia pilot overlays: node serve.js <root> <port>
const http = require('http'), fs = require('fs'), path = require('path');
const [root, port] = [process.argv[2], Number(process.argv[3] || 5178)];
const types = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(path.resolve(root))) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(port, () => console.log('serving ' + root + ' on ' + port));
