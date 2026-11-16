import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://127.0.0.1:5173';
const SHOTS = process.env.SHOTS_DIR || '/private/var/folders/72/s6nn2yp11bd5mw5dj5jxxhwc0000gn/T/opencode/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const ROUTES = [
  'dashboard', 'timetable', 'attendance', 'assignments', 'exams', 'lms', 'students',
  'faculty', 'admissions', 'courses', 'fees', 'payroll', 'library', 'hostel', 'transport',
  'workflows', 'account-approvals', 'analytics', 'reports', 'notifications', 'messages',
  'documents', 'settings',
];

const ROLE_ROUTES = {
  student: ['dashboard', 'timetable', 'attendance', 'assignments', 'exams', 'lms', 'fees', 'library', 'hostel', 'transport', 'notifications', 'messages', 'documents', 'settings'],
  faculty: ['dashboard', 'timetable', 'attendance', 'assignments', 'exams', 'lms', 'students', 'courses', 'workflows', 'notifications', 'messages', 'documents', 'settings'],
  parent: ['dashboard', 'attendance', 'exams', 'fees', 'transport', 'notifications', 'messages', 'documents', 'settings'],
  admin: ROUTES,
};

export async function launch() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  return browser;
}

export async function loginViaUI(page, email, password = 'campus123') {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
  // Try demo autofill first (matches card buttons by email text)
  const usedDemo = await page.evaluate((email) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.innerText.includes(email));
    if (b) { b.click(); return true; }
    return false;
  }, email);
  if (!usedDemo) {
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
  }
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find(x => /continue/i.test(x.innerText)); b?.click(); });
  await page.waitForSelector('#otp-0', { timeout: 8000 });
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Fill demo/.test(x.innerText)); b?.click(); });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Verify/.test(x.innerText)); b?.click(); });
  await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 600));
}

export async function logoutViaUI(page) {
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Sign out/i.test(x.innerText)); b?.click(); });
  await new Promise(r => setTimeout(r, 700));
}

async function visitAll(role, email) {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const report = [];
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push({ url: page.url(), text: m.text().slice(0, 300) }); });
  page.on('pageerror', e => errors.push({ url: page.url(), text: 'PAGEERROR: ' + String(e).slice(0, 300) }));
  page.on('response', r => { if (r.status() >= 400) errors.push({ url: page.url(), text: `HTTP ${r.status()} ${r.url()}` }); });

  await loginViaUI(page, email);
  for (const route of ROLE_ROUTES[role]) {
    const before = errors.length;
    try {
      await page.goto(`${BASE_URL}/app/${route}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 900));
      const shot = path.join(SHOTS, `${role}_${route}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      const newErrs = errors.slice(before);
      report.push({ route, ok: newErrs.length === 0, errors: newErrs });
      console.log(`[${role}] /app/${route}: ${newErrs.length ? 'ERRORS ' + JSON.stringify(newErrs) : 'ok'}`);
    } catch (e) {
      report.push({ route, ok: false, errors: [{ text: 'NAV FAIL: ' + e.message }] });
      console.log(`[${role}] /app/${route}: NAV FAIL ${e.message}`);
    }
  }
  await browser.close();
  return report;
}

const roles = JSON.parse(process.env.ROLES || '{"student":"alex.chen@gehu.ac.in","faculty":"dr.meera@gehu.ac.in","parent":"ravi.chen@gehu.ac.in","admin":"admin@gehu.ac.in"}');
for (const [role, email] of Object.entries(roles)) {
  console.log(`\n=== ROLE ${role} (${email}) ===`);
  await visitAll(role, email);
}
process.exit(0);
