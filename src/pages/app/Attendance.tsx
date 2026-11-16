import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { api } from '../../lib/api';
import { ClipboardList, CheckCircle2, XCircle, CalendarDays, Plus, ShieldCheck, X } from 'lucide-react';
import { Donut, LineChart } from '../../components/Charts';
import Loader from '../../components/Loader';
import { useSession } from '../../lib/session';
import { can } from '../../lib/rbac';

export default function Attendance() {
  const { user } = useSession();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [form, setForm] = useState({
    student_id: 'STU-2025-001',
    course_code: 'CS-301',
    session_date: new Date().toISOString().slice(0, 10),
    session_title: 'Database Transactions & Concurrency',
    status: 'present',
    method: 'biometric',
  });

  const load = async () => {
    try {
      setLoading(true);
      const url = (user?.role === 'student' || user?.role === 'parent') && user?.studentId
        ? `/api/attendance?student_id=${encodeURIComponent(user.studentId)}`
        : '/api/attendance';
      const data = await api<any[]>(url);
      setList(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const canRecord = user ? can(user.role, 'attendance', 'create') : false;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_id.trim() || !form.course_code.trim() || !form.session_date) {
      setErr('Please fill in all required fields.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await api('/api/attendance', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowModal(false);
      await load();
    } catch (e: any) {
      setErr(e.message || 'Failed to save attendance record');
    } finally {
      setSaving(false);
    }
  };

  const total = list.length;
  const present = list.filter(r => r.status === 'present').length;
  const absent = list.filter(r => r.status === 'absent').length;
  const late = list.filter(r => r.status === 'late').length;

  // Build weekly trend
  const byDate = new Map<string, { p: number; a: number }>();
  list.forEach(r => {
    const d = r.session_date;
    const cur = byDate.get(d) || { p: 0, a: 0 };
    cur[r.status === 'present' || r.status === 'late' ? 'p' : 'a']++;
    byDate.set(d, cur);
  });
  const dates = Array.from(byDate.keys()).sort().slice(-10);
  const trend = dates.map(d => {
    const c = byDate.get(d)!;
    return Math.round((c.p / Math.max(c.p + c.a, 1)) * 100);
  });

  const scopeChip = useMemo(() => {
    if (!user) return null;
    if (user.role === 'admin') return { label: 'Institution-wide view', tone: 'from-rose-500 to-orange-500' };
    if (user.role === 'faculty') return { label: 'Faculty attendance console', tone: 'from-blue-500 to-indigo-600' };
    if (user.role === 'parent') return { label: `Ward attendance · ${user.studentId}`, tone: 'from-violet-500 to-purple-600' };
    return { label: `Student attendance · ${user.studentId}`, tone: 'from-cyan-500 to-teal-500' };
  }, [user]);

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Attendance"
        subtitle="Session-wise attendance tracking & analytics · Graphic Era Hill University"
        icon={<ClipboardList size={20} />}
        actions={
          <div className="flex items-center gap-2">
            {scopeChip && (
              <div className={`chip bg-gradient-to-r ${scopeChip.tone} text-white border-0 inline-flex`}>
                <ShieldCheck size={10} /> {scopeChip.label}
              </div>
            )}
            {canRecord && (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary inline-flex items-center gap-1.5"
                aria-label="Record Attendance"
              >
                <Plus size={14} /> Record Attendance
              </button>
            )}
          </div>
        }
      />

      <div className="grid lg:grid-cols-4 gap-4 mb-4">
        <div className="surface-solid rounded-2xl p-5 flex items-center gap-4 lg:col-span-2">
          <Donut value={present} total={total || 1} label="Present" sub={`${present} / ${total} sessions`} />
          <div className="flex-1 space-y-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10"><div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /><span className="text-sm font-semibold">Present</span></div><span className="font-bold">{present}</span></div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10"><div className="flex items-center gap-2"><CalendarDays size={14} className="text-amber-600" /><span className="text-sm font-semibold">Late</span></div><span className="font-bold">{late}</span></div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10"><div className="flex items-center gap-2"><XCircle size={14} className="text-rose-600" /><span className="text-sm font-semibold">Absent</span></div><span className="font-bold">{absent}</span></div>
          </div>
        </div>
        <div className="surface-solid rounded-2xl p-5 lg:col-span-2">
          <div className="text-sm font-bold mb-1">Trend · last {trend.length} sessions</div>
          <div className="text-xs text-slate-500 mb-2">% present per session</div>
          <div className="text-slate-700 dark:text-slate-300">
            <LineChart data={trend.length ? trend : [92, 88, 95, 90, 87, 94, 96]} height={170} />
          </div>
        </div>
      </div>

      {loading ? <Loader /> : (
        <div className="surface-solid rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="text-sm font-bold">Recent sessions</div>
            <div className="chip bg-teal-500/10 text-teal-600">{list.length} records</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  {(user?.role === 'admin' || user?.role === 'faculty') && (
                    <th className="text-left px-4 py-3">Student ID</th>
                  )}
                  <th className="text-left px-4 py-3">Course</th>
                  <th className="text-left px-4 py-3">Session</th>
                  <th className="text-left px-4 py-3">Method</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 40).map(r => (
                  <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-4 py-2.5 font-mono text-xs">{r.session_date}</td>
                    {(user?.role === 'admin' || user?.role === 'faculty') && (
                      <td className="px-4 py-2.5 font-mono text-xs text-cyan-600 dark:text-cyan-400 font-bold">{r.student_id}</td>
                    )}
                    <td className="px-4 py-2.5 font-semibold">{r.course_code}</td>
                    <td className="px-4 py-2.5 text-slate-500">{r.session_title}</td>
                    <td className="px-4 py-2.5"><span className="chip bg-slate-200 dark:bg-slate-800 text-slate-700">{r.method}</span></td>
                    <td className="px-4 py-2.5">
                      <span className={`chip ${r.status === 'present' ? 'bg-emerald-500/10 text-emerald-600' : r.status === 'absent' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Attendance Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-solid rounded-2xl max-w-lg w-full p-6 elev-4 border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="font-bold text-lg flex items-center gap-2">
                <ClipboardList size={18} className="text-cyan-500" /> Record Session Attendance
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>
            {err && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                {err}
              </div>
            )}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Student</label>
                <select
                  value={form.student_id}
                  onChange={e => setForm({ ...form, student_id: e.target.value })}
                  className="w-full"
                  required
                >
                  <option value="STU-2025-001">STU-2025-001 — Alex Chen (B.Tech CSE)</option>
                  <option value="STU-2025-002">STU-2025-002 — Sara Sharma (B.Tech CSE)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Course</label>
                  <select
                    value={form.course_code}
                    onChange={e => setForm({ ...form, course_code: e.target.value })}
                    className="w-full"
                    required
                  >
                    <option value="CS-301">CS-301 · Database Systems</option>
                    <option value="CS-302">CS-302 · Operating Systems</option>
                    <option value="CS-303">CS-303 · Computer Networks</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Date</label>
                  <input
                    type="date"
                    value={form.session_date}
                    onChange={e => setForm({ ...form, session_date: e.target.value })}
                    className="w-full"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Session Topic</label>
                <input
                  type="text"
                  value={form.session_title}
                  onChange={e => setForm({ ...form, session_title: e.target.value })}
                  className="w-full"
                  placeholder="e.g. Distributed Consensus"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full"
                    required
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Verification Method</label>
                  <select
                    value={form.method}
                    onChange={e => setForm({ ...form, method: e.target.value })}
                    className="w-full"
                    required
                  >
                    <option value="biometric">Biometric</option>
                    <option value="QR">QR Code</option>
                    <option value="manual">Manual Roll Call</option>
                    <option value="RFID">RFID Card</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? 'Saving…' : 'Save Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
