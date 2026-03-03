const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
const DEFAULTS = { sessionRestore: false, shortcuts: {} };

let _cache = null;

function load() {
  if (_cache) return _cache;
  try {
    _cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    _cache = { ...DEFAULTS };
  }
  return _cache;
}

function save(data) {
  _cache = data;
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2)); } catch {}
}

module.exports = { load, save };
