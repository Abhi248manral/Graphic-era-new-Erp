import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { can } from '../../lib/rbac';
import { Users, Search, Plus, Download, Mail, Phone, X } from 'lucide-react';

export default function Students() {
  const { user } = useSession();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [program, setProgram] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [form, setForm] = useState({ student_id: '', full_name: '', email: '', phone: '', program: '', semester: 1, cgpa: 0, status: 'active' });

  const canManage = user ? can(user.role, 'students', 'create') : false;

  const load = async () => { try { setList(await api('/api/students')); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const filtered = list.filter(s =>
    (program === 'all' || s.program === program) &&
    (q === '' || s.full_name?.toLowerCase().includes(q.toLowerCase()) || s.email?.toLowerCase().includes(q.toLowerCase()) || s.student_id?.toLowerCase().includes(q.toLowerCase()))
  );

  const programs = Array.from(new Set(list.map(s => s.program).filter(Boolean)));

  const onExport = () => {
    const header = ['student_id', 'full_name', 'email', 'phone', 'program', 'semester', 'cgpa', 'status'];
    const rows = filtered.map(s => header.map(k => `"${String(s[k] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Graphic_Era_Students_Export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    if (!form.full_name.trim() || !form.email.trim() || !form.student_id.trim() || !form.program.trim()) {
      setFormErr('Full name, email, student ID and program are required.');
      return;
    }
    setSaving(true);
    try {
      await api('/api/students', {
        method: 'POST',
        body: JSON.stringify({ ...form, semester: Number(form.semester) || 1, cgpa: Number(form.cgpa) || 0 }),
      });
      setShowAdd(false);
      setForm({ student_id: '', full_name: '', email: '', phone: '', program: '', semester: 1, cgpa: 0, status: 'active' });
      await load();
    } catch (e: any) {
      setFormErr(e?.message || 'Failed to add student.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Students" subtitle="Institution-wide student directory" icon={<Users size={22} />}
        actions={canManage ? <>
          <button onClick={onExport} className="btn-ghost inline-flex items-center gap-2"><Download size={14} /> Export</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary inline-flex items-center gap-2"><Plus size={14} /> Add student</button>
        </> : undefined} />

      {/* Quick stats */}
      <div className="grid sm:grid-cols-4 gap-4 mb-5 stagger">
        {[
          { l: 'Total', v: list.length, c: 'from-cyan-500 to-teal-500' },
          { l: 'Active', v: list.filter(s => s.status === 'active').length, c: 'from-emerald-500 to-teal-600' },
          { l: 'Programs', v: programs.length, c: 'from-blue-500 to-indigo-600' },
          { l: 'Avg CGPA', v: list.length ? (list.reduce((a, b) => a + Number(b.cgpa || 0), 0) / list.length).toFixed(2) : '—', c: 'from-violet-500 to-purple-600' },
        ].map(s => (
          <div key={s.l} className={`rounded-2xl p-5 text-white bg-gradient-to-br ${s.c} relative overflow-hidden elev-2`}>
            <div className="absolute inset-0 bg-grid opacity-15" />
            <div className="relative">
              <div className="text-[10.5px] uppercase tracking-widest font-bold opacity-85">{s.l}</div>
              <div className="heading-display text-3xl mt-2">{s.v}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="surface-solid rounded-2xl p-4 mb-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, email, student ID…" className="!pl-9 w-full" />
        </div>
        <select value={program} onChange={e => setProgram(e.target.value)} className="md:w-56">
          <option value="all">All programs</option>
          {programs.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {loading ? <Loader /> : (
        <div className="surface-solid rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="text-left px-5 py-3.5">Student</th>
                  <th className="text-left px-5 py-3.5">Program</th>
                  <th className="text-left px-5 py-3.5">Semester</th>
                  <th className="text-left px-5 py-3.5">Contact</th>
                  <th className="text-left px-5 py-3.5">CGPA</th>
                  <th className="text-left px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800/60 hover:bg-cyan-50/40 dark:hover:bg-cyan-500/5 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-md">
                          {s.full_name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div className="font-bold">{s.full_name}</div>
                          <div className="text-[11px] text-slate-500 mono">{s.student_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{s.program}</td>
                    <td className="px-5 py-3"><span className="chip bg-blue-500/10 text-blue-600 border border-blue-500/20">Sem {s.semester}</span></td>
                    <td className="px-5 py-3">
                      <div className="text-[11.5px] text-slate-500 flex items-center gap-1"><Mail size={10} />{s.email}</div>
                      <div className="text-[11.5px] text-slate-500 flex items-center gap-1 mt-0.5"><Phone size={10} />{s.phone}</div>
                    </td>
                    <td className="px-5 py-3 font-bold text-cyan-600">{s.cgpa?.toFixed(2)}</td>
                    <td className="px-5 py-3"><span className={`chip ${s.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex justify-between">
            <span>{filtered.length} of {list.length} students</span>
            <span>Updated {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* Add student modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-solid rounded-2xl max-w-lg w-full p-6 elev-4 border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="font-bold text-lg flex items-center gap-2"><Users size={18} className="text-cyan-500" /> Add Student</div>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X size={18} /></button>
            </div>
            {formErr && <div className="mb-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">{formErr}</div>}
            <form onSubmit={submitAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className="w-full" placeholder="Student ID e.g. STU-2026-0042 *" value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} required />
                <input className="w-full" placeholder="Full name *" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="w-full" type="email" placeholder="Email *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                <input className="w-full" placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input className="w-full" placeholder="Program e.g. B.Tech CSE *" value={form.program} onChange={e => setForm({ ...form, program: e.target.value })} required />
                <input className="w-full" type="number" min={1} max={12} placeholder="Sem" value={form.semester} onChange={e => setForm({ ...form, semester: Number(e.target.value) })} />
                <input className="w-full" type="number" min={0} max={10} step={0.01} placeholder="CGPA" value={form.cgpa} onChange={e => setForm({ ...form, cgpa: Number(e.target.value) })} />
              </div>
              <select className="w-full" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="alumni">alumni</option>
                <option value="suspended">suspended</option>
              </select>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
