/**
 * CampusIQ second-pass checks (validation, approvals, broadcast, forgot-password).
 * Run: node scripts/e2e_actions2.js
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

process.loadEnvFile?.('.env');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://127.0.0.1:5173';
const SVC = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^"|"$/g, '');
const SUPA = (process.env.VITE_SUPABASE_URL || '').replace(/^"|"$/g, '');
const SHOTS = '/private/var/folders/72/s6nn2yp11bd5mw5dj5jxxhwc0000gn/T/opencode/shots';
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const record = (area, check, status, notes = '') => { results.push({ area, check, status, notes }); console.log(`[${status}] ${area} — ${check}${notes ? ' :: ' + notes : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function rest(method, table, body, query = '') {
  const r = await fetch(`${SUPA}/rest/v1/${table}${query}`, {
    method,
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  try { return { status: r.status, rows: text ? JSON.parse(text) : [] }; } catch { return { status: r.status, rows: text }; }
}

async function loginViaUI(page, email, password = 'campus123') {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
  const usedDemo = await page.evaluate((email) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.innerText.includes(email));
    if (b) { b.click(); return true; }
    return false;
  }, email);
  if (!usedDemo) {
    await page.click('input[type="email"]');
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
  }
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find(x => /continue/i.test(x.innerText)); b?.click(); });
  await page.waitForSelector('#otp-0', { timeout: 8000 });
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Fill demo/.test(x.innerText)); b?.click(); });
  await sleep(250);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Verify/.test(x.innerText)); b?.click(); });
  await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: 12000 });
  await sleep(700);
}
async function logoutViaUI(page) {
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Sign out/i.test(x.innerText)); b?.click(); });
  await sleep(800);
}
const bodyText = page => page.evaluate(() => document.body.innerText);

const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => {
  const orig = URL.createObjectURL.bind(URL);
  window.__blobs = [];
  URL.createObjectURL = function (obj) { window.__blobs.push(obj); return orig(obj); };
});

const e2eEmail = `e2e2_${Date.now()}@gehu.ac.in`;

/* ===== A. Forgot password full flow on a disposable account ===== */
let e2eAccountId = null;
try {
  const mk = await rest('POST', 'accounts', { email: e2eEmail, password_hash: 'original-pass-999', full_name: 'E2E Reset Tester', role: 'student', status: 'active', institution: 'Graphic Era Hill University, Dehradun' });
  e2eAccountId = mk.rows?.id ?? mk.rows?.[0]?.id;
  // NOTE: row stores legacy plaintext; app must still accept it (legacy fallback) and upgrade on login.
  await page.goto(`${BASE}/forgot`, { waitUntil: 'networkidle2' });
  await page.click('input[type="email"]');
  await page.type('input[type="email"]', e2eEmail);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Send code/i.test(x.innerText)); b?.click(); });
  await sleep(4000);
  let t = await bodyText(page);
  record('forgot', 'known email advances to code step', /enter code/i.test(t) ? 'PASS' : 'FAIL');
  // Read the demo code from the page
  const code = await page.evaluate(() => (document.body.innerText.match(/Demo code:\s*(\d{6})/) || [])[1]);
  await page.type('input[aria-label="6-digit code"]', code || '');
  await page.type('input[aria-label="New password"]', 'brand-new-pass-456');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Verify & set/i.test(x.innerText)); b?.click(); });
  await sleep(1800);
  t = await bodyText(page);
  record('forgot', 'password reset completes', /password reset/i.test(t) ? 'PASS' : 'FAIL');
  // New password works?
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.click('input[type="email"]');
  await page.type('input[type="email"]', e2eEmail);
  await page.type('input[type="password"]', 'brand-new-pass-456');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find(x => /continue/i.test(x.innerText)); b?.click(); });
  await sleep(7000);
  t = await bodyText(page);
  record('forgot', 'new password accepted at login', /Verify it's you/i.test(t) ? 'PASS' : 'FAIL');
  // Old password rejected
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.click('input[type="email"]');
  await page.type('input[type="email"]', e2eEmail);
  await page.type('input[type="password"]', 'original-pass-999');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find(x => /continue/i.test(x.innerText)); b?.click(); });
  await sleep(7000);
  t = await bodyText(page);
  record('forgot', 'old password rejected', /Incorrect password/i.test(t) ? 'PASS' : 'FAIL');
  // Unknown email shows error
  await page.goto(`${BASE}/forgot`, { waitUntil: 'networkidle2' });
  await page.click('input[type="email"]');
  await page.type('input[type="email"]', 'no-such-user-xyz@gehu.ac.in');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Send code/i.test(x.innerText)); b?.click(); });
  await sleep(6000);
  t = await bodyText(page);
  record('forgot', 'unknown email shows error', /No account matches/i.test(t) ? 'PASS' : 'FAIL');
} catch (e) { record('forgot', 'forgot password flow', 'FAIL', String(e).slice(0, 250)); }

