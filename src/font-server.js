const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 18412;
const VERSION = 17;

function fcWeightToCss(w) {
  if (w < 40)  return '100';
  if (w < 50)  return '200';
  if (w < 75)  return '300';
  if (w < 100) return '400';
  if (w < 110) return '500';
  if (w < 200) return '600';
  if (w < 205) return '700';
  if (w < 210) return '800';
  return '900';
}

function scanFonts() {
  try {
    const output = execSync(
      'fc-list --format "%{file}|%{family}|%{weight}|%{style}|%{postscriptname}\\n"',
      { env: { ...process.env, LANG: 'C' }, maxBuffer: 10 * 1024 * 1024 }
    ).toString();

    const fonts = {};
    for (const line of output.split('\n')) {
      const parts = line.split('|');
      if (parts.length < 5) continue;

      const file = parts[0].trim();
      const ext = path.extname(file).toLowerCase();
      if (!['.ttf', '.otf', '.ttc'].includes(ext)) continue;

      const family    = parts[1].split(',')[0].trim();
      const weightRaw = parseInt(parts[2].split(',')[0].trim()) || 80;
      const style     = parts[3].split(',')[0].trim();
      const postscript = parts[4].split(',')[0].trim();
      const italic    = /italic|oblique/i.test(style);

      fonts[file] = {
        localizedFamily: family,
        postscript,
        style,
        weight: fcWeightToCss(weightRaw),
        stretch: 5,
        italic,
        family,
        localizedStyle: style,
      };
    }

    console.log(`[font-server] discovered ${Object.keys(fonts).length} fonts`);
    return fonts;
  } catch (e) {
    console.error('[font-server] fc-list error:', e.message);
    return {};
  }
}

// Font metadata cached once at startup
let fontCache = null;

function start() {
  fontCache = scanFonts(); // warm up synchronously before window opens

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

    if (url.pathname === '/figma/version' || url.pathname === '/figma/update') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ version: VERSION }));
    }

    if (url.pathname === '/figma/font-files') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ version: VERSION, fontFiles: fontCache }));
    }

    if (url.pathname === '/figma/font-file') {
      const file = url.searchParams.get('file');
      if (!file) { res.writeHead(400); return res.end(); }

      // Strict whitelist: only serve files that were discovered during font scan.
      // Prevents path traversal attacks (e.g. ?file=/etc/passwd).
      if (!fontCache[file]) { res.writeHead(403); return res.end(); }

      try {
        res.setHeader('Content-Type', 'application/octet-stream');
        return res.end(fs.readFileSync(file));
      } catch {
        res.writeHead(404); return res.end();
      }
    }

    res.writeHead(403);
    res.end('Unauthorized');
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[font-server] listening on http://127.0.0.1:${PORT}`);
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log('[font-server] port already in use — another font agent running');
    } else {
      console.error('[font-server] error:', e);
    }
  });
}

module.exports = { start };
