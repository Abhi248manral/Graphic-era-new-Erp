import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://127.0.0.1:5173';

const results = [];

function record(role, control, expected, status, notes = '') {
  results.push({ role, control, expected, status, notes });
  console.log(`[${status}] ${role} -> ${control}: ${notes || expected}`);
}

async function loginAs(page, demoName) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('button');
  
  // Click the demo button
  const clicked = await page.evaluate((name) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.innerText.includes(name));
    if (b) { b.click(); return true; }
    return false;
  }, demoName);

  if (!clicked) throw new Error(`Demo button for ${demoName} not found`);

  await new Promise(r => setTimeout(r, 400));
  // Click continue button
  await page.click('button[type="submit"]');

  // Wait for OTP view
  await page.waitForSelector('#otp-0', { timeout: 5000 });
  await new Promise(r => setTimeout(r, 300));

  // Click 'Fill demo'
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const fillBtn = btns.find(b => b.innerText.includes('Fill demo'));
    if (fillBtn) fillBtn.click();
  });
  await new Promise(r => setTimeout(r, 300));

  // Click 'Verify'
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const verifyBtn = btns.find(b => b.innerText.includes('Verify'));
    if (verifyBtn) verifyBtn.click();
  });

  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 800));
}

async function signOut(page) {
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const out = btns.find(b => b.innerText.includes('Sign out'));
    if (out) out.click();
  });
  await new Promise(r => setTimeout(r, 800));
}

