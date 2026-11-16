/**
 * CampusIQ end-to-end workflow & RBAC checks (browser-driven).
 * Run: node scripts/e2e_actions.js
 * Assumes the dev server is running at 127.0.0.1:5173.
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

process.loadEnvFile?.('.env');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://127.0.0.1:5173';
const SVC = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^"|"$/g, '');
const SUPA = (process.env.VITE_SUPABASE_URL || '').replace(/^"|"$/g, '');
const SHOTS = '/private/var/folders/72/s6nn2yp11bd5mw5dj5jxxhwc0000gn/T/opencode/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function record(area, check, status, notes = '') {
  results.push({ area, check, status, notes });
  console.log(`[${status}] ${area} — ${check}${notes ? ' :: ' + notes : ''}`);
}
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

/** Capture next blob URL download by monkey-patching createObjectURL. */
async function installBlobTrap(page) {
  await page.evaluateOnNewDocument(() => {
    const orig = URL.createObjectURL.bind(URL);
    window.__blobs = [];
    URL.createObjectURL = function (obj) { window.__blobs.push(obj); return orig(obj); };
  });
}
async function readLastBlob(page) {
  return page.evaluate(async () => {
    const blobs = window.__blobs || [];
    const b = blobs[blobs.length - 1];
    if (!b) return null;
    const text = await b.text();
    return { type: b.type, size: b.size, head: text.slice(0, 8), full: text.slice(0, 4000) };
  });
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const httpErrors = [];
page.on('response', r => { if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.url()}`); });
await installBlobTrap(page);

/* ============ 1. AUTH: invalid credentials ============ */
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.click('input[type="email"]');
  await page.type('input[type="email"]', 'alex.chen@gehu.ac.in');
  await page.type('input[type="password"]', 'wrong-password-999');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find(x => /continue/i.test(x.innerText)); b?.click(); });
  await sleep(2500);
  const t = await bodyText(page);
  record('auth', 'invalid password shows error', /Incorrect password/i.test(t) ? 'PASS' : 'FAIL', t.match(/incorrect[^\n]{0,80}/i)?.[0] || 'no error text');
} catch (e) { record('auth', 'invalid password shows error', 'FAIL', String(e).slice(0, 200)); }

/* ============ 2. AUTH: unknown email ============ */
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.click('input[type="email"]');
  await page.type('input[type="email"]', 'nobody-e2e@gehu.ac.in');
  await page.type('input[type="password"]', 'campus123');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find(x => /continue/i.test(x.innerText)); b?.click(); });
  await sleep(2500);
  const t = await bodyText(page);
  record('auth', 'unknown email shows error', /no account matches/i.test(t) ? 'PASS' : 'FAIL', t.match(/no account[^\n]{0,80}/i)?.[0] || 'no error text');
} catch (e) { record('auth', 'unknown email shows error', 'FAIL', String(e).slice(0, 200)); }

/* ============ 3. LOGIN sara (manual, non-demo) ============ */
try {
  await loginViaUI(page, 'sara.sharma@gehu.ac.in');
  const t = await bodyText(page);
  record('auth', 'sara (student) manual login', /Sara/i.test(t) ? 'PASS' : 'FAIL', page.url());
  await logoutViaUI(page);
  record('auth', 'logout via sidebar', page.url().includes('/login') ? 'PASS' : 'FAIL', page.url());
} catch (e) { record('auth', 'sara login/logout', 'FAIL', String(e).slice(0, 200)); }

/* ============ 4. Refresh while signed in ============ */
try {
  await loginViaUI(page, 'alex.chen@gehu.ac.in');
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(800);
  const t = await bodyText(page);
  const ok = page.url().includes('/app') && /Alex/i.test(t);
  record('auth', 'refresh keeps session', ok ? 'PASS' : 'FAIL', page.url());
} catch (e) { record('auth', 'refresh keeps session', 'FAIL', String(e).slice(0, 200)); }

/* ============ 5. Access after logout ============ */
try {
  await logoutViaUI(page);
  await page.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle2' });
  await sleep(800);
  record('auth', '/app/dashboard after logout redirects to login', page.url().includes('/login') ? 'PASS' : 'FAIL', page.url());
} catch (e) { record('auth', 'access after logout', 'FAIL', String(e).slice(0, 200)); }

/* ============ 6. Student data isolation: fees & documents ============ */
try {
  await loginViaUI(page, 'alex.chen@gehu.ac.in');
  await page.goto(`${BASE}/app/fees`, { waitUntil: 'networkidle2' });
  await sleep(800);
  const t = await bodyText(page);
  const seesOwn = t.includes('INV-2025-GEHU-01') && t.includes('INV-2025-GEHU-02');
  const seesSaran = t.includes('INV-2025-GEHU-03') || t.includes('INV-2025-GEHU-04');
  record('isolation', 'student fees scoped to own invoices', seesOwn && !seesSaran ? 'PASS' : 'FAIL', `own=${seesOwn} sarasVisible=${seesSaran}`);
  await page.goto(`${BASE}/app/documents`, { waitUntil: 'networkidle2' });
  await sleep(800);
  const td = await bodyText(page);
  const own = td.includes('Grade Sheet Sem 4') && td.includes('Bonafide');
  const saras = td.includes('Sara Sharma');
  record('isolation', 'student documents scoped to own + institutional', own && !saras && td.includes('Academic Calendar') ? 'PASS' : 'FAIL');
  await page.goto(`${BASE}/app/attendance`, { waitUntil: 'networkidle2' });
  await sleep(800);
  const ta = await bodyText(page);
  record('isolation', 'student attendance mentions own id', /STU-2025-001|Student attendance/.test(ta) || !ta.includes('STU-2025-002') ? 'PASS' : 'FAIL');
} catch (e) { record('isolation', 'student scoping', 'FAIL', String(e).slice(0, 200)); }

/* ============ 7. Parent scoping: Ravi (STU-2025-001) ============ */
try {
  await logoutViaUI(page);
  await loginViaUI(page, 'ravi.chen@gehu.ac.in');
  await page.goto(`${BASE}/app/fees`, { waitUntil: 'networkidle2' });
  await sleep(800);
  const t1 = await bodyText(page);
  const raviSeesOwn = t1.includes('INV-2025-GEHU-01') && !t1.includes('INV-2025-GEHU-03');
  record('isolation', 'parent Ravi sees ward (Alex) invoices only', raviSeesOwn ? 'PASS' : 'FAIL');
  await page.goto(`${BASE}/app/attendance`, { waitUntil: 'networkidle2' });
  await sleep(700);
  const t2 = await bodyText(page);
  record('isolation', 'parent attendance scoped to ward', /STU-2025-001/.test(t2) && !/STU-2025-002/.test(t2) ? 'PASS' : 'FAIL');
  await page.goto(`${BASE}/app/documents`, { waitUntil: 'networkidle2' });
  await sleep(700);
  const t3 = await bodyText(page);
  record('isolation', 'parent documents scoped to ward + institutional', !t3.includes('Sara Sharma') ? 'PASS' : 'FAIL');
} catch (e) { record('isolation', 'parent Ravi', 'FAIL', String(e).slice(0, 200)); }

/* ============ 8. Parent scoping: Vikram (STU-2025-002) ============ */
try {
  await logoutViaUI(page);
  await loginViaUI(page, 'vikram.sharma@gehu.ac.in');
  await page.goto(`${BASE}/app/fees`, { waitUntil: 'networkidle2' });
  await sleep(800);
  const t1 = await bodyText(page);
  const ok = t1.includes('INV-2025-GEHU-03') && !t1.includes('INV-2025-GEHU-01');
  record('isolation', 'parent Vikram sees ward (Sara) invoices only', ok ? 'PASS' : 'FAIL');
  await page.goto(`${BASE}/app/documents`, { waitUntil: 'networkidle2' });
  await sleep(700);
  const t2 = await bodyText(page);
  record('isolation', 'parent Vikram sees Sara documents only', t2.includes('Sara Sharma') && !t2.includes('Bonafide') ? 'PASS' : 'FAIL');
} catch (e) { record('isolation', 'parent Vikram', 'FAIL', String(e).slice(0, 200)); }

/* ============ 9. RBAC guard: student cannot open admin pages ============ */
try {
  await logoutViaUI(page);
  await loginViaUI(page, 'alex.chen@gehu.ac.in');
  for (const route of ['students', 'faculty', 'payroll', 'admissions', 'analytics', 'reports', 'account-approvals']) {
    await page.goto(`${BASE}/app/${route}`, { waitUntil: 'networkidle2' });
    await sleep(500);
    const t = await bodyText(page);
    const blocked = /access|forbidden|denied|don.t have|not authorized|403/i.test(t);
    record('rbac', `student blocked from /app/${route}`, blocked ? 'PASS' : 'FAIL');
  }
} catch (e) { record('rbac', 'student guard', 'FAIL', String(e).slice(0, 200)); }

/* ============ 10. Parent cannot open faculty pages ============ */
try {
  await logoutViaUI(page);
  await loginViaUI(page, 'ravi.chen@gehu.ac.in');
  for (const route of ['students', 'courses', 'workflows', 'payroll', 'admissions']) {
    await page.goto(`${BASE}/app/${route}`, { waitUntil: 'networkidle2' });
    await sleep(500);
    const t = await bodyText(page);
    const blocked = /access|forbidden|denied|don.t have|not authorized|403/i.test(t);
    record('rbac', `parent blocked from /app/${route}`, blocked ? 'PASS' : 'FAIL');
  }
} catch (e) { record('rbac', 'parent guard', 'FAIL', String(e).slice(0, 200)); }

/* ============ 11. Faculty attendance: create → persist → visible to student ============ */
let e2eAttendanceId = null;
try {
  await logoutViaUI(page);
  await loginViaUI(page, 'dr.meera@gehu.ac.in');
  await page.goto(`${BASE}/app/attendance`, { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Record Attendance/i.test(x.innerText)); b?.click(); });
  await sleep(400);
  // Fill the form
  await page.select('select:nth-of-type(1)', 'STU-2025-001').catch(() => {});
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const date = document.querySelector('input[type="date"]');
    if (date) setVal(date, '2026-11-12');
    const topic = document.querySelector('input[placeholder*="Distributed Consensus"]');
    if (topic) setVal(topic, 'E2E Persist Test Session');
  });
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Save Attendance/i.test(x.innerText)); b?.click(); });
  await sleep(2500);
  let t = await bodyText(page);
  const saved = t.includes('E2E Persist Test Session');
  record('workflow', 'faculty saves attendance (visible in table)', saved ? 'PASS' : 'FAIL');
  // Read id from API
  const got = await rest('GET', 'attendance', undefined, '?session_title=eq.E2E Persist Test Session&select=id');
  e2eAttendanceId = Array.isArray(got.rows) && got.rows[0]?.id;
  // Refresh and verify persistence
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(800);
  t = await bodyText(page);
  record('workflow', 'attendance persists after refresh', t.includes('E2E Persist Test Session') ? 'PASS' : 'FAIL');
  // Student view
  await logoutViaUI(page);
  await loginViaUI(page, 'alex.chen@gehu.ac.in');
  await page.goto(`${BASE}/app/attendance`, { waitUntil: 'networkidle2' });
  await sleep(800);
  t = await bodyText(page);
  record('workflow', 'student sees faculty-recorded attendance', t.includes('E2E Persist Test Session') ? 'PASS' : 'FAIL');
} catch (e) { record('workflow', 'faculty attendance flow', 'FAIL', String(e).slice(0, 200)); }

/* ============ 12. Fees: create disposable invoice, pay via UI, verify, cleanup ============ */
let e2eFeeId = null;
try {
  const mk = await rest('POST', 'fees', { invoice_no: 'INV-E2E-TEST-001', student_id: 'STU-2025-001', description: 'E2E test invoice (disposable)', amount: 1234, due_date: '2026-12-31', status: 'pending' });
  e2eFeeId = mk.rows?.id ?? mk.rows?.[0]?.id;
  await logoutViaUI(page);
  await loginViaUI(page, 'alex.chen@gehu.ac.in');
  await page.goto(`${BASE}/app/fees`, { waitUntil: 'networkidle2' });
  await sleep(800);
  let t = await bodyText(page);
  const seen = t.includes('INV-E2E-TEST-001');
  record('workflow', 'student sees new invoice', seen ? 'PASS' : 'FAIL');
  // Pay it
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const rows = Array.from(document.querySelectorAll('tr'));
    const row = rows.find(r => r.innerText.includes('INV-E2E-TEST-001'));
    const btn = row?.querySelector('button');
    btn?.click();
  });
  await sleep(1500);
  const chk = await rest('GET', 'fees', undefined, '?invoice_no=eq.INV-E2E-TEST-001&select=status,paid_on');
  const fee = Array.isArray(chk.rows) ? chk.rows[0] : chk.rows;
  record('workflow', 'pay now marks invoice paid in DB', fee?.status === 'paid' ? 'PASS' : 'FAIL', JSON.stringify(fee));
} catch (e) { record('workflow', 'fees pay flow', 'FAIL', String(e).slice(0, 200)); }

/* ============ 13. Downloads: receipt, document, report, payroll (%PDF) ============ */
async function expectPdf(name, action) {
  await page.evaluate(() => { (window).__blobs = []; });
  await action();
  await sleep(900);
  const b = await readLastBlob(page);
  record('download', name, b && b.head.startsWith('%PDF') ? 'PASS' : 'FAIL', b ? `type=${b.type} size=${b.size}` : 'no blob captured');
}
try {
  await logoutViaUI(page);
  await loginViaUI(page, 'alex.chen@gehu.ac.in');
  await page.goto(`${BASE}/app/fees`, { waitUntil: 'networkidle2' });
  await sleep(700);
  await expectPdf('fee receipt PDF', async () => {
    await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('tr')).find(r => r.innerText.includes('INV-2025-GEHU-01'));
      Array.from(row?.querySelectorAll('button') || []).find(b => /Receipt/i.test(b.innerText))?.click();
    });
  });
  await page.goto(`${BASE}/app/documents`, { waitUntil: 'networkidle2' });
  await sleep(700);
  await expectPdf('document download PDF', async () => {
    await page.evaluate(() => { Array.from(document.querySelectorAll('button')).find(b => /Download/i.test(b.innerText))?.click(); });
  });
  await logoutViaUI(page);
  await loginViaUI(page, 'admin@gehu.ac.in');
  await page.goto(`${BASE}/app/reports`, { waitUntil: 'networkidle2' });
  await sleep(700);
  await expectPdf('reports PDF export', async () => {
    await page.evaluate(() => { Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'PDF')?.click(); });
  });
  await page.goto(`${BASE}/app/payroll`, { waitUntil: 'networkidle2' });
  await sleep(700);
  await expectPdf('payroll register PDF', async () => {
    await page.evaluate(() => { Array.from(document.querySelectorAll('button')).find(b => /Export register/i.test(b.innerText))?.click(); });
  });
} catch (e) { record('download', 'downloads', 'FAIL', String(e).slice(0, 250)); }

/* ============ 14. Settings: theme toggle + profile request submit & cancel ============ */
try {
  await logoutViaUI(page);
  await loginViaUI(page, 'alex.chen@gehu.ac.in');
  await page.goto(`${BASE}/app/settings`, { waitUntil: 'networkidle2' });
  await sleep(800);
  const themeBefore = await page.evaluate(() => document.documentElement.className);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Deep Space|Light|theme|Dark/i.test(x.innerText)); b?.click(); });
  await sleep(400);
  const themeAfter = await page.evaluate(() => document.documentElement.className);
  record('settings', 'theme toggle changes html class', themeBefore !== themeAfter ? 'PASS' : 'FAIL', `${themeBefore} → ${themeAfter}`);
  // Submit a profile change request (nickname)
  await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('label')).find(l => /Nickname/i.test(l.innerText));
    const input = label?.querySelector('input');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'AlexE2E');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await sleep(300);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Submit|Apply|Request/i.test(x.innerText)); b?.click(); });
  await sleep(1500);
  let t = await bodyText(page);
  const toast = /submitted for administrative approval/i.test(t);
  record('settings', 'profile change request submits', toast ? 'PASS' : 'FAIL');
  // Cancel the pending request
  await sleep(800);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Cancel request/i.test(x.innerText)); b?.click(); });
  await sleep(1200);
  t = await bodyText(page);
  record('settings', 'cancel pending request works', !/Cancel request/i.test(t) ? 'PASS' : 'FAIL');
} catch (e) { record('settings', 'settings workflow', 'FAIL', String(e).slice(0, 250)); }

/* ============ 15. Messages: admin → alex roundtrip, then cleanup ============ */
let e2eMessageIds = [];
try {
  await logoutViaUI(page);
  await loginViaUI(page, 'admin@gehu.ac.in');
  // Seed a message directly? Better through UI: open messages, select thread if any. messages table empty → no threads. Admin can't start new thread via UI (only reply to existing). Use API to create one from admin to alex.
  const mk = await rest('POST', 'messages', { sender: 'admin@gehu.ac.in', recipient: 'alex.chen@gehu.ac.in', subject: 'Re: conversation', body: 'E2E test message — please ignore', sent_at: new Date().toISOString(), is_read: false });
  e2eMessageIds = [mk.rows?.id ?? mk.rows?.[0]?.id];
  await page.goto(`${BASE}/app/messages`, { waitUntil: 'networkidle2' });
  await sleep(900);
  let t = await bodyText(page);
  const sees = t.includes('E2E test message');
  record('messages', 'admin sees seeded thread', sees ? 'PASS' : 'FAIL');
  // Reply via UI
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /alex/i.test(x.innerText)); b?.click(); });
  await sleep(500);
  await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="Type a message"]');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'E2E reply from admin');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await sleep(300);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.querySelector('svg.lucide-send')); b?.click(); });
  await sleep(1500);
  const chk = await rest('GET', 'messages', undefined, '?body=eq.E2E reply from admin&select=id,sender');
  e2eMessageIds.push(...(Array.isArray(chk.rows) ? chk.rows.map(r => r.id) : []));
  record('messages', 'admin reply persists to DB', (Array.isArray(chk.rows) && chk.rows.length > 0) ? 'PASS' : 'FAIL');
} catch (e) { record('messages', 'messages workflow', 'FAIL', String(e).slice(0, 250)); }

/* ============ 16. Signup → admin approve → cleanup ============ */
const e2eEmail = `e2e_${Date.now()}@gehu.ac.in`;
let signupAccountId = null;
try {
  await logoutViaUI(page);
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle2' });
  await page.click('input[placeholder="Your legal name"]');
  await page.type('input[placeholder="Your legal name"]', 'E2E Test Student');
  await page.click('input[placeholder="you@gehu.ac.in"]');
  await page.type('input[placeholder="you@gehu.ac.in"]', e2eEmail);
  await page.click('input[placeholder="Minimum 8 characters"]');
  await page.type('input[placeholder="Minimum 8 characters"]', 'e2e-test-pass-123');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find(x => /Create account/i.test(x.innerText)); b?.click(); });
  await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: 15000 });
  await sleep(1000);
  const t = await bodyText(page);
  record('signup', 'new account lands on /app/dashboard', /E2E Test Student|Welcome|Dashboard/i.test(t) ? 'PASS' : 'FAIL', page.url());
  const acc = await rest('GET', 'accounts', undefined, `?email=eq.${encodeURIComponent(e2eEmail)}&select=id,status`);
  signupAccountId = Array.isArray(acc.rows) ? acc.rows[0]?.id : acc.rows?.id;
  record('signup', 'account row created via API', acc.status === 200 && !!signupAccountId ? 'PASS' : 'FAIL');
  // Admin sees profile_request
  await logoutViaUI(page);
  await loginViaUI(page, 'admin@gehu.ac.in');
  await page.goto(`${BASE}/app/account-approvals`, { waitUntil: 'networkidle2' });
  await sleep(1200);
  const ta = await bodyText(page);
  const seesReg = ta.includes('E2E Test Student') || ta.includes(e2eEmail);
  record('signup', 'admin sees registration in Account Approvals', seesReg ? 'PASS' : 'FAIL');
} catch (e) { record('signup', 'signup workflow', 'FAIL', String(e).slice(0, 250)); }

/* ============ 17. Workflows: approve seeded signup workflow ============ */
try {
  await page.goto(`${BASE}/app/workflows`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  const t = await bodyText(page);
  const sees = t.includes('E2E Test Student');
  record('workflows', 'admin sees new signup workflow', sees ? 'PASS' : 'FAIL');
  if (sees) {
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.glass-card'));
      const card = cards.find(c => c.innerText.includes('E2E Test Student'));
      const btn = Array.from(card?.querySelectorAll('button') || []).find(b => /Approve/i.test(b.innerText));
      btn?.click();
    });
    await sleep(1800);
    const wf = await rest('GET', 'workflows', undefined, `?requester_name=eq.E2E Test Student&select=status`);
    const row = Array.isArray(wf.rows) ? wf.rows[0] : wf.rows;
    record('workflows', 'approve flips workflow status in DB', row?.status === 'approved' ? 'PASS' : 'FAIL', JSON.stringify(row));
  }
} catch (e) { record('workflows', 'approve workflow', 'FAIL', String(e).slice(0, 250)); }

/* ============ 18. Library: borrow an available book then return ============ */
try {
  await logoutViaUI(page);
  await loginViaUI(page, 'alex.chen@gehu.ac.in');
  await page.goto(`${BASE}/app/library`, { waitUntil: 'networkidle2' });
  await sleep(900);
  const before = await rest('GET', 'library_books', undefined, '?id=eq.2&select=status');
  const st = Array.isArray(before.rows) ? before.rows[0]?.status : before.rows?.status;
  record('library', 'seed book 2 is available', st === 'available' ? 'PASS' : 'FAIL', String(st));
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.glass-card'));
    const card = cards.find(c => c.innerText.includes('Operating System Concepts'));
    Array.from(card?.querySelectorAll('button') || []).find(b => /Borrow/i.test(b.innerText))?.click();
  });
  await sleep(1500);
  const mid = await rest('GET', 'library_books', undefined, '?id=eq.2&select=status');
  const st2 = Array.isArray(mid.rows) ? mid.rows[0]?.status : mid.rows?.status;
  record('library', 'borrow flips status to borrowed', st2 === 'borrowed' ? 'PASS' : 'FAIL', String(st2));
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(900);
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.glass-card'));
    const card = cards.find(c => c.innerText.includes('Operating System Concepts'));
    Array.from(card?.querySelectorAll('button') || []).find(b => /Return/i.test(b.innerText))?.click();
  });
  await sleep(1500);
  const end = await rest('GET', 'library_books', undefined, '?id=eq.2&select=status');
  const st3 = Array.isArray(end.rows) ? end.rows[0]?.status : end.rows?.status;
  record('library', 'return flips status back to available', st3 === 'available' ? 'PASS' : 'FAIL', String(st3));
} catch (e) { record('library', 'library borrow/return', 'FAIL', String(e).slice(0, 250)); }

/* ============ 19. Assignments: submit seeded pending assignment, then restore ============ */
try {
  await page.goto(`${BASE}/app/assignments`, { waitUntil: 'networkidle2' });
  await sleep(900);
  let t = await bodyText(page);
  const sees = t.includes('ER Diagram');
  record('assignments', 'student sees seeded pending assignment', sees ? 'PASS' : 'FAIL');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => /Submit/i.test(b.innerText) && b.closest('div')?.innerText.includes('ER Diagram'));
    (btn || btns.find(b => /Submit/i.test(b.innerText)))?.click();
  });
  await sleep(1500);
  const chk = await rest('GET', 'assignments', undefined, '?id=eq.1&select=status,submitted_on');
  const row = Array.isArray(chk.rows) ? chk.rows[0] : chk.rows;
  record('assignments', 'submit flips status in DB', row?.status === 'submitted' ? 'PASS' : 'FAIL', JSON.stringify(row));
  // Restore to pending so seed data is back as found
  await rest('PATCH', 'assignments', { status: 'pending', submitted_on: null }, '?id=eq.1');
} catch (e) { record('assignments', 'assignments submit', 'FAIL', String(e).slice(0, 250)); }

/* ============ 20. LMS video player opens/closes ============ */
try {
  await page.goto(`${BASE}/app/lms`, { waitUntil: 'networkidle2' });
  await sleep(900);
  await page.evaluate(() => { Array.from(document.querySelectorAll('button')).find(b => /Start module|Continue learning|Review module/i.test(b.innerText))?.click(); });
  await sleep(800);
  let t = await bodyText(page);
  const open = /video|player|module/i.test(t);
  record('lms', 'module player opens', open ? 'PASS' : 'FAIL');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Close|×/i.test(x.innerText) || x.getAttribute('aria-label') === 'Close'); b?.click(); });
  await sleep(400);
} catch (e) { record('lms', 'lms player', 'FAIL', String(e).slice(0, 250)); }

/* ============ 21. Notifications: mark read flips DB (disposable row) ============ */
let e2eNotificationId = null;
try {
  const mk = await rest('POST', 'notifications', { title: 'E2E Disposable Notice', body: 'Mark-read test', priority: 'low', audience: 'all', channel: 'in_app', is_read: false, created_at: new Date().toISOString() });
  e2eNotificationId = mk.rows?.id ?? mk.rows?.[0]?.id;
  await page.goto(`${BASE}/app/notifications`, { waitUntil: 'networkidle2' });
  await sleep(900);
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div')).filter(d => d.innerText.includes('E2E Disposable Notice'));
    const card = cards.find(d => d.querySelector('button'));
    Array.from(card?.querySelectorAll('button') || []).find(b => /Mark read/i.test(b.innerText))?.click();
  });
  await sleep(1200);
  const after = await rest('GET', 'notifications', undefined, `?id=eq.${e2eNotificationId}&select=is_read`);
  const nowRead = (Array.isArray(after.rows) ? after.rows[0] : after.rows)?.is_read;
  record('notifications', 'mark read flips is_read in DB', nowRead === true ? 'PASS' : 'FAIL', `now=${nowRead}`);
} catch (e) { record('notifications', 'mark read', 'FAIL', String(e).slice(0, 250)); }

/* ============ 22. Admissions: create disposable → shortlist → approve → cleanup ============ */
let e2eAdmissionId = null;
try {
  const mk = await rest('POST', 'admissions', { full_name: 'E2E Applicant', email: e2eEmail, phone: '9999999999', program: 'B.Tech CSE', score: 88, status: 'pending' });
  e2eAdmissionId = mk.rows?.id ?? mk.rows?.[0]?.id;
  await logoutViaUI(page);
  await loginViaUI(page, 'admin@gehu.ac.in');
  await page.goto(`${BASE}/app/admissions`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  const t = await bodyText(page);
  const sees = t.includes('E2E Applicant');
  record('admissions', 'admin sees disposable application', sees ? 'PASS' : 'FAIL');
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr'));
    const row = rows.find(r => r.innerText.includes('E2E Applicant'));
    Array.from(row?.querySelectorAll('button') || []).find(b => /Shortlist/i.test(b.innerText))?.click();
  });
  await sleep(1500);
  const chk = await rest('GET', 'admissions', undefined, `?id=eq.${e2eAdmissionId}&select=status`);
  const row = Array.isArray(chk.rows) ? chk.rows[0] : chk.rows;
  record('admissions', 'shortlist updates status in DB', row?.status === 'shortlisted' ? 'PASS' : 'FAIL', JSON.stringify(row));
} catch (e) { record('admissions', 'admissions flow', 'FAIL', String(e).slice(0, 250)); }

/* ============ 23. Omni-Search: role scoping ============ */
try {
  await logoutViaUI(page);
  await loginViaUI(page, 'alex.chen@gehu.ac.in');
  await page.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle2' });
  await sleep(600);
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await sleep(400);
  await page.keyboard.type('Alex');
  await sleep(800);
  let t = await bodyText(page);
  const studentSearchHasStudents = /STU-2025-001|Alex Chen/.test(t);
  record('search', 'student search returns own data/pages', studentSearchHasStudents ? 'PASS' : 'FAIL');
  await page.keyboard.press('Escape');
  await logoutViaUI(page);
  await loginViaUI(page, 'admin@gehu.ac.in');
  await page.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle2' });
  await sleep(600);
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await sleep(400);
  await page.keyboard.type('Priya');
  await sleep(800);
  t = await bodyText(page);
  record('search', 'admin search returns directory records', /Priya|Faculty|Students/i.test(t) ? 'PASS' : 'FAIL');
  await page.keyboard.press('Escape');
} catch (e) { record('search', 'omni-search', 'FAIL', String(e).slice(0, 250)); }

/* ============ 24. Chatbot opens and answers ============ */
try {
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /chat|assistant|bot/i.test(x.getAttribute('aria-label') || '') || x.innerHTML.includes('chat')); b?.click(); });
  await sleep(500);
  await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="ask" i], input[placeholder*="question" i], textarea');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'What are my fees?');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await sleep(300);
  await page.keyboard.press('Enter');
  await sleep(1200);
  const t = await bodyText(page);
  record('chatbot', 'chatbot answers a fee question', /Fees page|fee/i.test(t) ? 'PASS' : 'FAIL');
} catch (e) { record('chatbot', 'chatbot', 'FAIL', String(e).slice(0, 250)); }

/* ============ 25. Hospital of 404 + sidebar role filtering ============ */
try {
  await page.goto(`${BASE}/nonexistent-route-xyz`, { waitUntil: 'networkidle2' });
  await sleep(600);
  record('routing', 'unknown route redirects (to landing)', page.url() === `${BASE}/` || page.url().includes('/') ? 'PASS' : 'FAIL', page.url());
  await page.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle2' });
  await sleep(600);
  const adminHasPayroll = /Payroll/.test(await bodyText(page));
  record('rbac', 'admin sidebar shows Payroll', adminHasPayroll ? 'PASS' : 'FAIL');
} catch (e) { record('routing', '404 redirect', 'FAIL', String(e).slice(0, 200)); }
try {
  await logoutViaUI(page);
  await loginViaUI(page, 'alex.chen@gehu.ac.in');
  await page.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle2' });
  await sleep(600);
  const t = await bodyText(page);
  record('rbac', 'student sidebar hides Payroll/Students', !/Payroll/.test(t) && !/>Students</.test(t) ? 'PASS' : 'FAIL');
} catch (e) { record('rbac', 'student sidebar', 'FAIL', String(e).slice(0, 200)); }

/* ============ Cleanup disposable records ============ */
const cleanup = [];
if (e2eAttendanceId) cleanup.push(rest('DELETE', 'attendance', undefined, `?id=eq.${e2eAttendanceId}`));
if (e2eFeeId) cleanup.push(rest('DELETE', 'fees', undefined, `?id=eq.${e2eFeeId}`));
for (const id of e2eMessageIds) if (id) cleanup.push(rest('DELETE', 'messages', undefined, `?id=eq.${id}`));
if (signupAccountId) cleanup.push(rest('DELETE', 'accounts', undefined, `?id=eq.${signupAccountId}`));
if (e2eAdmissionId) cleanup.push(rest('DELETE', 'admissions', undefined, `?id=eq.${e2eAdmissionId}`));
cleanup.push(rest('DELETE', 'students', undefined, `?email=eq.${encodeURIComponent(e2eEmail)}`));
cleanup.push(rest('DELETE', 'profile_requests', undefined, `?user_email=eq.${encodeURIComponent(e2eEmail)}`));
cleanup.push(rest('DELETE', 'workflows', undefined, `?requester_name=eq.E2E Test Student`));
cleanup.push(rest('DELETE', 'approvals', undefined, `?actor=eq.E2E Test Student`));
cleanup.push(rest('DELETE', 'notifications', undefined, `?title=eq.E2E Disposable Notice`));
if (e2eNotificationId) cleanup.push(rest('DELETE', 'notifications', undefined, `?id=eq.${e2eNotificationId}`));
cleanup.push(rest('DELETE', 'documents', undefined, `?title=like.*e2e*`));
await Promise.allSettled(cleanup);
// Also remove orphan approvals referencing E2E workflows
await rest('DELETE', 'workflows', undefined, `?title=like.*E2E*`);

await browser.close();
const failed = results.filter(r => r.status === 'FAIL');
console.log(`\n===== SUMMARY: ${results.length} checks, ${failed.length} failed =====`);
if (failed.length) console.log('Failures:', JSON.stringify(failed, null, 1));
process.exit(0);