/* ===== B. Signup validations ===== */
const dupEmail = `e2e_dup_${Date.now()}@gehu.ac.in`;
let dupId = null;
try {
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle2' });
  await page.click('input[placeholder="Your legal name"]');
  await page.type('input[placeholder="Your legal name"]', 'E2E Dup Tester');
  await page.click('input[placeholder="you@gehu.ac.in"]');
  await page.type('input[placeholder="you@gehu.ac.in"]', dupEmail);
  await page.click('input[placeholder="Minimum 8 characters"]');
  await page.type('input[placeholder="Minimum 8 characters"]', 'short');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find(x => /Create account/i.test(x.innerText)); b?.click(); });
  await sleep(800);
  let t = await bodyText(page);
  const stillSignup = page.url().includes('/signup');
  const noErr = !/already exists/i.test(t);
  record('signup', 'short password blocked (browser validation)', stillSignup && noErr ? 'PASS' : 'FAIL', page.url());
  // Fix password, submit, then re-submit same email → duplicate error
  await page.click('input[placeholder="Minimum 8 characters"]', { clickCount: 3 });
  await page.type('input[placeholder="Minimum 8 characters"]', 'long-enough-pass-1');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find(x => /Create account/i.test(x.innerText)); b?.click(); });
  await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: 15000 });
  const acc = await rest('GET', 'accounts', undefined, `?email=eq.${encodeURIComponent(dupEmail)}&select=id`);
  dupId = Array.isArray(acc.rows) ? acc.rows[0]?.id : acc.rows?.id;
  record('signup', 'disposable signup succeeds', !!dupId ? 'PASS' : 'FAIL');
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle2' });
  await page.click('input[placeholder="Your legal name"]');
  await page.type('input[placeholder="Your legal name"]', 'E2E Dup Again');
  await page.click('input[placeholder="you@gehu.ac.in"]');
  await page.type('input[placeholder="you@gehu.ac.in"]', dupEmail);
  await page.click('input[placeholder="Minimum 8 characters"]');
  await page.type('input[placeholder="Minimum 8 characters"]', 'long-enough-pass-1');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find(x => /Create account/i.test(x.innerText)); b?.click(); });
  await sleep(8000);
  t = await bodyText(page);
  record('signup', 'duplicate email shows error', /already exists/i.test(t) ? 'PASS' : 'FAIL', (t.match(/already[^\n]{0,80}/i) || [''])[0]);
} catch (e) { record('signup', 'signup validation', 'FAIL', String(e).slice(0, 250)); }

/* ===== C. Account Approvals: approve a disposable pending request via UI ===== */
let e2eRequestId = null;
try {
  const mk = await rest('POST', 'profile_requests', { user_email: e2eEmail, user_name: 'E2E Reset Tester', role: 'student', changes: { nickname: { from: 'E2E Reset Tester', to: 'E2E2Nick' } }, note: 'E2E approve test', status: 'pending' });
  e2eRequestId = mk.rows?.id ?? mk.rows?.[0]?.id;
  await logoutViaUI(page).catch(() => {});
  await loginViaUI(page, 'admin@gehu.ac.in');
  await page.goto(`${BASE}/app/account-approvals`, { waitUntil: 'networkidle2' });
  await sleep(1200);
  let t = await bodyText(page);
  const sees = t.includes('E2E Reset Tester');
  record('approvals', 'admin sees disposable pending request', sees ? 'PASS' : 'FAIL');
  // Click the row to open details, then Approve
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('div, button, tr'));
    const hits = all.filter(el => (el.innerText || '').includes('E2E Reset Tester'));
    // choose the innermost element that carries an onClick (deepest in tree)
    hits.sort((a, b) => a.getElementsByTagName('*').length - b.getElementsByTagName('*').length);
    const target = hits[0];
    target?.click();
  });
  await sleep(1000);
  const selected = await bodyText(page);
  record('approvals', 'request opens in review pane', /Reviewer comment/i.test(selected) ? 'PASS' : 'FAIL');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.trim() === 'Approve'); b?.click(); });
  await sleep(1500);
  const chk = await rest('GET', 'profile_requests', undefined, `?id=eq.${e2eRequestId}&select=status`);
  const row = Array.isArray(chk.rows) ? chk.rows[0] : chk.rows;
  record('approvals', 'approve flips request status in DB', row?.status === 'approved' ? 'PASS' : 'FAIL', JSON.stringify(row));
} catch (e) { record('approvals', 'approve flow', 'FAIL', String(e).slice(0, 250)); }

