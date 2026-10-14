'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';

const AR_ERRORS: Record<string, string> = {
  'Too many attempts. Please wait a few minutes and try again.': 'محاولات كثيرة. انتظر دقائق وحاول مرة ثانية.',
  'The username or password is incorrect.': 'اسم المستخدم أو كلمة السر غير صحيحة.',
};

/** Admin sign-in, Apple ID style: one calm card, grouped fields, arrow button inside the field. */
export function LoginForm({ hint }: { hint: string | null }) {
  const [mode, setMode] = useState<'owner' | 'team'>('owner');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [done, setDone] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => { (mode === 'team' ? userRef : passRef).current?.focus(); }, [mode]);

  const ready = password.length > 0 && (mode === 'owner' || username.trim().length > 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: mode === 'team' ? username : '', password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '');
      setDone(true);
      router.replace('/admin'); router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(AR_ERRORS[message] || message || 'تعذر تسجيل الدخول. حاول مرة ثانية.');
      setShake(s => s + 1); setPassword(''); setBusy(false);
      passRef.current?.focus();
    }
  }

  function switchMode(next: 'owner' | 'team') { if (next === mode) return; setMode(next); setError(''); setPassword(''); }

  return <main className="al-page" dir="rtl">
    <div className="al-glow" aria-hidden="true" />
    <form className={`al-card${done ? ' is-done' : ''}`} onSubmit={submit} noValidate>
      <div className="al-icon"><img src="/images/UR-logo.svg" alt="" width="46" height="28" /></div>
      <h1>تسجيل الدخول</h1>
      <p className="al-sub">لوحة إدارة متجر أور للجلود</p>

      <div className="al-seg" role="tablist" aria-label="نوع الحساب">
        <span className="al-seg-thumb" style={{ transform: mode === 'owner' ? 'translateX(0)' : 'translateX(-100%)' }} aria-hidden="true" />
        <button type="button" role="tab" aria-selected={mode === 'owner'} onClick={() => switchMode('owner')}>المالك</button>
        <button type="button" role="tab" aria-selected={mode === 'team'} onClick={() => switchMode('team')}>فريق العمل</button>
      </div>

      <div key={shake} className={`al-fields${shake ? ' al-shake' : ''}${error ? ' has-error' : ''}`}>
        {mode === 'team' && <div className="al-field">
          <input ref={userRef} id="al-user" type="text" dir="auto" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder=" " value={username} onChange={e => setUsername(e.target.value)} />
          <label htmlFor="al-user">اسم المستخدم</label>
        </div>}
        <div className="al-field al-field-pass">
          <input ref={passRef} id="al-pass" type={show ? 'text' : 'password'} dir="ltr" autoComplete="current-password" placeholder=" " value={password} onChange={e => { setPassword(e.target.value); if (error) setError(''); }} />
          <label htmlFor="al-pass">كلمة السر</label>
          <button type="button" className="al-eye" onClick={() => setShow(s => !s)} aria-label={show ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'} tabIndex={-1}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          <button type="submit" className="al-go" disabled={!ready || busy} aria-label="دخول">{busy ? <span className="al-spin" /> : <ArrowLeft size={17} strokeWidth={2.4} />}</button>
        </div>
      </div>
      <p className="al-error" role="alert" aria-live="polite">{error}</p>

      {mode === 'owner' && hint && <p className="al-hint">بيئة تجريبية: كلمة السر الافتراضية <code dir="ltr">{hint}</code>. غيّرها بإضافة <code dir="ltr">ADMIN_PASSWORD</code> في إعدادات الاستضافة.</p>}

      <p className="al-foot"><Lock size={12} /> اتصال آمن ومشفّر</p>
    </form>
    <footer className="al-copy">© {new Date().getFullYear()} أور للجلود</footer>
  </main>;
}
