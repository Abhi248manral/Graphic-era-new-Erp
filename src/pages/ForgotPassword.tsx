import { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicNav from '../components/PublicNav';
import { Mail, KeyRound, CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

export default function ForgotPassword() {
  const [step, setStep] = useState<'email' | 'otp' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [code] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());
  const [input, setInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const sendCode = async () => {
    setErr('');
    const em = email.trim().toLowerCase();
    if (!em) { setErr('Email is required.'); return; }
    setBusy(true);
    try {
      const account = await api<any>(`/api/accounts?email=${encodeURIComponent(em)}`);
      if (!account || !account.id) {
        setErr('No account matches that email.');
        return;
      }
      setAccountId(account.id);
      setStep('otp');
    } catch (e: any) {
      setErr('No account matches that email.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setErr('');
    if (input !== code) { setErr('The code you entered does not match.'); return; }
    if (newPassword.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (!accountId) { setErr('Session expired. Please start again.'); setStep('email'); return; }
    setBusy(true);
    try {
      await api('/api/accounts', {
        method: 'PUT',
        body: JSON.stringify({ id: accountId, password: newPassword }),
      });
      setStep('done');
    } catch (e: any) {
      setErr(e?.message || 'Could not reset your password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f8fc] dark:bg-[#050811]">
      <PublicNav />
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-6">
        <div className="absolute inset-0 mesh-bg" />
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="w-full max-w-md surface-solid rounded-3xl p-8 elev-3 fade-up relative">
          {step === 'email' && <>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center mb-5 shadow-lg"><Mail size={22} /></div>
            <h1 className="heading-display text-3xl text-slate-900 dark:text-white">Reset your password.</h1>
            <p className="text-sm text-slate-500 mt-1.5">We'll email you a one-time code.</p>
            <label className="block mt-6"><span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Email</span>
              <div className="relative mt-1.5"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={email} onChange={e => setEmail(e.target.value)} className="!pl-9 w-full" type="email" required /></div>
            </label>
            {err && <div className="mt-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 rounded-lg border border-rose-200 dark:border-rose-500/20 flex items-start gap-2"><AlertTriangle size={13} className="shrink-0 mt-0.5" /><span>{err}</span></div>}
            <button onClick={sendCode} disabled={busy} className="btn-primary w-full mt-5">{busy ? 'Checking…' : 'Send code'}</button>
            <Link to="/login" className="text-xs text-slate-500 mt-5 inline-block hover:text-cyan-600 font-semibold">← Back to sign in</Link>
          </>}
          {step === 'otp' && <>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center mb-5 shadow-lg"><KeyRound size={22} /></div>
            <h1 className="heading-display text-3xl text-slate-900 dark:text-white">Enter code.</h1>
            <p className="text-sm text-slate-500 mt-1.5">We sent a code to <b className="text-slate-700 dark:text-slate-300">{email}</b>.</p>
            <div className="mt-4 p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-[12.5px] flex items-center gap-2">
              <Sparkles size={13} /> Demo code: <span className="mono font-bold">{code}</span>
            </div>
            <input className="mt-5 w-full text-center text-xl font-black tracking-[0.4em]" maxLength={6} value={input} onChange={e => setInput(e.target.value.replace(/\D/g, ''))} placeholder="······" aria-label="6-digit code" />
            <input className="mt-3 w-full" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 8 characters)" minLength={8} aria-label="New password" />
            {err && <div className="mt-3 text-xs text-rose-600 flex items-start gap-2"><AlertTriangle size={13} className="shrink-0 mt-0.5" /><span>{err}</span></div>}
            <button onClick={resetPassword} disabled={busy} className="btn-primary w-full mt-4">{busy ? 'Resetting…' : 'Verify & set new password'}</button>
            <button onClick={() => { setStep('email'); setInput(''); setNewPassword(''); setErr(''); }} className="text-xs text-slate-500 mt-5 hover:text-cyan-600 font-semibold">← Back</button>
          </>}
          {step === 'done' && <>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center mb-5 shadow-lg"><CheckCircle2 size={24} /></div>
            <h1 className="heading-display text-3xl text-slate-900 dark:text-white">Password reset.</h1>
            <p className="text-sm text-slate-500 mt-1.5">Your password was updated successfully.</p>
            <Link to="/login" className="btn-primary w-full mt-5 inline-flex justify-center">Back to login</Link>
          </>}
        </div>
      </div>
    </div>
  );
}
