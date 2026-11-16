import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { can } from '../../lib/rbac';
import { Briefcase, Plus, Download, Mail, Phone, GraduationCap, X } from 'lucide-react';

export default function Faculty() {
  const { user } = useSession();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', department: '', designation: '', qualification: '' });

  const canManage = user ? can(user.role, 'faculty', 'create') : false;

  const load = async () => { try { setList(await api('/api/faculty')); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const onExport = () => {
    const header = ['full_name', 'email', 'phone', 'department', 'designation', 'qualification', 'rating'];
    const rows = list.map((f: any) => header.map(k => `"${String(f[k] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Graphic_Era_Faculty_Export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    if (!form.full_name.trim() || !form.email.trim() || !form.department.trim()) {
      setFormErr('Full name, email and department are required.');
      return;
    }
    setSaving(true);
    try {
      await api('/api/faculty', { method: 'POST', body: JSON.stringify(form) });
      setShowAdd(false);
      setForm({ full_name: '', email: '', phone: '', department: '', designation: '', qualification: '' });
      await load();
    } catch (e: any) {
      setFormErr(e?.message || 'Failed to add faculty.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Faculty & HR" subtitle="Teaching staff, contracts, and assignments" icon={<Briefcase size={20} />}
        actions={canManage ? <>
          <button onClick={onExport} className="btn-ghost inline-flex items-center gap-2"><Download size={14} /> Export</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary inline-flex items-center gap-2"><Plus size={14} /> Add faculty</button>
        </> : undefined} />

      {loading ? <Loader /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(f => (
            <div key={f.id} className="surface-solid rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center">
                  {f.full_name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{f.full_name}</div>
                  <div className="text-xs text-slate-500">{f.designation}</div>
                  <div className="chip bg-blue-500/10 text-blue-600 mt-1">{f.department}</div>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <div className="flex items-center gap-1.5"><Mail size={11} />{f.email}</div>
                <div className="flex items-center gap-1.5"><Phone size={11} />{f.phone}</div>
                <div className="flex items-center gap-1.5"><GraduationCap size={11} />{f.qualification}</div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
                <div><div className="text-[10px] text-slate-500 uppercase tracking-wider">Courses</div><div className="font-bold">{f.courses_count || 3}</div></div>
                <div><div className="text-[10px] text-slate-500 uppercase tracking-wider">Students</div><div className="font-bold">{f.students_count || 120}</div></div>
                <div><div className="text-[10px] text-slate-500 uppercase tracking-wider">Rating</div><div className="font-bold text-amber-500">{f.rating?.toFixed(1) || '4.7'}</div></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add faculty modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-solid rounded-2xl max-w-lg w-full p-6 elev-4 border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="font-bold text-lg flex items-center gap-2"><Briefcase size={18} className="text-blue-500" /> Add Faculty</div>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X size={18} /></button>
            </div>
            {formErr && <div className="mb-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">{formErr}</div>}
            <form onSubmit={submitAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className="w-full" placeholder="Full name *" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
                <input className="w-full" type="email" placeholder="Email *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="w-full" placeholder="Department *" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required />
                <input className="w-full" placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="w-full" placeholder="Designation" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} />
                <input className="w-full" placeholder="Qualification" value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add faculty'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
