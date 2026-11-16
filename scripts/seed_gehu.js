import { createClient } from '@supabase/supabase-js';

if (process.loadEnvFile) process.loadEnvFile('.env');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase URL or SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function seed() {
  console.log('Seeding Graphic Era Hill University, Dehradun ERP data...');

  // 1. Accounts
  const accounts = [
    {
      email: 'admin@gehu.ac.in',
      password_hash: 'campus123',
      full_name: 'Priya Iyer',
      role: 'admin',
      institution: 'Graphic Era Hill University, Dehradun',
      status: 'active',
    },
    {
      email: 'dr.meera@gehu.ac.in',
      password_hash: 'campus123',
      full_name: 'Dr. Meera Shankar',
      role: 'faculty',
      department: 'Computer Science & Engineering',
      institution: 'Graphic Era Hill University, Dehradun',
      status: 'active',
    },
    {
      email: 'alex.chen@gehu.ac.in',
      password_hash: 'campus123',
      full_name: 'Alex Chen',
      role: 'student',
      student_id: 'STU-2025-001',
      program: 'B.Tech CSE',
      semester: 5,
      department: 'Computer Science & Engineering',
      institution: 'Graphic Era Hill University, Dehradun',
      status: 'active',
    },
    {
      email: 'ravi.chen@gehu.ac.in',
      password_hash: 'campus123',
      full_name: 'Ravi Chen',
      role: 'parent',
      student_id: 'STU-2025-001',
      institution: 'Graphic Era Hill University, Dehradun',
      status: 'active',
    },
    {
      email: 'sara.sharma@gehu.ac.in',
      password_hash: 'campus123',
      full_name: 'Sara Sharma',
      role: 'student',
      student_id: 'STU-2025-002',
      program: 'B.Tech CSE',
      semester: 5,
      department: 'Computer Science & Engineering',
      institution: 'Graphic Era Hill University, Dehradun',
      status: 'active',
    },
    {
      email: 'vikram.sharma@gehu.ac.in',
      password_hash: 'campus123',
      full_name: 'Vikram Sharma',
      role: 'parent',
      student_id: 'STU-2025-002',
      institution: 'Graphic Era Hill University, Dehradun',
      status: 'active',
    },
  ];

  for (const acc of accounts) {
    const { data: existing } = await supabase.from('accounts').select('id').eq('email', acc.email).maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('accounts').insert(acc);
      if (error) console.error('Error inserting account', acc.email, error.message);
    }
  }

  // 2. Students
  const students = [
    {
      student_id: 'STU-2025-001',
      full_name: 'Alex Chen',
      email: 'alex.chen@gehu.ac.in',
      phone: '+91 98765 43210',
      program: 'B.Tech CSE',
      semester: 5,
      cgpa: 8.85,
      status: 'active',
      guardian: 'Ravi Chen',
      dob: '2004-05-14',
      address: 'Dehradun, Uttarakhand',
    },
    {
      student_id: 'STU-2025-002',
      full_name: 'Sara Sharma',
      email: 'sara.sharma@gehu.ac.in',
      phone: '+91 98765 43211',
      program: 'B.Tech CSE',
      semester: 5,
      cgpa: 9.10,
      status: 'active',
      guardian: 'Vikram Sharma',
      dob: '2004-08-22',
      address: 'Clement Town, Dehradun, Uttarakhand',
    },
  ];

  for (const stu of students) {
    const { data: existing } = await supabase.from('students').select('id').eq('student_id', stu.student_id).maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('students').insert(stu);
      if (error) console.error('Error inserting student', stu.student_id, error.message);
    }
  }

  // 3. Faculty
  const faculty = [
    {
      full_name: 'Dr. Meera Shankar',
      email: 'dr.meera@gehu.ac.in',
      phone: '+91 98765 43220',
      department: 'Computer Science & Engineering',
      designation: 'Associate Professor',
      qualification: 'Ph.D. Computer Science',
      courses_count: 3,
      students_count: 120,
      rating: 4.8,
      joined_on: '2021-07-15',
    },
    {
      full_name: 'Prof. Arjun Raman',
      email: 'arjun.raman@gehu.ac.in',
      phone: '+91 98765 43221',
      department: 'Computer Science & Engineering',
      designation: 'Assistant Professor',
      qualification: 'M.Tech CSE',
      courses_count: 2,
      students_count: 80,
      rating: 4.6,
      joined_on: '2022-01-10',
    },
  ];

  for (const fac of faculty) {
    const { data: existing } = await supabase.from('faculty').select('id').eq('email', fac.email).maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('faculty').insert(fac);
      if (error) console.error('Error inserting faculty', fac.email, error.message);
    }
  }

  // 4. Courses
  const courses = [
    {
      code: 'CS-301',
      title: 'Database Management Systems',
      description: 'Relational algebra, SQL, indexing, transaction processing',
      faculty_name: 'Dr. Meera Shankar',
      semester: 5,
      credits: 4,
      enrolled: 60,
      total_sessions: 40,
      sessions_done: 28,
      program: 'B.Tech CSE',
    },
    {
      code: 'CS-302',
      title: 'Operating Systems',
      description: 'Concurrency, memory management, file systems, virtualization',
      faculty_name: 'Dr. Meera Shankar',
      semester: 5,
      credits: 4,
      enrolled: 60,
      total_sessions: 40,
      sessions_done: 26,
      program: 'B.Tech CSE',
    },
    {
      code: 'CS-303',
      title: 'Computer Networks',
      description: 'OSI stack, TCP/IP, routing protocols, socket programming',
      faculty_name: 'Prof. Arjun Raman',
      semester: 5,
      credits: 3,
      enrolled: 60,
      total_sessions: 36,
      sessions_done: 24,
      program: 'B.Tech CSE',
    },
  ];

  for (const c of courses) {
    const { data: existing } = await supabase.from('courses').select('id').eq('code', c.code).maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('courses').insert(c);
      if (error) console.error('Error inserting course', c.code, error.message);
    }
  }

  // 5. Timetable
  const timetable = [
    { day_index: 0, start_time: '09:00:00', end_time: '10:00:00', subject: 'Database Management Systems', course_code: 'CS-301', faculty: 'Dr. Meera Shankar', room: 'CS-201' },
    { day_index: 0, start_time: '10:15:00', end_time: '11:15:00', subject: 'Operating Systems', course_code: 'CS-302', faculty: 'Dr. Meera Shankar', room: 'CS-104' },
    { day_index: 0, start_time: '11:30:00', end_time: '12:30:00', subject: 'Computer Networks', course_code: 'CS-303', faculty: 'Prof. Arjun Raman', room: 'CS-205' },
    { day_index: 1, start_time: '09:00:00', end_time: '10:00:00', subject: 'Operating Systems', course_code: 'CS-302', faculty: 'Dr. Meera Shankar', room: 'CS-104' },
    { day_index: 1, start_time: '10:15:00', end_time: '11:15:00', subject: 'Database Management Systems', course_code: 'CS-301', faculty: 'Dr. Meera Shankar', room: 'CS-201' },
    { day_index: 2, start_time: '09:00:00', end_time: '10:00:00', subject: 'Computer Networks', course_code: 'CS-303', faculty: 'Prof. Arjun Raman', room: 'CS-205' },
    { day_index: 3, start_time: '14:00:00', end_time: '16:00:00', subject: 'DBMS Laboratory', course_code: 'CS-301L', faculty: 'Dr. Meera Shankar', room: 'Lab-2' },
  ];

  const { count: ttCount } = await supabase.from('timetable').select('*', { count: 'exact', head: true });
  if (!ttCount) {
    const { error } = await supabase.from('timetable').insert(timetable);
    if (error) console.error('Error inserting timetable', error.message);
  }

  // 6. Attendance
  const attendance = [
    { student_id: 'STU-2025-001', course_code: 'CS-301', session_date: '2026-11-02', session_title: 'Query Optimization', status: 'present', method: 'biometric' },
    { student_id: 'STU-2025-001', course_code: 'CS-301', session_date: '2026-11-04', session_title: 'Indexing & B-Trees', status: 'present', method: 'QR' },
    { student_id: 'STU-2025-001', course_code: 'CS-302', session_date: '2026-11-05', session_title: 'Page Replacement Algorithms', status: 'present', method: 'biometric' },
    { student_id: 'STU-2025-001', course_code: 'CS-302', session_date: '2026-11-08', session_title: 'File System Design', status: 'late', method: 'manual' },
    { student_id: 'STU-2025-002', course_code: 'CS-301', session_date: '2026-11-02', session_title: 'Query Optimization', status: 'present', method: 'biometric' },
    { student_id: 'STU-2025-002', course_code: 'CS-302', session_date: '2026-11-05', session_title: 'Page Replacement Algorithms', status: 'absent', method: 'manual' },
  ];

  const { count: attCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true });
  if (!attCount) {
    const { error } = await supabase.from('attendance').insert(attendance);
    if (error) console.error('Error inserting attendance', error.message);
  }

  // 7. Fees
  const fees = [
    { invoice_no: 'INV-2025-GEHU-01', student_id: 'STU-2025-001', description: 'Semester 5 Tuition & Exam Fee', amount: 65000, due_date: '2026-09-15', paid_on: '2026-09-10', status: 'paid' },
    { invoice_no: 'INV-2025-GEHU-02', student_id: 'STU-2025-001', description: 'Hostel Accommodation (Sem 5)', amount: 28000, due_date: '2026-12-01', paid_on: null, status: 'pending' },
    { invoice_no: 'INV-2025-GEHU-03', student_id: 'STU-2025-002', description: 'Semester 5 Tuition & Exam Fee', amount: 65000, due_date: '2026-09-15', paid_on: '2026-09-12', status: 'paid' },
    { invoice_no: 'INV-2025-GEHU-04', student_id: 'STU-2025-002', description: 'Bus Transport Fee (Route 7)', amount: 12000, due_date: '2026-11-20', paid_on: null, status: 'pending' },
  ];

  for (const f of fees) {
    const { data: existing } = await supabase.from('fees').select('id').eq('invoice_no', f.invoice_no).maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('fees').insert(f);
      if (error) console.error('Error inserting fee', f.invoice_no, error.message);
    }
  }

  // 8. Exams & Grades
  const exams = [
    { subject: 'Database Management Systems', course_code: 'CS-301', exam_type: 'Mid-term', exam_date: '2026-11-25', start_time: '10:00:00', duration_min: 120, room: 'Exam Hall A', semester: 5 },
    { subject: 'Operating Systems', course_code: 'CS-302', exam_type: 'Mid-term', exam_date: '2026-11-27', start_time: '10:00:00', duration_min: 120, room: 'Exam Hall B', semester: 5 },
    { subject: 'Computer Networks', course_code: 'CS-303', exam_type: 'Mid-term', exam_date: '2026-11-30', start_time: '10:00:00', duration_min: 120, room: 'Exam Hall A', semester: 5 },
  ];

  const { count: examCount } = await supabase.from('exams').select('*', { count: 'exact', head: true });
  if (!examCount) {
    const { error } = await supabase.from('exams').insert(exams);
    if (error) console.error('Error inserting exams', error.message);
  }

  const grades = [
    { student_id: 'STU-2025-001', course_code: 'CS-301', course_title: 'Database Management Systems', marks: 88, max_marks: 100, grade: 'A+', grade_point: 9.0, semester_label: 'Semester 4' },
    { student_id: 'STU-2025-001', course_code: 'CS-302', course_title: 'Operating Systems', marks: 82, max_marks: 100, grade: 'A', grade_point: 8.0, semester_label: 'Semester 4' },
    { student_id: 'STU-2025-002', course_code: 'CS-301', course_title: 'Database Management Systems', marks: 95, max_marks: 100, grade: 'O', grade_point: 10.0, semester_label: 'Semester 4' },
    { student_id: 'STU-2025-002', course_code: 'CS-302', course_title: 'Operating Systems', marks: 91, max_marks: 100, grade: 'O', grade_point: 10.0, semester_label: 'Semester 4' },
  ];

  const { count: gradeCount } = await supabase.from('grades').select('*', { count: 'exact', head: true });
  if (!gradeCount) {
    const { error } = await supabase.from('grades').insert(grades);
    if (error) console.error('Error inserting grades', error.message);
  }

  // 9. Assignments
  const assignments = [
    { title: 'ER Diagram & Schema Normalization', description: 'Design a 3NF schema for an e-commerce platform', course_code: 'CS-301', due_date: '2026-11-20', status: 'pending', max_marks: 25, student_id: 'STU-2025-001' },
    { title: 'Thread Synchronization using Mutexes', description: 'Implement producer-consumer problem in C', course_code: 'CS-302', due_date: '2026-11-22', status: 'submitted', max_marks: 30, marks: 28, submitted_on: '2026-11-10', student_id: 'STU-2025-001' },
    { title: 'Packet Capture & Wireshark Analysis', description: 'Analyze DNS, HTTP, and TLS handshakes', course_code: 'CS-303', due_date: '2026-11-28', status: 'pending', max_marks: 20, student_id: 'STU-2025-002' },
  ];

  const { count: asgCount } = await supabase.from('assignments').select('*', { count: 'exact', head: true });
  if (!asgCount) {
    const { error } = await supabase.from('assignments').insert(assignments);
    if (error) console.error('Error inserting assignments', error.message);
  }

  // 10. Notifications
  const notifications = [
    { title: 'Graphic Era Hill University Campus Reopening Notice', body: 'Fall semester regular academic classes resume on schedule. All students are advised to check their timetable.', priority: 'high', audience: 'all', channel: 'in_app', is_read: false },
    { title: 'Mid-term Examination Schedule Published', body: 'The datesheet for B.Tech Semester 5 mid-term examinations is now available under Exams & Grades.', priority: 'medium', audience: 'students', channel: 'in_app', is_read: false },
  ];

  const { count: notifCount } = await supabase.from('notifications').select('*', { count: 'exact', head: true });
  if (!notifCount) {
    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) console.error('Error inserting notifications', error.message);
  }

  // 11. Library Books
  const books = [
    { title: 'Database System Concepts (7th Ed)', author: 'Silberschatz, Korth, Sudarshan', isbn: '978-0078022159', category: 'Computer Science', status: 'borrowed', borrower: 'Alex Chen', due_date: '2026-11-24' },
    { title: 'Operating System Concepts (10th Ed)', author: 'Silberschatz, Galvin, Gagne', isbn: '978-1119456339', category: 'Computer Science', status: 'available' },
    { title: 'Computer Networks: A Systems Approach', author: 'Larry Peterson & Bruce Davie', isbn: '978-0123850591', category: 'Networking', status: 'available' },
  ];

  const { count: bookCount } = await supabase.from('library_books').select('*', { count: 'exact', head: true });
  if (!bookCount) {
    const { error } = await supabase.from('library_books').insert(books);
    if (error) console.error('Error inserting books', error.message);
  }

  // 12. Hostel & Transport
  const hostelRooms = [
    { block: 'Aryabhata Block A', room_no: '204', room_type: 'Double', occupant_name: 'Alex Chen', occupant_id: 'STU-2025-001', monthly_fee: 7000, status: 'occupied' },
    { block: 'Aryabhata Block A', room_no: '205', room_type: 'Single', occupant_name: null, occupant_id: null, monthly_fee: 9000, status: 'vacant' },
    { block: 'Gargi Block B', room_no: '102', room_type: 'Double', occupant_name: 'Sara Sharma', occupant_id: 'STU-2025-002', monthly_fee: 7000, status: 'occupied' },
  ];

  const { count: hostelCount } = await supabase.from('hostel').select('*', { count: 'exact', head: true });
  if (!hostelCount) {
    const { error } = await supabase.from('hostel').insert(hostelRooms);
    if (error) console.error('Error inserting hostel', error.message);
  }

  const transportRoutes = [
    { route_no: 'Route 7', route_name: 'Rajpur Road to GEHU Campus', vehicle_no: 'UK-07-PA-1234', driver_name: 'Ramesh Singh', driver_phone: '+91 98765 11223', capacity: 42, stops: 'Clock Tower, Dilaram Chowk, Jakhan, GEHU', next_pickup: '07:45 AM' },
    { route_no: 'Route 12', route_name: 'ISBT / Clement Town to GEHU Campus', vehicle_no: 'UK-07-PA-5678', driver_name: 'Surender Negi', driver_phone: '+91 98765 11224', capacity: 50, stops: 'ISBT, Majra, Subhash Nagar, GEHU', next_pickup: '08:00 AM' },
  ];

  const { count: transCount } = await supabase.from('transport').select('*', { count: 'exact', head: true });
  if (!transCount) {
    const { error } = await supabase.from('transport').insert(transportRoutes);
    if (error) console.error('Error inserting transport', error.message);
  }

  // 13. Payroll
  const payroll = [
    { employee_id: 'FAC-001', employee_name: 'Dr. Meera Shankar', designation: 'Associate Professor', pay_period: '2026-10', basic: 95000, allowances: 25000, deductions: 12000, status: 'paid' },
    { employee_id: 'FAC-002', employee_name: 'Prof. Arjun Raman', designation: 'Assistant Professor', pay_period: '2026-10', basic: 75000, allowances: 18000, deductions: 9000, status: 'paid' },
  ];

  const { count: payCount } = await supabase.from('payroll').select('*', { count: 'exact', head: true });
  if (!payCount) {
    const { error } = await supabase.from('payroll').insert(payroll);
    if (error) console.error('Error inserting payroll', error.message);
  }

  // 14. Documents
  const documents = [
    { title: 'Alex Chen — Grade Sheet Sem 4', category: 'Academic', file_type: 'pdf', size_kb: 420, owner: 'STU-2025-001' },
    { title: 'Bonafide Certificate — Alex Chen', category: 'Certificates', file_type: 'pdf', size_kb: 210, owner: 'STU-2025-001' },
    { title: 'Sara Sharma — Grade Sheet Sem 4', category: 'Academic', file_type: 'pdf', size_kb: 435, owner: 'STU-2025-002' },
    { title: 'GEHU Academic Calendar 2026-27', category: 'Institutional', file_type: 'pdf', size_kb: 890, owner: null },
  ];

  const { count: docCount } = await supabase.from('documents').select('*', { count: 'exact', head: true });
  if (!docCount) {
    const { error } = await supabase.from('documents').insert(documents);
    if (error) console.error('Error inserting documents', error.message);
  }

  // 15. LMS Modules
  const lms = [
    { title: 'Database Indexing & Query Plans', description: 'Deep dive into B+ Trees, Hash Indexes and EXPLAIN plans', category: 'Database Systems', videos_count: 5, readings_count: 4, quizzes_count: 2, progress_pct: 75, course_code: 'CS-301' },
    { title: 'Memory Management & Virtual Memory', description: 'Paging, TLB, Segmentation and Inverted Page Tables', category: 'Operating Systems', videos_count: 6, readings_count: 3, quizzes_count: 1, progress_pct: 60, course_code: 'CS-302' },
  ];

  const { count: lmsCount } = await supabase.from('lms_modules').select('*', { count: 'exact', head: true });
  if (!lmsCount) {
    const { error } = await supabase.from('lms_modules').insert(lms);
    if (error) console.error('Error inserting lms', error.message);
  }

  console.log('Seeding completed successfully!');
}

seed().catch(err => {
  console.error('Seed script failed:', err);
  process.exit(1);
});