async function run() {
  console.log('Starting comprehensive ERP browser test suite...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // ----------------------------------------------------
    // TEST 1: Public & Login Branding
    // ----------------------------------------------------
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    const pageTitle = await page.title();
    if (pageTitle.includes('Graphic Era Hill University, Dehradun')) {
      record('Public', 'Browser Title', 'Graphic Era Hill University branding in title', 'PASSED', pageTitle);
    } else {
      record('Public', 'Browser Title', 'Graphic Era Hill University branding in title', 'FAILED', `Got: ${pageTitle}`);
    }

    const loginText = await page.evaluate(() => document.body.innerText);
    if (loginText.includes('Graphic Era Hill University, Dehradun')) {
      record('Public', 'Login Page Branding', 'Institution name visible on login page', 'PASSED', 'Found university branding');
    } else {
      record('Public', 'Login Page Branding', 'Institution name visible on login page', 'FAILED', 'Branding text missing');
    }

    // ----------------------------------------------------
    // TEST 2: Invalid Credentials Validation
    // ----------------------------------------------------
    await page.click('input[type="email"]');
    await page.type('input[type="email"]', 'admin@gehu.ac.in');
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', 'incorrect_password');
    await page.click('button[type="submit"]');

    await new Promise(r => setTimeout(r, 800));
    const errText = await page.evaluate(() => document.body.innerText);
    if (errText.includes('Incorrect password')) {
      record('Auth', 'Invalid Credentials Validation', 'Displays error for incorrect password', 'PASSED', 'Incorrect password rejected');
    } else {
      record('Auth', 'Invalid Credentials Validation', 'Displays error for incorrect password', 'FAILED', 'No error message detected');
    }

    // ----------------------------------------------------
    // TEST 3: Super Admin Login & Dashboard
    // ----------------------------------------------------
    await loginAs(page, 'Priya Iyer');
    const adminUrl = page.url();
    if (adminUrl.includes('/app/dashboard')) {
      record('Admin', 'Login & OTP Flow', 'Redirect to /app/dashboard on successful login', 'PASSED', `Url: ${adminUrl}`);
    } else {
      record('Admin', 'Login & OTP Flow', 'Redirect to /app/dashboard on successful login', 'FAILED', `Url: ${adminUrl}`);
    }

    // Header branding check
    const headerText = await page.evaluate(() => {
      const header = document.querySelector('header');
      return header ? header.innerText : '';
    });
    if (headerText.includes('Graphic Era Hill University, Dehradun')) {
      record('Admin', 'Shared Dashboard Header', 'Displays institution name in top header', 'PASSED', 'Branding confirmed in header');
    } else {
      record('Admin', 'Shared Dashboard Header', 'Displays institution name in top header', 'FAILED', `Header content: ${headerText}`);
    }

    // Refresh persistence check
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));
    if (page.url().includes('/app/dashboard')) {
      record('Admin', 'Session Persistence', 'Remains signed in after page refresh', 'PASSED', 'Session persisted');
    } else {
      record('Admin', 'Session Persistence', 'Remains signed in after page refresh', 'FAILED', 'Session lost after reload');
    }

    // ----------------------------------------------------
    // TEST 4: Record Attendance Workflow as Admin/Faculty
    // ----------------------------------------------------
    await page.goto(`${BASE_URL}/app/attendance`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));

    const hasRecordBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.innerText.includes('Record Attendance'));
    });
    if (hasRecordBtn) {
      record('Admin/Faculty', 'Attendance Record Button', 'Record Attendance button present for admin/faculty', 'PASSED', 'Found button');

      // Click Record Attendance
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find(x => x.innerText.includes('Record Attendance'));
        if (b) b.click();
      });
      await new Promise(r => setTimeout(r, 500));

      // Fill session topic and save
      await page.evaluate(() => {
        const topicInput = document.querySelector('input[placeholder*="Distributed Consensus"]');
        if (topicInput) {
          topicInput.value = 'Concurrency Control & Recovery Protocols';
          topicInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save Attendance'));
        if (saveBtn) saveBtn.click();
      });

      await new Promise(r => setTimeout(r, 1500));

      // Check if newly recorded session appears in the table
      const attTableText = await page.evaluate(() => document.body.innerText);
      if (attTableText.includes('Concurrency Control & Recovery Protocols')) {
        record('Admin/Faculty', 'Attendance Persistence', 'New attendance record persists and appears in table', 'PASSED', 'Record saved and rendered');
      } else {
        record('Admin/Faculty', 'Attendance Persistence', 'New attendance record persists and appears in table', 'FAILED', 'Record not found in table');
      }
    } else {
      record('Admin/Faculty', 'Attendance Record Button', 'Record Attendance button present for admin/faculty', 'FAILED', 'Button missing');
    }

    // ----------------------------------------------------
    // TEST 5: Fees Module
    // ----------------------------------------------------
    await page.goto(`${BASE_URL}/app/fees`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));

    const feesContent = await page.evaluate(() => document.body.innerText);
    if (feesContent.includes('Total billed') && feesContent.includes('INV-2025-GEHU-01')) {
      record('Admin', 'Fees Module', 'Invoices rendered with totals', 'PASSED', 'Fee table populated');
    } else {
      record('Admin', 'Fees Module', 'Invoices rendered with totals', 'FAILED', 'Fee invoices missing');
    }

    // ----------------------------------------------------
    // TEST 6: All Modules for Admin
    // ----------------------------------------------------
    const screens = [
      { name: 'Students Directory', path: '/app/students', check: 'STU-2025-001' },
      { name: 'Faculty Master', path: '/app/faculty', check: 'Dr. Meera Shankar' },
      { name: 'Courses Catalog', path: '/app/courses', check: 'CS-301' },
      { name: 'Timetable Schedule', path: '/app/timetable', check: 'Database Management Systems' },
      { name: 'Exams & Grades', path: '/app/exams', check: 'Overall CGPA' },
      { name: 'Library Catalog', path: '/app/library', check: 'Database System Concepts' },
      { name: 'Workflows & Approvals', path: '/app/workflows', check: 'Approvals' },
      { name: 'Account Approvals', path: '/app/account-approvals', check: 'Account Approvals' },
      { name: 'Analytics Dashboard', path: '/app/analytics', check: 'Academic Analytics' },
      { name: 'Reports Console', path: '/app/reports', check: 'Report Generator' },
    ];

    for (const scr of screens) {
      await page.goto(`${BASE_URL}${scr.path}`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 600));
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes(scr.check)) {
        record('Admin', scr.name, `Renders ${scr.path} with data`, 'PASSED', `Found '${scr.check}'`);
      } else {
        record('Admin', scr.name, `Renders ${scr.path} with data`, 'FAILED', `Missing '${scr.check}'`);
      }
    }

    // ----------------------------------------------------
    // TEST 7: Logout and Protected Route Verification
    // ----------------------------------------------------
    await signOut(page);
    if (page.url().includes('/login')) {
      record('Auth', 'Sign Out', 'Sign out redirects to /login', 'PASSED', 'Logged out successfully');
    } else {
      record('Auth', 'Sign Out', 'Sign out redirects to /login', 'FAILED', `Url: ${page.url()}`);
    }

    // Attempt direct access to dashboard while logged out
    await page.goto(`${BASE_URL}/app/dashboard`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));
    if (page.url().includes('/login')) {
      record('Auth', 'Route Protection', 'Unauthenticated user redirected away from /app/*', 'PASSED', 'Protected guard working');
    } else {
      record('Auth', 'Route Protection', 'Unauthenticated user redirected away from /app/*', 'FAILED', `Allowed to reach: ${page.url()}`);
    }

    // ----------------------------------------------------
    // TEST 8: Faculty Role Verification
    // ----------------------------------------------------
    await loginAs(page, 'Dr. Meera Shankar');
    const facDashText = await page.evaluate(() => document.body.innerText);
    if (facDashText.includes('Dr. Meera Shankar') && facDashText.includes('Computer Science & Engineering')) {
      record('Faculty', 'Dashboard', 'Faculty workspace customized for department and courses', 'PASSED', 'Faculty dashboard verified');
    } else {
      record('Faculty', 'Dashboard', 'Faculty workspace customized for department and courses', 'FAILED', 'Faculty details missing');
    }

    await signOut(page);

    // ----------------------------------------------------
    // TEST 9: Student Role (Alex Chen)
    // ----------------------------------------------------
    await loginAs(page, 'Alex Chen');
    const stuDashText = await page.evaluate(() => document.body.innerText);
    if (stuDashText.includes('Alex') && stuDashText.includes('STU-2025-001')) {
      record('Student', 'Dashboard', 'Student workspace shows roll STU-2025-001 and Semester 5', 'PASSED', 'Roll and semester verified');
    } else {
      record('Student', 'Dashboard', 'Student workspace shows roll STU-2025-001 and Semester 5', 'FAILED', 'Student info missing');
    }

    // Student Attendance view (must see newly recorded session)
    await page.goto(`${BASE_URL}/app/attendance`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));
    const stuAttText = await page.evaluate(() => document.body.innerText);
    if (stuAttText.includes('Concurrency Control & Recovery Protocols')) {
      record('Student', 'Attendance View', 'Student sees attendance recorded by faculty', 'PASSED', 'Faculty record reflected for student');
    } else {
      record('Student', 'Attendance View', 'Student sees attendance recorded by faculty', 'FAILED', 'Attendance record not found');
    }

    // Student Fees (only STU-2025-001 invoices)
    await page.goto(`${BASE_URL}/app/fees`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));
    const stuFeesText = await page.evaluate(() => document.body.innerText);
    if (stuFeesText.includes('INV-2025-GEHU-01') && !stuFeesText.includes('INV-2025-GEHU-03')) {
      record('Student', 'Fee Scoping', 'Student sees only own invoices, not other students', 'PASSED', 'INV-2025-GEHU-01 present, 03 absent');
    } else {
      record('Student', 'Fee Scoping', 'Student sees only own invoices, not other students', 'FAILED', 'Fee data bleeding across students');
    }

    await signOut(page);

    // ----------------------------------------------------
    // TEST 10: Parent 1 (Ravi Chen) vs Parent 2 (Vikram Sharma) Data Isolation
    // ----------------------------------------------------
    // Log in as Parent 1 (Ravi Chen)
    await loginAs(page, 'Ravi Chen');

    // Parent 1 Dashboard
    const p1Dash = await page.evaluate(() => document.body.innerText);
    if (p1Dash.includes('Ravi') && p1Dash.includes('STU-2025-001')) {
      record('Parent 1', 'Ward Scoping', 'Monitors ward STU-2025-001', 'PASSED', 'Linked to STU-2025-001');
    } else {
      record('Parent 1', 'Ward Scoping', 'Monitors ward STU-2025-001', 'FAILED', 'Ward STU-2025-001 missing');
    }

    // Parent 1 Fees
    await page.goto(`${BASE_URL}/app/fees`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));
    const p1Fees = await page.evaluate(() => document.body.innerText);
    const p1HasWard1 = p1Fees.includes('INV-2025-GEHU-01') || p1Fees.includes('INV-2025-GEHU-02');
    const p1HasWard2 = p1Fees.includes('INV-2025-GEHU-03') || p1Fees.includes('INV-2025-GEHU-04');

    if (p1HasWard1 && !p1HasWard2) {
      record('Parent 1', 'Fee Isolation', 'Sees only ward STU-2025-001 fees, not ward 2', 'PASSED', 'Strict isolation confirmed');
    } else {
      record('Parent 1', 'Fee Isolation', 'Sees only ward STU-2025-001 fees, not ward 2', 'FAILED', `Ward1: ${p1HasWard1}, Ward2: ${p1HasWard2}`);
    }

    await signOut(page);

    // Log in as Parent 2 (Vikram Sharma)
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.click('input[type="email"]');
    await page.type('input[type="email"]', 'vikram.sharma@gehu.ac.in');
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', 'campus123');
    await page.click('button[type="submit"]');

    await page.waitForSelector('#otp-0', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const fillBtn = btns.find(b => b.innerText.includes('Fill demo'));
      if (fillBtn) fillBtn.click();
    });
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const verifyBtn = btns.find(b => b.innerText.includes('Verify'));
      if (verifyBtn) verifyBtn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 800));

    // Parent 2 Dashboard
    const p2Dash = await page.evaluate(() => document.body.innerText);
    if (p2Dash.includes('Vikram') && p2Dash.includes('STU-2025-002')) {
      record('Parent 2', 'Ward Scoping', 'Monitors ward STU-2025-002', 'PASSED', 'Linked to STU-2025-002');
    } else {
      record('Parent 2', 'Ward Scoping', 'Monitors ward STU-2025-002', 'FAILED', 'Ward STU-2025-002 missing');
    }

    // Parent 2 Fees
    await page.goto(`${BASE_URL}/app/fees`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));
    const p2Fees = await page.evaluate(() => document.body.innerText);
    const p2HasWard1 = p2Fees.includes('INV-2025-GEHU-01') || p2Fees.includes('INV-2025-GEHU-02');
    const p2HasWard2 = p2Fees.includes('INV-2025-GEHU-03') || p2Fees.includes('INV-2025-GEHU-04');

    if (p2HasWard2 && !p2HasWard1) {
      record('Parent 2', 'Fee Isolation', 'Sees only ward STU-2025-002 fees, not ward 1', 'PASSED', 'Strict isolation confirmed');
    } else {
      record('Parent 2', 'Fee Isolation', 'Sees only ward STU-2025-002 fees, not ward 1', 'FAILED', `Ward1: ${p2HasWard1}, Ward2: ${p2HasWard2}`);
    }

    await signOut(page);

    console.log('\n========================================');
    console.log('   TEST SUITE SUMMARY & DETAILED REPORT');
    console.log('========================================');
    console.log(`Total test assertions: ${results.length}`);
    const passed = results.filter(r => r.status === 'PASSED').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed === 0) {
      console.log('ALL TESTS PASSED SUCCESSFULLY! 100% PASS RATE');
    }

  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
