'use client';
import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, Copy, CreditCard, LoaderCircle, PlugZap, RefreshCw, Save, ShieldCheck, Wallet } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { PaymentSettings } from '@/lib/payments/config';
import { api, useFlash } from './ui';
import { Card, PageHero } from './dash-ui';

export type PaymentListRow = { id: number; orderId: number; reference: string; provider: string; mode: string; status: string; amount: number; error: string | null; createdAt: string; paidAt: string | null };

const STATUS: Record<string, { ar: string; en: string; tone: string }> = {
  pending: { ar: 'بانتظار الدفع', en: 'Pending', tone: 'warning' },
  paid: { ar: 'مدفوع', en: 'Paid', tone: 'success' },
  failed: { ar: 'فشل', en: 'Failed', tone: 'danger' },
  expired: { ar: 'انتهت المهلة', en: 'Expired', tone: '' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', tone: '' },
  refunded: { ar: 'مسترجع', en: 'Refunded', tone: '' },
};

export function PaymentsManager({ initial, rows: initialRows, siteUrl, canManage }: { initial: PaymentSettings; rows: PaymentListRow[]; siteUrl: string; canManage: boolean }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, arText: string) => ar ? arText : en;
  const { flash, success, fail } = useFlash();
  const [s, setS] = useState<PaymentSettings>(initial);
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState<string | null>(null);
  const disabled = !canManage;
  const setZ = (patch: Partial<PaymentSettings['zaincash']>) => setS(c => ({ ...c, zaincash: { ...c.zaincash, ...patch } }));
  const setF = (patch: Partial<PaymentSettings['fib']>) => setS(c => ({ ...c, fib: { ...c.fib, ...patch } }));
  const setQ = (patch: Partial<PaymentSettings['alqaseh']>) => setS(c => ({ ...c, alqaseh: { ...c.alqaseh, ...patch } }));

  async function run(label: string, job: () => Promise<void>) { setBusy(label); try { await job(); } catch (e) { fail(e); } finally { setBusy(null); } }
  async function save(quiet = false) {
    const data = await api<{ settings: PaymentSettings }>('/api/admin/payments', { method: 'PUT', json: s });
    setS(data.settings);
    if (!quiet) success(tt('Saved.', 'تم الحفظ.'));
  }
  const testConn = () => run('test', async () => {
    await save(true);
    const r = await api<{ ok: boolean; host: string }>('/api/admin/payments', { method: 'POST', json: { provider: s.provider } });
    success(tt(`Connected to ${r.host}. The keys work.`, `تم الاتصال بـ ${r.host}. المفاتيح شغالة.`));
  });
  const sync = (row: PaymentListRow) => run(`sync-${row.id}`, async () => {
    const r = await api<{ status: string }>(`/api/admin/payments/${row.id}`, { method: 'POST' });
    setRows(list => list.map(x => x.id === row.id ? { ...x, status: r.status } : x));
    success(tt(`Status: ${STATUS[r.status]?.en ?? r.status}`, `الحالة: ${STATUS[r.status]?.ar ?? r.status}`));
  });
  const copy = (text: string) => { void navigator.clipboard?.writeText(text).then(() => success(tt('Copied.', 'انسخ.'))); };

  const base = siteUrl.replace(/\/+$/, '');
  const webhook = `${base}/api/payments/zaincash/webhook`;
  const fibCallback = `${base}/api/payments/fib/callback`;
  const qsWebhook = `${base}/api/payments/alqaseh/webhook`;
  const secret = (value: string, onChange: (v: string) => void, placeholder: string) => <input type="password" autoComplete="new-password" dir="ltr" disabled={disabled} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
  const text = (value: string, onChange: (v: string) => void, placeholder = '') => <input type="text" dir="ltr" disabled={disabled} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
  const paidTotal = rows.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);
  const fmt = (n: number) => `${n.toLocaleString('en-US')} ${tt('IQD', 'د.ع')}`;

  return <main className="admin-page dash">
    <PageHero eyebrow={tt('Configuration', 'الإعدادات')} title={tt('Electronic payments', 'الدفع الإلكتروني')}
      description={tt('Let customers pay online by card (Al Qaseh), ZainCash or FIB at checkout. Orders are marked paid automatically and you get a Telegram alert.', 'خلي الزبون يدفع أونلاين بالبطاقة (القاصة) أو زين كاش أو FIB من صفحة إتمام الطلب. الطلب ينعلّم مدفوع تلقائياً ويوصلك إشعار على تيليكرام.')}
      actions={canManage ? <div className="dash-quick"><button type="button" className="dash-btn" disabled={busy !== null} onClick={testConn}>{busy === 'test' ? <LoaderCircle size={15} className="spin" /> : <PlugZap size={15} />} {tt('Test connection', 'اختبار الاتصال')}</button><button type="button" className="dash-btn primary" disabled={busy !== null} onClick={() => void run('save', () => save())}>{busy === 'save' ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />} {tt('Save', 'حفظ')}</button></div> : null} />
    {flash}

    <div className="dash-grid two">
      <Card icon={<CreditCard size={17} />} title={<>{tt('Gateway', 'البوابة')} <span className={`dash-chip ${s.enabled ? 'success' : ''}`}>{s.enabled ? tt('On', 'مفعّلة') : tt('Off', 'متوقفة')}</span>{s.mode === 'test' && <span className="dash-chip warning">{tt('Test mode', 'وضع تجريبي')}</span>}</>}
        action={<label className="int-switch"><input type="checkbox" disabled={disabled} checked={s.enabled} onChange={e => setS(c => ({ ...c, enabled: e.target.checked }))} /><span /></label>}>
        <p className="int-lead">{tt('When on, the “Electronic payment” option at checkout sends the customer to the gateway. When off, it works as before: you send a payment link yourself.', 'لما تكون مفعّلة، خيار "الدفع الإلكتروني" بصفحة الطلب يودّي الزبون للبوابة مباشرة. لما تكون متوقفة يبقى مثل قبل: انت تبعثله رابط دفع.')}</p>
        <div className="admin-form-grid">
          <label className="admin-field"><span>{tt('Provider', 'مزوّد الدفع')}</span><select disabled={disabled} value={s.provider} onChange={e => setS(c => ({ ...c, provider: e.target.value === 'fib' || e.target.value === 'alqaseh' ? e.target.value : 'zaincash' }))}><option value="alqaseh">{tt('Al Qaseh – Visa / Mastercard cards', 'القاصة – بطاقات فيزا وماستر')}</option><option value="zaincash">{tt('ZainCash', 'زين كاش')}</option><option value="fib">{tt('FIB – First Iraqi Bank', 'FIB – المصرف العراقي الأول')}</option></select></label>
          <label className="admin-field"><span>{tt('Mode', 'الوضع')}</span><select disabled={disabled} value={s.mode} onChange={e => setS(c => ({ ...c, mode: e.target.value === 'live' ? 'live' : 'test' }))}><option value="test">{tt('Test (sandbox, no real money)', 'تجريبي (بدون فلوس حقيقية)')}</option><option value="live">{tt('Live (real payments)', 'حقيقي (دفع فعلي)')}</option></select></label>
        </div>
        <p className="admin-hint">{s.mode === 'test' ? tt('Test mode uses the provider’s sandbox. Turn on the gateway in test mode, place a test order, and check it works before switching to live.', 'الوضع التجريبي يستخدم سيرفر التجربة مال المزوّد. شغّل البوابة بالوضع التجريبي، سوّي طلب تجربة، وتأكد كلشي يشتغل قبل لا تحوّل للحقيقي.') : tt('Live mode charges real money. Use the live keys and the live server address the provider gave you.', 'الوضع الحقيقي يسحب فلوس فعلية. استخدم المفاتيح الحقيقية ورابط السيرفر الحقيقي اللي انطاك ياه المزوّد.')}</p>
      </Card>

      {s.provider === 'alqaseh' ? <Card icon={<Wallet size={17} />} title={tt('Al Qaseh keys', 'مفاتيح القاصة')}>
        <ol className="int-steps">
          <li><i>1</i><span>{tt('Al Qaseh gives you a Client ID and Client Secret (UAT for testing, then production) plus the live API and payment page addresses.', 'القاصة تنطيك Client ID و Client Secret (UAT للتجربة وبعدين الحقيقي)، ويا رابط الـ API ورابط صفحة الدفع الحقيقيين.')}</span></li>
          <li><i>2</i><span>{tt('Test mode works even before you get keys: it uses Al Qaseh’s public sandbox. Put your own UAT keys here when you have them.', 'الوضع التجريبي يشتغل حتى قبل لا تستلم المفاتيح: يستخدم حساب التجربة العام مال القاصة. من تستلم مفاتيح UAT مالتك حطها هنا.')}</span></li>
          <li><i>3</i><span>{tt('Payment updates arrive at (give it to Al Qaseh if they ask for a webhook):', 'تحديثات الدفع توصل على (انطيه للقاصة إذا طلبوا Webhook):')} <button type="button" className="int-copy" onClick={() => copy(qsWebhook)} dir="ltr"><Copy size={12} /> {qsWebhook}</button></span></li>
        </ol>
        <div className="admin-form-grid">
          <label className="admin-field"><span>Client ID</span>{text(s.alqaseh.clientId, v => setQ({ clientId: v }), s.mode === 'test' ? 'public_test' : '')}</label>
          <label className="admin-field"><span>Client Secret</span>{secret(s.alqaseh.clientSecret, v => setQ({ clientSecret: v }), '••••')}</label>
          <label className="admin-field"><span>{tt('Live API address', 'رابط الـ API الحقيقي')}</span>{text(s.alqaseh.liveBaseUrl, v => setQ({ liveBaseUrl: v }), 'https://api.alqaseh.com/v1')}</label>
          <label className="admin-field"><span>{tt('Live payment page address', 'رابط صفحة الدفع الحقيقي')}</span>{text(s.alqaseh.livePayUrl, v => setQ({ livePayUrl: v }), 'https://pay.alqaseh.com/pay')}<small>{tt('Test mode uses api-test.alqaseh.com and pay-test.alqaseh.com automatically.', 'الوضع التجريبي يستخدم api-test.alqaseh.com و pay-test.alqaseh.com تلقائياً.')}</small></label>
        </div>
      </Card> : s.provider === 'zaincash' ? <Card icon={<Wallet size={17} />} title={tt('ZainCash keys', 'مفاتيح زين كاش')}>
        <ol className="int-steps">
          <li><i>1</i><span>{tt('Apply for a merchant account with ZainCash (business team).', 'قدّم على حساب تاجر (Merchant) من فريق الأعمال بزين كاش.')}</span></li>
          <li><i>2</i><span>{tt('They give you: Client ID, Client Secret, API Key and Service Type — first for testing, then for live.', 'ينطوك: Client ID و Client Secret و API Key و Service Type — أول شي للتجربة وبعدين للحقيقي.')}</span></li>
          <li><i>3</i><span>{tt('Send them this webhook address to register:', 'ابعثلهم هذا الرابط حتى يسجلوه كـ Webhook:')} <button type="button" className="int-copy" onClick={() => copy(webhook)} dir="ltr"><Copy size={12} /> {webhook}</button></span></li>
        </ol>
        <div className="admin-form-grid">
          <label className="admin-field"><span>Client ID</span>{text(s.zaincash.clientId, v => setZ({ clientId: v }))}</label>
          <label className="admin-field"><span>Client Secret</span>{secret(s.zaincash.clientSecret, v => setZ({ clientSecret: v }), '••••')}</label>
          <label className="admin-field"><span>API Key</span>{secret(s.zaincash.apiKey, v => setZ({ apiKey: v }), '••••')}<small>{tt('Used to verify the signed result ZainCash sends back.', 'يستخدم للتحقق من نتيجة الدفع الموقّعة اللي ترجعها زين كاش.')}</small></label>
          <label className="admin-field"><span>Service Type</span>{text(s.zaincash.serviceType, v => setZ({ serviceType: v }))}</label>
          <label className="admin-field"><span>{tt('Live server address', 'رابط السيرفر الحقيقي')}</span>{text(s.zaincash.liveBaseUrl, v => setZ({ liveBaseUrl: v }), 'https://…')}<small>{tt('Given by ZainCash for live. Test mode uses pg-api-uat.zaincash.iq automatically.', 'تنطيك ياه زين كاش للحقيقي. الوضع التجريبي يستخدم pg-api-uat.zaincash.iq تلقائياً.')}</small></label>
        </div>
      </Card> : <Card icon={<Wallet size={17} />} title={tt('FIB keys', 'مفاتيح FIB')}>
        <ol className="int-steps">
          <li><i>1</i><span>{tt('Submit the online-shop integration request at fib.iq/developers.', 'قدّم طلب ربط المتجر الإلكتروني من fib.iq/developers.')}</span></li>
          <li><i>2</i><span>{tt('FIB gives you a Client ID and Client Secret (stage first, then production with the live address).', 'ينطوك Client ID و Client Secret (للتجربة أول، وبعدين للحقيقي ويا رابط السيرفر الحقيقي).')}</span></li>
          <li><i>3</i><span>{tt('Payment updates arrive at:', 'تحديثات الدفع توصل على:')} <button type="button" className="int-copy" onClick={() => copy(fibCallback)} dir="ltr"><Copy size={12} /> {fibCallback}</button></span></li>
        </ol>
        <div className="admin-form-grid">
          <label className="admin-field"><span>Client ID</span>{text(s.fib.clientId, v => setF({ clientId: v }))}</label>
          <label className="admin-field"><span>Client Secret</span>{secret(s.fib.clientSecret, v => setF({ clientSecret: v }), '••••')}</label>
          <label className="admin-field"><span>{tt('Live server address', 'رابط السيرفر الحقيقي')}</span>{text(s.fib.liveBaseUrl, v => setF({ liveBaseUrl: v }), 'https://…')}<small>{tt('Test mode uses fib.stage.fib.iq automatically.', 'الوضع التجريبي يستخدم fib.stage.fib.iq تلقائياً.')}</small></label>
        </div>
      </Card>}
    </div>

    <Card icon={<ShieldCheck size={17} />} title={tt('How it works', 'شلون يشتغل')}>
      <ol className="int-steps">
        <li><i>1</i><span>{tt('The customer picks “Electronic payment” and confirms the order. The order is saved first, so nothing is lost if payment fails.', 'الزبون يختار "الدفع الإلكتروني" ويأكد الطلب. الطلب ينحفظ أول شي، فإذا فشل الدفع ما يضيع.')}</span></li>
        <li><i>2</i><span>{s.provider === 'alqaseh' ? tt('They are sent to Al Qaseh’s secure page to enter their Visa / Mastercard, then come back to a confirmation page. Card details never pass through your site.', 'يتحوّل لصفحة القاصة الآمنة يدخل بيها بطاقة فيزا أو ماستر، ويرجع لصفحة تأكيد. معلومات البطاقة ما تمر على موقعك أبداً.') : s.provider === 'fib' ? tt('A payment page shows a QR code and buttons to open the FIB app.', 'تطلعله صفحة دفع بيها QR وأزرار تفتح تطبيق FIB.') : tt('They are sent to ZainCash to pay, then come back to a confirmation page.', 'يتحوّل لصفحة زين كاش يدفع، ويرجع لصفحة تأكيد.')}</span></li>
        <li><i>3</i><span>{tt('The result is checked with the provider (never trusted from the browser). Paid orders show “Paid” and you get a Telegram alert.', 'النتيجة تنفحص ويا المزوّد نفسه (ما نعتمد على المتصفح). الطلب المدفوع يطلع "مدفوع" ويوصلك إشعار تيليكرام.')}</span></li>
        <li><i>4</i><span>{tt('If payment fails or expires, the customer can try again from the same page, or you can collect cash on delivery.', 'إذا فشل الدفع أو انتهت مهلته، الزبون يكدر يعيد من نفس الصفحة، أو تستلم كاش عند التوصيل.')}</span></li>
      </ol>
    </Card>

    <Card icon={<CheckCircle2 size={17} />} title={<>{tt('Recent payments', 'آخر عمليات الدفع')} <span className="dash-chip success">{tt('Paid', 'المدفوع')}: {fmt(paidTotal)}</span></>}>
      {rows.length === 0 ? <p className="admin-hint">{tt('No electronic payments yet.', 'ماكو عمليات دفع إلكتروني بعد.')}</p> :
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{tt('Order', 'الطلب')}</th><th>{tt('Provider', 'المزوّد')}</th><th>{tt('Amount', 'المبلغ')}</th><th>{tt('Status', 'الحالة')}</th><th>{tt('Date', 'التاريخ')}</th><th /></tr></thead><tbody>
          {rows.map(r => <tr key={r.id}>
            <td><Link className="admin-link" href={`/admin/orders/${r.orderId}`}>{r.reference}</Link>{r.mode === 'test' && <small> · {tt('test', 'تجريبي')}</small>}</td>
            <td>{r.provider === 'fib' ? 'FIB' : r.provider === 'alqaseh' ? tt('Al Qaseh', 'القاصة') : tt('ZainCash', 'زين كاش')}</td>
            <td className="num">{fmt(r.amount)}</td>
            <td><span className={`dash-chip ${STATUS[r.status]?.tone ?? ''}`}>{ar ? STATUS[r.status]?.ar ?? r.status : STATUS[r.status]?.en ?? r.status}</span>{r.error && <small className="admin-hint" title={r.error}> {r.error.slice(0, 60)}</small>}</td>
            <td><small>{new Date(r.createdAt).toLocaleString(ar ? 'ar-IQ' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })}</small></td>
            <td className="num">{r.status === 'pending' && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy !== null} onClick={() => sync(r)}>{busy === `sync-${r.id}` ? <LoaderCircle size={13} className="spin" /> : <RefreshCw size={13} />} {tt('Check', 'تحديث')}</button>}</td>
          </tr>)}
        </tbody></table></div>}
    </Card>
  </main>;
}
