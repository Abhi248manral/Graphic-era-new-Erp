import puppeteer from 'puppeteer-core';

process.loadEnvFile?.('.env');
const BASE = 'http://127.0.0.1:5173';
const SVC = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^"|"$/g, '');
const SUPA = (process.env.VITE_SUPABASE_URL || '').replace(/^"|"$/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const record = (a, c, s, n = '') => { results.push({ area: a, check: c, status: s, notes: n }); console.log(`[${s}] ${a} — ${c}${n ? ' :: ' + n : ''}`); };

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
await page.evaluateOnNewDocument(() => {
  const orig = URL.createObjectURL.bind(URL);
  window.__blobs = [];
  URL.createObjectURL = function (obj) { window.__blobs.push(obj); return orig(obj); };
});

/* Public pages render without errors */
for (const route of ['/', '/login', '/signup', '/forgot', '/admissions', '/about', '/features', '/pricing', '/contact']) {
  const before = errors.length;
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(600);
    const t = await page.evaluate(() => document.body.innerText);
    const hasContent = t.length > 80;
    const newErrs = errors.slice(before);
    record('public', route, hasContent && newErrs.length === 0 ? 'PASS' : 'FAIL', newErrs.join(' | '));
  } catch (e) { record('public', route, 'FAIL', String(e).slice(0, 150)); }
}

/* Login: links between auth screens */
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.click('a[href="/forgot"]');
  await sleep(800);
  record('auth', 'login → forgot password link', page.url().includes('/forgot') ? 'PASS' : 'FAIL', page.url());
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.click('a[href="/signup"]');
  await sleep(800);
  record('auth', 'login → signup link', page.url().includes('/signup') ? 'PASS' : 'FAIL', page.url());
} catch (e) { record('auth', 'login links', 'FAIL', String(e).slice(0, 150)); }

/* login as admin */
async function loginViaUI(email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.evaluate((email) => { const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes(email)); b?.click(); }, email);
  await sleep(400);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find(x => /continue/i.test(x.innerText)); b?.click(); });
  await page.waitForSelector('#otp-0');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Fill demo/.test(x.innerText)); b?.click(); });
  await sleep(250);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Verify/.test(x.innerText)); b?.click(); });
  await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: 12000 });
  await sleep(700);
}
await loginViaUI('admin@gehu.ac.in');

/* Payslip PDF downloads and is a valid PDF */
try {
  await page.evaluate(() => { window.__blobs = []; });
  await page.goto(`${BASE}/app/payroll`, { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate(() => { Array.from(document.querySelectorAll('button')).find(b => /\bPDF\b/i.test(b.innerText))?.click(); });
  await sleep(800);
  const blob = await page.evaluate(async () => { const b = (window.__blobs || []).pop(); return b ? { type: b.type, size: b.size, head: (await b.text()).slice(0, 8) } : null; });
  record('payroll', 'payslip PDF downloads', blob?.head?.startsWith('%PDF') ? 'PASS' : 'FAIL', JSON.stringify(blob));
} catch (e) { record('payroll', 'payslip pdf', 'FAIL', String(e).slice(0, 150)); }

/* Dashboard quick links navigate */
try {
  await page.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle2' });
  await sleep(800);
  const links = await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="/app/"]')).map(a => a.getAttribute('href')));
  const sample = [...new Set(links)].slice(0, 6);
  record('dashboard', `quick links present (${sample.length})`, sample.length > 0 ? 'PASS' : 'FAIL', sample.join(','));
  for (const href of sample.slice(0, 3)) {
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle2' });
    await sleep(500);
    record('dashboard', `quick link ${href} loads`, page.url().includes(href) ? 'PASS' : 'FAIL', page.url());
  }
} catch (e) { record('dashboard', 'quick links', 'FAIL', String(e).slice(0, 150)); }

/* Admissions: disposable application → approve via UI → delete */
let e2eAdmissionId = null;
try {
  const mk = await fetch(`${SUPA}/rest/v1/admissions`, { method: 'POST', headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ full_name: 'E2E Final Applicant', email: 'e2efinal@gehu.ac.in', program: 'B.Tech CSE', score: 91, status: 'pending' }) });
  const rows = await mk.json();
  e2eAdmissionId = rows?.[0]?.id;
  await page.goto(`${BASE}/app/admissions`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('tr')).find(r => r.innerText.includes('E2E Final Applicant'));
    const btns = Array.from(row?.querySelectorAll('button') || []);
    const approve = btns.find(b => b.querySelector('svg') && /emerald|green|check/i.test(b.className)) || btns.find(b => b.innerText.trim() === '' );
    (approve || btns[btns.length - 2])?.click();
  });
  await sleep(1500);
  const chk = await fetch(`${SUPA}/rest/v1/admissions?id=eq.${e2eAdmissionId}&select=status`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  const status = (await chk.json())?.[0]?.status;
  record('admissions', 'approve button updates status', status === 'approved' ? 'PASS' : 'FAIL', String(status));
  await fetch(`${SUPA}/rest/v1/admissions?id=eq.${e2eAdmissionId}`, { method: 'DELETE', headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
} catch (e) { record('admissions', 'approve', 'FAIL', String(e).slice(0, 150)); }

/* Forbidden page text */
try {
  await page.evaluate(() => { localStorage.removeItem('campusiq-session'); });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('alex.chen')); b?.click(); });
  await sleep(400);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find(x => /continue/i.test(x.innerText)); b?.click(); });
  await page.waitForSelector('#otp-0');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Fill demo/.test(x.innerText)); b?.click(); });
  await sleep(250);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Verify/.test(x.innerText)); b?.click(); });
  await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: 12000 });
  await page.goto(`${BASE}/app/payroll`, { waitUntil: 'networkidle2' });
  await sleep(600);
  const t = await page.evaluate(() => document.body.innerText);
  record('rbac', 'forbidden screen renders for student → /app/payroll', /don.t have access|access denied|forbidden|not authorized/i.test(t) ? 'PASS' : 'FAIL', t.replace(/\s+/g, ' ').slice(0, 120));
} catch (e) { record('rbac', 'forbidden screen', 'FAIL', String(e).slice(0, 150)); }

await browser.close();
const failed = results.filter(r => r.status === 'FAIL');
console.log(`\n===== SUMMARY: ${results.length} checks, ${failed.length} failed =====`);
process.exit(0);
