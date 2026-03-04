const { dialog, session, shell } = require('electron');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const fs = require('fs');

// ── Detect default browser ─────────────────────────────────────────────────────

function getDefaultBrowserType() {
  try {
    const desktop = execSync('xdg-settings get default-web-browser', { encoding: 'utf8' }).trim();
    if (desktop.includes('firefox')) return 'firefox';
    if (desktop.includes('chrome') || desktop.includes('chromium') || desktop.includes('brave')) return 'chromium';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// ── Firefox: read cookies from real profile (unencrypted) ───────────────────────

function findFirefoxCookieDb() {
  const ffDir = path.join(os.homedir(), '.mozilla', 'firefox');
  const iniPath = path.join(ffDir, 'profiles.ini');
  if (!fs.existsSync(iniPath)) return null;

  const ini = fs.readFileSync(iniPath, 'utf8');

  // [Install*] section's Default= points to the active profile
  const installMatch = ini.match(/\[Install[^\]]*\][\s\S]*?Default=(.+)/);
  if (installMatch) {
    const db = path.join(ffDir, installMatch[1].trim(), 'cookies.sqlite');
    if (fs.existsSync(db)) return db;
  }

  // Fallback: [Profile*] with Default=1
  for (const section of ini.split(/(?=\[Profile)/)) {
    if (/Default\s*=\s*1/.test(section)) {
      const m = section.match(/Path\s*=\s*(.+)/);
      const rel = /IsRelative\s*=\s*1/.test(section);
      if (m) {
        const profileDir = rel ? path.join(ffDir, m[1].trim()) : m[1].trim();
        const db = path.join(profileDir, 'cookies.sqlite');
        if (fs.existsSync(db)) return db;
      }
    }
  }
  return null;
}

function readFirefoxCookies(cookieDbPath) {
  // Copy DB + WAL/SHM to a temp dir so we can read while Firefox is running
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figlinux-cookies-'));
  const tmpDb = path.join(tmpDir, 'cookies.sqlite');
  try {
    fs.copyFileSync(cookieDbPath, tmpDb);
    for (const ext of ['-wal', '-shm']) {
      const src = cookieDbPath + ext;
      if (fs.existsSync(src)) fs.copyFileSync(src, tmpDb + ext);
    }

    const sql =
      'SELECT host, name, value, path, isSecure, isHttpOnly, expiry ' +
      "FROM moz_cookies WHERE host LIKE '%figma.com%'";
    const output = execSync(
      `sqlite3 -separator '|' "${tmpDb}" "${sql}"`,
      { encoding: 'utf8', timeout: 5000 },
    );
    if (!output.trim()) return [];

    const cookies = [];
    for (const line of output.trim().split('\n')) {
      if (!line) continue;
      const [host, name, value, cookiePath, secure, httpOnly, expiry] = line.split('|');
      if (!name) continue;
      const url = `https://${host.startsWith('.') ? host.slice(1) : host}${cookiePath || '/'}`;
      const cookie = { url, name, value: value || '', path: cookiePath || '/' };
      // __Host- cookies MUST NOT have a domain attribute (RFC 6265bis)
      if (!name.startsWith('__Host-')) cookie.domain = host;
      if (secure === '1') cookie.secure = true;
      if (httpOnly === '1') cookie.httpOnly = true;
      if (expiry && expiry !== '0') {
        const exp = parseInt(expiry);
        // Firefox stores expiry in ms since epoch; Electron expects seconds
        cookie.expirationDate = exp > 1e12 ? Math.floor(exp / 1000) : exp;
      }
      cookies.push(cookie);
    }
    return cookies;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Chromium: temp profile fallback (for Chrome/Brave/Vivaldi users) ────────────

function findChromiumBin() {
  for (const bin of [
    'google-chrome-stable', 'google-chrome', 'chromium-browser',
    'chromium', 'brave-browser', 'vivaldi-stable',
  ]) {
    try { execSync(`which ${bin}`, { stdio: 'ignore' }); return bin; }
    catch {}
  }
  return null;
}

function decryptChromeCookie(buf) {
  const prefix = buf.slice(0, 3).toString();
  if (prefix !== 'v10' && prefix !== 'v11') return buf.toString();
  const key = crypto.pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1');
  const iv = Buffer.alloc(16, 0x20);
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([decipher.update(buf.slice(3)), decipher.final()]).toString();
}

function readChromiumCookies(tmpDir) {
  const cookieDb = path.join(tmpDir, 'Default', 'Cookies');
  if (!fs.existsSync(cookieDb)) return [];

  const sql =
    'SELECT host_key, name, hex(encrypted_value), path, is_secure, ' +
    "is_httponly, expires_utc FROM cookies WHERE host_key LIKE '%figma.com%'";
  const output = execSync(
    `sqlite3 -separator '|' "${cookieDb}" "${sql}"`,
    { encoding: 'utf8', timeout: 5000 },
  );
  if (!output.trim()) return [];

  const cookies = [];
  for (const line of output.trim().split('\n')) {
    if (!line) continue;
    const [host, name, hexVal, cookiePath, secure, httpOnly, expiresUtc] = line.split('|');
    if (!name || !hexVal) continue;
    try {
      const value = decryptChromeCookie(Buffer.from(hexVal, 'hex'));
      const url = `https://${host.startsWith('.') ? host.slice(1) : host}${cookiePath || '/'}`;
      const cookie = { url, name, value, domain: host, path: cookiePath || '/' };
      if (secure === '1') cookie.secure = true;
      if (httpOnly === '1') cookie.httpOnly = true;
      if (expiresUtc && expiresUtc !== '0') {
        cookie.expirationDate = Math.floor(parseInt(expiresUtc) / 1000000) - 11644473600;
      }
      cookies.push(cookie);
    } catch {}
  }
  return cookies;
}

// ── Inject cookies into Electron ────────────────────────────────────────────────

async function injectCookies(cookies) {
  const ses = session.defaultSession;
  let count = 0;
  for (const cookie of cookies) {
    try { await ses.cookies.set(cookie); count++; } catch {}
  }
  return count > 0;
}

// ── Main entry point ────────────────────────────────────────────────────────────

async function signInViaBrowser(parentWin, authUrl) {
  try { execSync('which sqlite3', { stdio: 'ignore' }); }
  catch {
    dialog.showErrorBox('sqlite3 not found', 'Install with:  sudo dnf install sqlite');
    return false;
  }

  const browserType = getDefaultBrowserType();

  // ── Firefox: open in default browser, read cookies from real profile ──────
  if (browserType === 'firefox') {
    const cookieDb = findFirefoxCookieDb();
    if (!cookieDb) {
      dialog.showErrorBox('Firefox profile not found', 'Could not locate Firefox cookies.');
      return false;
    }

    // Always open the login page (not the SSO URL directly). The user must
    // click "Continue with Google" inside Firefox so the full popup flow
    // completes: popup → Google → callback → postMessage → parent → dashboard.
    // Opening start_google_sso directly skips the popup mechanism and leaves
    // the session incomplete (postMessage has no opener to talk to).
    shell.openExternal('https://www.figma.com/login');

    const { response } = await dialog.showMessageBox(parentWin, {
      type: 'info',
      title: 'Sign in with Google',
      message: 'Complete the sign-in in your browser.',
      detail:
        '1. Click "Continue with Google" in Firefox\n' +
        '2. Sign in to your Google account\n' +
        '3. Wait until you see the Figma dashboard\n' +
        '4. Click "Done" below',
      buttons: ['Done', 'Cancel'],
    });
    if (response === 1) return false;

    const cookies = readFirefoxCookies(cookieDb);
    if (cookies.length === 0) {
      dialog.showErrorBox('No cookies found', 'Could not read Figma session from Firefox.\nTry using email + password instead.');
      return false;
    }
    return injectCookies(cookies);
  }

  // ── Chromium: temp profile (Chrome encrypts real profile cookies) ──────────
  const chromiumBin = findChromiumBin();
  if (chromiumBin) {
    const AUTH_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figlinux-auth-'));
    return new Promise((resolve) => {
      const child = spawn(chromiumBin, [
        `--user-data-dir=${tmpDir}`, '--password-store=basic',
        '--no-first-run', '--no-default-browser-check',
        authUrl || 'https://www.figma.com/login',
      ], { stdio: 'ignore' });

      let settled = false;
      const finish = async (timedOut) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (timedOut) {
          child.kill();
          dialog.showErrorBox('Sign-in timed out', 'The sign-in browser was open for too long.\nPlease try again.');
          resolve(false);
          return;
        }
        setTimeout(async () => {
          try {
            const cookies = readChromiumCookies(tmpDir);
            resolve(cookies.length > 0 ? await injectCookies(cookies) : false);
          } catch (e) {
            console.error('[figlinux] Cookie transfer failed:', e.message);
            resolve(false);
          } finally {
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
          }
        }, 500);
      };

      const timer = setTimeout(() => finish(true), AUTH_TIMEOUT_MS);

      dialog.showMessageBox(parentWin, {
        type: 'info',
        title: 'Sign in with Google',
        message: 'A browser window has opened.',
        detail:
          'Sign in to Figma with Google there.\n\n' +
          'After you see the Figma dashboard, close that browser window.',
        buttons: ['OK'],
        noLink: true,
      });

      child.on('exit', () => finish(false));
    });
  }

  // ── No supported browser ──────────────────────────────────────────────────
  dialog.showErrorBox(
    'No supported browser found',
    'Google sign-in requires Firefox, Chrome, or Chromium.\n\n' +
    'Or use email + password to sign in directly.',
  );
  return false;
}

module.exports = { signInViaBrowser };