/* ===== D. Broadcast disposable notification via UI ===== */
let broadcastId = null;
try {
  await page.goto(`${BASE}/app/notifications`, { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Broadcast/i.test(x.innerText)); b?.click(); });
  await sleep(500);
  await page.evaluate(() => {
    const setVal = (el, v) => { const setter = Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, 'value').set; setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    const title = Array.from(document.querySelectorAll('input')).find(i => i.closest('label')?.innerText.includes('Title'));
    const body = document.querySelector('textarea');
    setVal(title, 'E2E Broadcast Test');
    setVal(body, 'Disposable broadcast from E2E suite');
  });
  await sleep(300);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Send broadcast/i.test(x.innerText)); b?.click(); });
  await sleep(6000);
  const chk = await rest('GET', 'notifications', undefined, `?title=eq.E2E Broadcast Test&select=id`);
  broadcastId = Array.isArray(chk.rows) ? chk.rows[0]?.id : chk.rows?.id;
  record('broadcast', 'broadcast creates notification row', !!broadcastId ? 'PASS' : 'FAIL');
  const t = await bodyText(page);
  record('broadcast', 'broadcast appears in admin list', t.includes('E2E Broadcast Test') ? 'PASS' : 'FAIL');
} catch (e) { record('broadcast', 'broadcast flow', 'FAIL', String(e).slice(0, 250)); }

/* ===== E. Reports CSV export produces CSV ===== */
try {
  await page.evaluate(() => { window.__blobs = []; });
  await page.goto(`${BASE}/app/reports`, { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate(() => { Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'CSV')?.click(); });
  await sleep(900);
  const b = await page.evaluate(async () => {
    const blobs = window.__blobs || [];
    const b = blobs[blobs.length - 1];
    return b ? { type: b.type, text: (await b.text()).slice(0, 200) } : null;
  });
  record('reports', 'CSV export yields text/csv', b && /csv/.test(b.type) && /Report/.test(b.text) ? 'PASS' : 'FAIL', JSON.stringify(b));
} catch (e) { record('reports', 'csv export', 'FAIL', String(e).slice(0, 250)); }

/* ===== Cleanup ===== */
const cleanups = [];
if (e2eAccountId) cleanups.push(rest('DELETE', 'accounts', undefined, `?id=eq.${e2eAccountId}`));
if (dupId) cleanups.push(rest('DELETE', 'accounts', undefined, `?id=eq.${dupId}`));
cleanups.push(rest('DELETE', 'workflows', undefined, `?requester_name=eq.E2E Dup Tester`));
cleanups.push(rest('DELETE', 'profile_requests', undefined, `?user_email=eq.${encodeURIComponent(dupEmail)}`));
cleanups.push(rest('DELETE', 'students', undefined, `?email=eq.${encodeURIComponent(dupEmail)}`));
cleanups.push(rest('DELETE', 'approvals', undefined, `?actor=eq.E2E Dup Tester`));
if (e2eRequestId) cleanups.push(rest('DELETE', 'profile_requests', undefined, `?id=eq.${e2eRequestId}`));
cleanups.push(rest('DELETE', 'profile_requests', undefined, `?user_email=eq.${encodeURIComponent(e2eEmail)}`));
if (broadcastId) cleanups.push(rest('DELETE', 'notifications', undefined, `?id=eq.${broadcastId}`));
cleanups.push(rest('DELETE', 'notifications', undefined, `?title=eq.E2E Broadcast Test`));
await Promise.allSettled(cleanups);

await browser.close();
const failed = results.filter(r => r.status === 'FAIL');
console.log(`\n===== SUMMARY: ${results.length} checks, ${failed.length} failed =====`);
if (failed.length) console.log('Failures:', JSON.stringify(failed, null, 1));
process.exit(0);
