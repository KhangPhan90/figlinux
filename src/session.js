const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(app.getPath('userData'), 'session.json');

function save(tabs) {
  const urls = tabs.map(t => t.url).filter(Boolean);
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ urls }));
  } catch (e) {
    console.error('[session] save error:', e.message);
  }
}

function load() {
  try {
    const { urls } = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    if (Array.isArray(urls) && urls.length > 0) return urls;
  } catch {
    // first run or corrupt file — start fresh
  }
  return null;
}

module.exports = { save, load };
