'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, CreditCard, ExternalLink, LoaderCircle, RefreshCw, Smartphone, XCircle } from 'lucide-react';
import { useLanguage } from './language-provider';
import type { PublicPayment } from '@/lib/payments';

const POLL_MS = 4000;

/** The shopper's payment page: sends them to ZainCash, or shows the FIB QR code, then waits for the result. */
export function PayView({ initial }: { initial: PublicPayment }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, arText: string) => ar ? arText : en;
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const redirected = useRef(false);
  const money = (n: number) => `${n.toLocaleString('en-US')} ${tt('IQD', 'د.ع')}`;

  // ZainCash: go straight to the provider's page the first time the shopper lands here.
  useEffect(() => {
    if (p.status === 'pending' && p.provider !== 'fib' && p.redirectUrl && !redirected.current && !sessionStorage.getItem(`pay-${p.token}`)) {
      redirected.current = true;
      try { sessionStorage.setItem(`pay-${p.token}`, '1'); } catch { /* ignore */ }
      window.location.assign(p.redirectUrl);
    }
  }, [p]);
  // While the payment is open, keep asking for its status.
  useEffect(() => {
    if (p.status !== 'pending') return;
    const timer = window.setInterval(async () => {
      if (document.hidden) return;
      try { const r = await fetch(`/api/payments/${p.token}`, { cache: 'no-store' }); if (r.ok) setP(await r.json()); } catch { /* offline: try again */ }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [p.status, p.token]);

  async function retry() {
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/payments/${p.token}`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      window.location.assign(data.redirectUrl || data.url);
    } catch (e) { setError(e instanceof Error && e.message ? e.message : tt('Could not start the payment. Try again.', 'تعذر بدء الدفع. حاول مرة ثانية.')); setBusy(false); }
  }

  const provider = p.provider === 'fib' ? 'FIB' : p.provider === 'alqaseh' ? tt('card', 'البطاقة') : tt('ZainCash', 'زين كاش');
  return <main className="pay-page">
    <section className="pay-card">
      {p.test && <span className="pay-test">{tt('Test mode — no real money', 'وضع تجريبي — بدون فلوس حقيقية')}</span>}
      <p className="pay-ref">{tt('Order', 'طلب رقم')} <strong dir="ltr">{p.reference}</strong></p>
      <p className="pay-amount">{money(p.amount)}</p>

      {p.status === 'paid' && <div className="pay-state ok"><CheckCircle2 size={54} strokeWidth={1.3} /><h1>{tt('Payment received, thank you!', 'تم الدفع، شكراً لك!')}</h1><p>{tt('Your order is confirmed and paid. We will call you before delivery.', 'طلبك مؤكد ومدفوع. راح نتصل بيك قبل التوصيل.')}</p><Link className="pay-btn" href="/">{tt('Back to the store', 'رجوع للمتجر')}</Link></div>}

      {p.status === 'pending' && p.provider !== 'fib' && <div className="pay-state"><LoaderCircle size={44} className="spin" strokeWidth={1.4} /><h1>{p.provider === 'alqaseh' ? tt('Waiting for your card payment…', 'بانتظار الدفع بالبطاقة…') : tt('Waiting for ZainCash…', 'بانتظار زين كاش…')}</h1><p>{p.provider === 'alqaseh' ? tt('Complete the payment on the secure card page. This page updates by itself.', 'كمّل الدفع بصفحة البطاقة الآمنة. هاي الصفحة تتحدث وحدها.') : tt('Complete the payment on the ZainCash page. This page updates by itself.', 'كمّل الدفع بصفحة زين كاش. هاي الصفحة تتحدث وحدها.')}</p>{p.redirectUrl && <a className="pay-btn" href={p.redirectUrl}><CreditCard size={18} /> {p.provider === 'alqaseh' ? tt('Pay by card', 'ادفع بالبطاقة') : tt('Pay with ZainCash', 'ادفع بزين كاش')}</a>}</div>}

      {p.status === 'pending' && p.provider === 'fib' && p.fib && <div className="pay-state">
        <h1>{tt('Pay with FIB', 'ادفع عبر FIB')}</h1>
        <p>{tt('Scan the code with the FIB app, or open the app directly on this phone.', 'امسح الكود بتطبيق FIB، أو افتح التطبيق مباشرة من هذا الموبايل.')}</p>
        {p.fib.qrCode && /^data:image\/png;base64,/.test(p.fib.qrCode) && <img className="pay-qr" src={p.fib.qrCode} alt={tt('FIB payment QR code', 'كود الدفع FIB')} width={220} height={220} />}
        {p.fib.readableCode && <p className="pay-code">{tt('Code', 'الرمز')}: <strong dir="ltr">{p.fib.readableCode}</strong></p>}
        <div className="pay-apps">
          {p.fib.personalAppLink && <a className="pay-btn" href={p.fib.personalAppLink}><Smartphone size={18} /> {tt('Open FIB app', 'افتح تطبيق FIB')}</a>}
          {p.fib.businessAppLink && <a className="pay-btn ghost" href={p.fib.businessAppLink}><ExternalLink size={16} /> {tt('FIB Business', 'FIB للأعمال')}</a>}
        </div>
        <p className="pay-wait"><Clock size={15} /> {tt('Waiting for payment… this page updates by itself.', 'بانتظار الدفع… الصفحة تتحدث وحدها.')}</p>
      </div>}

      {['failed', 'expired', 'cancelled'].includes(p.status) && <div className="pay-state bad"><XCircle size={50} strokeWidth={1.3} /><h1>{p.status === 'expired' ? tt('The payment expired', 'انتهت مهلة الدفع') : p.status === 'cancelled' ? tt('The payment was cancelled', 'انلغى الدفع') : tt('The payment did not go through', 'ما تم الدفع')}</h1><p>{tt('Your order is saved. Try again, or pay cash on delivery — we will call you to confirm.', 'طلبك محفوظ. جرّب مرة ثانية، أو ادفع كاش عند الاستلام — راح نتصل بيك للتأكيد.')}</p><button type="button" className="pay-btn" disabled={busy} onClick={retry}>{busy ? <LoaderCircle size={17} className="spin" /> : <RefreshCw size={17} />} {tt(`Try again with ${provider}`, `أعد المحاولة عبر ${provider}`)}</button>{error && <p className="pay-error">{error}</p>}</div>}

      {p.status === 'refunded' && <div className="pay-state"><RefreshCw size={44} strokeWidth={1.3} /><h1>{tt('This payment was refunded', 'تم إرجاع المبلغ')}</h1></div>}
    </section>
  </main>;
}
