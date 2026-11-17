'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowLeftRight, Banknote, CheckCheck, LoaderCircle, Pencil, Plus, Settings2, Trash2, Truck, Wallet } from 'lucide-react';
import { api, Modal, useFlash } from './ui';
import { groupInt } from '@/lib/number-format';
import { iraqGovernorates } from '@/lib/iraq';
import { accountNames, movementKinds, paymentMethodNames, type MoneyAccount } from '@/lib/accounts-rules';
import './accounts.css';

const n = (v: number) => groupInt(v);
const d = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' });
const today = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
const govName = (code: string) => iraqGovernorates.find(g => g.code === code)?.nameAr ?? code;

export type CourierDTO = { id: number; name: string; phone: string | null; defaultFeeIqd: number; returnFeeIqd: number; rates: Record<string, number>; active: boolean };

/** Tabs across every money page, so Accounts, expenses, profit and reports read as one section. */
export function AccountsTabs() {
  const path = usePathname();
  const tabs = [
    { href: '/admin/accounts', label: 'الأرصدة' },
    { href: '/admin/accounts/couriers', label: 'شركات التوصيل' },
    { href: '/admin/accounts/ledger', label: 'كل الحركات' },
    { href: '/admin/finance', label: 'المصاريف' },
    { href: '/admin/profit', label: 'الأرباح' },
    { href: '/admin/revenue', label: 'المبيعات' },
    { href: '/admin/reports', label: 'التقارير' },
  ];
  return <nav className="acc-tabs" aria-label="أقسام الحسابات">{tabs.map(t => <Link key={t.href} href={t.href} className={path === t.href ? 'is-on' : ''}>{t.label}</Link>)}</nav>;
}

type Overview = {
  money: { account: MoneyAccount; name: string; balance: number }[];
  couriers: { id: number; name: string; active: boolean; balance: number; pendingOrders: number; pendingNet: number; lastSettlement: string | null }[];
  review: { legacyCod: Ref[]; noCourier: Ref[]; noFee: Ref[]; waiting: (Ref & { method: string })[] };
  totalMoney: number;
  recent: Entry[];
};
type Ref = { id: number; reference: string; name: string; total: number };
export type Entry = { at: string; account: string; accountName?: string; amount: number; kind: string; label: string; orderId?: number; settlementId?: number; movementId?: number };

export function AccountsOverview({ data, couriers, settings, canManage }: { data: Overview; couriers: CourierDTO[]; settings: { qasehFeePercent: number; defaultCourierId: number | null }; canManage: boolean }) {
  const [moving, setMoving] = useState(false), [setup, setSetup] = useState(false);
  const atCouriers = data.couriers.reduce((s, c) => s + c.balance, 0);
  const reviewCount = data.review.legacyCod.length + data.review.noCourier.length + data.review.noFee.length;
  const courierNames = new Map(couriers.map(c => [c.id, c.name]));
  const accountLabel = (key: string) => key in accountNames ? accountNames[key as MoneyAccount] : courierNames.get(Number(key.split(':')[1])) ?? key;
  return <main className="admin-page">
    <AccountsTabs />
    <div className="acc-head"><div><h1>الحسابات</h1><p>وين فلوسك هسه بالضبط: الصندوق، الماستر، القاصة، وشكد عند كل شركة توصيل.</p></div>
      {canManage && <div className="acc-actions"><button className="admin-btn admin-btn-primary" onClick={() => setMoving(true)}><ArrowLeftRight size={15} /> حركة يدوية</button><button className="admin-btn admin-btn-ghost" onClick={() => setSetup(true)}><Settings2 size={15} /> إعدادات</button></div>}
    </div>
    <section className="acc-kpis">
      {data.money.map(a => <div key={a.account} className="acc-kpi"><span>{a.name}</span><strong className={a.balance < 0 ? 'acc-neg' : ''}>{n(a.balance)}</strong><small>د.ع</small></div>)}
      <div className="acc-kpi"><span>عند شركات التوصيل</span><strong className={atCouriers < 0 ? 'acc-neg' : ''}>{n(atCouriers)}</strong><small>{atCouriers < 0 ? 'إنت مطلوب لهم' : 'بعدك ما استلمتها'}</small></div>
      <div className="acc-kpi is-total"><span>مجموع الفلوس</span><strong>{n(data.totalMoney)}</strong><small>كل الحسابات مع شركات التوصيل</small></div>
    </section>
    <div className="acc-grid">
      <div>
        <section className="acc-card"><h2><Truck size={17} /> شركات التوصيل <small><Link href="/admin/accounts/couriers" className="admin-link">إدارة الشركات</Link></small></h2>
          {!data.couriers.length ? <p className="acc-muted">ما مضاف أي شركة توصيل. <Link className="admin-link" href="/admin/accounts/couriers">أضف شركتك</Link> وأجورها حتى تبدي الحسابات تنحسب.</p> :
            <div className="acc-couriers">{data.couriers.map(c => <div key={c.id} className="acc-courier">
              <header><b>{c.name}</b>{!c.active && <span className="acc-pill muted">موقوفة</span>}</header>
              <div><span className="acc-muted">{c.balance >= 0 ? 'فلوسك عدهم' : 'إنت مطلوب لهم'}</span><div className={`acc-big ${c.balance < 0 ? 'acc-neg' : ''}`}>{n(Math.abs(c.balance))} د.ع</div></div>
              <dl><dt>طلبات بانتظار الكشف</dt><dd>{c.pendingOrders}</dd><dt>صافيها</dt><dd>{n(c.pendingNet)}</dd><dt>آخر استلام</dt><dd>{c.lastSettlement ? d(c.lastSettlement) : '—'}</dd></dl>
              <Link href={`/admin/accounts/couriers?courier=${c.id}`} className="admin-btn admin-btn-primary admin-btn-sm"><Banknote size={14} /> استلام فلوس منهم</Link>
            </div>)}</div>}
        </section>
        <section className="acc-card"><h2><Wallet size={17} /> آخر الحركات <small><Link href="/admin/accounts/ledger" className="admin-link">كل الحركات</Link></small></h2>
          {!data.recent.length ? <p className="acc-muted">ماكو حركات بعد.</p> : <div className="acc-wrap"><table className="acc-table"><thead><tr><th>التاريخ</th><th>الحساب</th><th>التفاصيل</th><th className="num">المبلغ</th></tr></thead><tbody>
            {data.recent.map((e, i) => <tr key={i}><td>{d(e.at)}</td><td>{accountLabel(e.account)}</td><td>{e.orderId ? <Link className="admin-link" href={`/admin/orders/${e.orderId}`}>{e.label}</Link> : e.label}</td><td className={`num ${e.amount >= 0 ? 'acc-in' : 'acc-out'}`}>{e.amount >= 0 ? '+' : '−'}{n(Math.abs(e.amount))}</td></tr>)}
          </tbody></table></div>}
        </section>
      </div>
      <div>
        <section className="acc-card"><h2>يحتاج انتباهك {reviewCount + data.review.waiting.length > 0 && <small>{reviewCount + data.review.waiting.length}</small>}</h2>
          {reviewCount + data.review.waiting.length === 0 ? <p className="acc-muted">كلشي مضبوط.</p> : <ul className="acc-review">
            {data.review.legacyCod.length > 0 && <li className="is-danger"><b>{data.review.legacyCod.length} طلب «دفع عند الاستلام» مسجل مدفوع بدون كشف</b><p>هاي طلبات قديمة. إذا استلمت فلوسها من الشركة، سوّ لها كشف استلام بتاريخ الاستلام. وإذا بعدها عند الشركة، افتح الطلب وخلي حالة الدفع «غير مستلم».</p><RefChips list={data.review.legacyCod} /></li>}
            {data.review.noCourier.length > 0 && <li><b>{data.review.noCourier.length} طلب توصيل بدون شركة</b><p>افتح الطلب واختار شركة التوصيل حتى تنحسب الفلوس والأجور.</p><RefChips list={data.review.noCourier} /></li>}
            {data.review.noFee.length > 0 && <li><b>{data.review.noFee.length} طلب بدون أجور توصيل</b><p>اكتب أجور الشركة على الطلب، وإلا تنحسب صفر.</p><RefChips list={data.review.noFee} /></li>}
            {data.review.waiting.length > 0 && <li className="is-info"><b>{data.review.waiting.length} طلب بانتظار وصول التحويل</b><p>لما يوصلك المبلغ، افتح الطلب واضغط «وصل المبلغ».</p><RefChips list={data.review.waiting} /></li>}
          </ul>}
        </section>
        <section className="acc-card"><h2>شلون تنحسب</h2><ul className="acc-muted" style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.9 }}>
          <li>النقد بالمحل يدخل الصندوق لما يستلم الزبون.</li>
          <li>تحويل الماستر يدخل حساب الماستر لما تضغط «وصل المبلغ».</li>
          <li>الدفع الإلكتروني يدخل حساب القاصة وحده، ناقص عمولة {settings.qasehFeePercent}%.</li>
          <li>الدفع عند الاستلام يبقى عند شركة التوصيل لحد ما تسوي كشف استلام.</li>
          <li>أجور التوصيل تنخصم من رصيدك عند الشركة، حتى للطلبات المدفوعة مسبقاً.</li>
        </ul></section>
      </div>
    </div>
    {moving && <MovementModal couriers={couriers} onClose={() => setMoving(false)} />}
    {setup && <SettingsModal couriers={couriers} settings={settings} onClose={() => setSetup(false)} />}
  </main>;
}

function RefChips({ list }: { list: Ref[] }) {
  return <div className="acc-chips">{list.slice(0, 30).map(o => <Link key={o.id} href={`/admin/orders/${o.id}`}>{o.reference} · {n(o.total)}</Link>)}{list.length > 30 && <span className="acc-muted">+{list.length - 30}</span>}</div>;
}

function accountOptions(couriers: CourierDTO[], withCouriers = true) {
  return <>{(Object.keys(accountNames) as MoneyAccount[]).map(k => <option key={k} value={k}>{accountNames[k]}</option>)}{withCouriers && couriers.map(c => <option key={c.id} value={`courier:${c.id}`}>رصيد عند {c.name}</option>)}</>;
}

function MovementModal({ couriers, onClose }: { couriers: CourierDTO[]; onClose: () => void }) {
  const router = useRouter();
  const { flash, fail } = useFlash();
  const [kind, setKind] = useState('opening'), [from, setFrom] = useState('cash'), [to, setTo] = useState('cash'), [amount, setAmount] = useState(''), [date, setDate] = useState(today()), [note, setNote] = useState(''), [direction, setDirection] = useState<'in' | 'out'>('in'), [busy, setBusy] = useState(false);
  const needFrom = kind === 'transfer' || kind === 'withdrawal' || (kind === 'adjustment' && direction === 'out');
  const needTo = kind === 'transfer' || kind === 'opening' || kind === 'deposit' || (kind === 'adjustment' && direction === 'in');
  async function save() {
    setBusy(true);
    try { await api('/api/admin/accounts/movements', { method: 'POST', json: { kind, fromAccount: needFrom ? from : null, toAccount: needTo ? to : null, amountIqd: Number(amount), movedAt: date, note } }); onClose(); router.refresh(); }
    catch (e) { fail(e); setBusy(false); }
  }
  const hint: Record<string, string> = { opening: 'شكد جان بالحساب يوم بديت تستخدم الحسابات. تكتبه مرة وحدة لكل حساب.', transfer: 'مثلاً سحبت من القاصة للماستر، أو حطيت نقد من الصندوق بالماستر.', withdrawal: 'فلوس طلعت من الشغل: سحب شريك أو مصروف شخصي. اكتب اسم الشريك بالملاحظة.', deposit: 'فلوس دخلت للشغل من برا: رأس مال أو إيداع شريك.', adjustment: 'لتصحيح فرق بين الرصيد بالنظام والموجود فعلاً.' };
  return <Modal title="حركة فلوس يدوية" onClose={onClose}>{flash}
    <div className="admin-form-grid">
      <label className="admin-field admin-field-full"><span>نوع الحركة</span><select value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(movementKinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><small className="acc-muted">{hint[kind]}</small></label>
      {kind === 'adjustment' && <div className="admin-field admin-field-full"><span>الفرق</span><div className="acc-seg"><button type="button" className={direction === 'in' ? 'is-on' : ''} onClick={() => setDirection('in')}>زيادة على الرصيد</button><button type="button" className={direction === 'out' ? 'is-on' : ''} onClick={() => setDirection('out')}>نقص من الرصيد</button></div></div>}
      {needFrom && <label className="admin-field"><span>{kind === 'transfer' ? 'من حساب' : 'الحساب'}</span><select value={from} onChange={e => setFrom(e.target.value)}>{accountOptions(couriers)}</select></label>}
      {needTo && <label className="admin-field"><span>{kind === 'transfer' ? 'إلى حساب' : 'الحساب'}</span><select value={to} onChange={e => setTo(e.target.value)}>{accountOptions(couriers)}</select></label>}
      <label className="admin-field"><span>المبلغ (د.ع)</span><input type="number" min="1" step="250" value={amount} onChange={e => setAmount(e.target.value)} inputMode="numeric" /></label>
      <label className="admin-field"><span>التاريخ</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="admin-field admin-field-full"><span>ملاحظة</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="مثلاً: سحب أحمد / رصيد بداية الشهر" /></label>
    </div>
    <div className="admin-modal-actions"><button className="admin-btn admin-btn-ghost" onClick={onClose}>إلغاء</button><button className="admin-btn admin-btn-primary" disabled={busy || !(Number(amount) > 0)} onClick={() => void save()}>{busy ? <LoaderCircle size={15} className="spin" /> : <CheckCheck size={15} />} حفظ</button></div>
  </Modal>;
}

function SettingsModal({ couriers, settings, onClose }: { couriers: CourierDTO[]; settings: { qasehFeePercent: number; defaultCourierId: number | null }; onClose: () => void }) {
  const router = useRouter();
  const { flash, fail } = useFlash();
  const [pct, setPct] = useState(String(settings.qasehFeePercent)), [courier, setCourier] = useState(settings.defaultCourierId ? String(settings.defaultCourierId) : ''), [busy, setBusy] = useState(false);
  async function save() { setBusy(true); try { await api('/api/admin/accounts/settings', { method: 'PUT', json: { qasehFeePercent: Number(pct), defaultCourierId: courier ? Number(courier) : null } }); onClose(); router.refresh(); } catch (e) { fail(e); setBusy(false); } }
  return <Modal title="إعدادات الحسابات" onClose={onClose}>{flash}
    <div className="admin-form-grid">
      <label className="admin-field"><span>عمولة القاصة (%)</span><input type="number" min="0" max="20" step="0.1" value={pct} onChange={e => setPct(e.target.value)} /><small className="acc-muted">تنطبق على الدفعات الجاية. الدفعات السابقة تبقى بعمولتها.</small></label>
      <label className="admin-field"><span>شركة التوصيل الافتراضية</span><select value={courier} onChange={e => setCourier(e.target.value)}><option value="">— بدون —</option>{couriers.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><small className="acc-muted">تنضاف وحدها على طلبات الموقع لما تنشحن.</small></label>
    </div>
    <div className="admin-modal-actions"><button className="admin-btn admin-btn-ghost" onClick={onClose}>إلغاء</button><button className="admin-btn admin-btn-primary" disabled={busy} onClick={() => void save()}>{busy ? <LoaderCircle size={15} className="spin" /> : <CheckCheck size={15} />} حفظ</button></div>
  </Modal>;
}

// ---------------- Delivery companies & settlements ----------------
type Candidate = { id: number; reference: string; name: string; governorate: string; status: string; paymentMethod: string; deliveredAt: string; total: number; collected: number; fee: number; feeMissing: boolean; net: number; legacy: boolean };
type SettlementRow = { id: number; courierId: number; courierName: string; expectedIqd: number; receivedIqd: number; account: string; settledAt: string; note: string | null; orders: number };

export function CouriersView({ couriers, selected, candidates, settlements, canManage }: { couriers: CourierDTO[]; selected: number | null; candidates: Candidate[]; settlements: SettlementRow[]; canManage: boolean }) {
  const router = useRouter();
  const { flash, success, fail } = useFlash();
  const [editing, setEditing] = useState<CourierDTO | 'new' | null>(null);
  const [picked, setPicked] = useState<number[]>(() => candidates.map(c => c.id));
  const [source, setSource] = useState(candidates);
  if (source !== candidates) { setSource(candidates); setPicked(candidates.map(c => c.id)); }
  const chosen = candidates.filter(c => picked.includes(c.id));
  const collected = chosen.reduce((s, c) => s + c.collected, 0), fees = chosen.reduce((s, c) => s + c.fee, 0), expected = collected - fees;
  const [received, setReceived] = useState(''), [account, setAccount] = useState<'cash' | 'master'>('cash'), [date, setDate] = useState(today()), [note, setNote] = useState(''), [busy, setBusy] = useState(false);
  const receivedNum = received === '' ? expected : Number(received);
  const diff = receivedNum - expected;
  const courier = couriers.find(c => c.id === selected) ?? null;
  async function settle() {
    if (!courier || !chosen.length) return;
    if (!window.confirm(`تسجيل استلام ${n(receivedNum)} د.ع من ${courier.name} عن ${chosen.length} طلب؟`)) return;
    setBusy(true);
    try { await api('/api/admin/accounts/settlements', { method: 'POST', json: { courierId: courier.id, orderIds: chosen.map(c => c.id), receivedIqd: receivedNum, account, settledAt: date, note } }); setReceived(''); setNote(''); success('انحفظ الكشف ودخلت الفلوس للحساب.'); router.refresh(); }
    catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function removeSettlement(row: SettlementRow) {
    if (!window.confirm(`حذف كشف رقم ${row.id}؟ طلباته ترجع «عند شركة التوصيل» والمبلغ ينشال من ${accountNames[row.account as MoneyAccount] ?? row.account}.`)) return;
    try { await api(`/api/admin/accounts/settlements/${row.id}`, { method: 'DELETE' }); success('انحذف الكشف.'); router.refresh(); } catch (e) { fail(e); }
  }
  const go = (id: number) => router.push(`/admin/accounts/couriers?courier=${id}`, { scroll: false });
  return <main className="admin-page">
    <AccountsTabs />
    <div className="acc-head"><div><h1>شركات التوصيل</h1><p>سجّل الفلوس اللي تستلمها من شركة التوصيل، وطابقها ويه كشفهم.</p></div>{canManage && <div className="acc-actions"><button className="admin-btn admin-btn-ghost" onClick={() => setEditing('new')}><Plus size={15} /> شركة جديدة</button></div>}</div>
    {flash}
    {!couriers.length ? <section className="acc-card"><h2>ابدي بإضافة شركة التوصيل</h2><p className="acc-muted">اكتب اسم الشركة وأجورها. بعدها كل طلب توصيل ينحسب عليها.</p>{canManage && <button className="admin-btn admin-btn-primary" onClick={() => setEditing('new')}><Plus size={15} /> أضف شركة</button>}</section> : <>
      <div className="acc-filters"><div className="acc-seg" role="tablist">{couriers.map(c => <button key={c.id} type="button" className={c.id === selected ? 'is-on' : ''} onClick={() => go(c.id)}>{c.name}{!c.active ? ' (موقوفة)' : ''}</button>)}</div>
        {courier && canManage && <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setEditing(courier)}><Pencil size={13} /> تعديل الشركة والأجور</button>}</div>
      {courier && <section className="acc-card">
        <h2><Banknote size={17} /> استلام فلوس من {courier.name} <small>أجور التوصيل: {n(courier.defaultFeeIqd)} · الإرجاع: {n(courier.returnFeeIqd)}</small></h2>
        {!candidates.length ? <p className="acc-muted">ماكو طلبات بانتظار الكشف. كل الطلبات المسلّمة والراجعة لهذه الشركة متسوية.</p> : <>
          <p className="acc-muted">أشّر الطلبات الموجودة بكشف الشركة. المؤشر عليها افتراضياً كل الطلبات اللي انسلمت أو رجعت وبعدها ما تسوت.</p>
          <div className="acc-wrap"><table className="acc-table"><thead><tr><th><input type="checkbox" aria-label="تحديد الكل" checked={picked.length === candidates.length} onChange={e => setPicked(e.target.checked ? candidates.map(c => c.id) : [])} /></th><th>الطلب</th><th>المحافظة</th><th>الحالة</th><th className="num">استلموا من الزبون</th><th className="num">أجورهم</th><th className="num">الصافي لك</th></tr></thead>
            <tbody>{candidates.map(c => <tr key={c.id} className={picked.includes(c.id) ? '' : 'is-off'}>
              <td><input type="checkbox" checked={picked.includes(c.id)} aria-label={`تحديد ${c.reference}`} onChange={() => setPicked(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])} /></td>
              <td><Link className="admin-strong-link" href={`/admin/orders/${c.id}`}>{c.reference}</Link><br /><small className="acc-muted">{c.name} · {d(c.deliveredAt)}</small></td>
              <td>{govName(c.governorate)}</td>
              <td>{c.status === 'returned' ? <span className="acc-pill muted">راجع</span> : <span className="acc-pill ok">مسلّم</span>} <small className="acc-muted">{paymentMethodNames[c.paymentMethod] ?? c.paymentMethod}</small>{c.legacy && <span className="acc-pill danger" style={{ marginInlineStart: 4 }}>قديم</span>}</td>
              <td className="num">{c.collected ? n(c.collected) : '—'}</td>
              <td className="num">{c.feeMissing ? <span className="acc-pill danger">بدون أجور</span> : c.fee ? `−${n(c.fee)}` : '0'}</td>
              <td className={`num ${c.net < 0 ? 'acc-out' : ''}`}><strong>{n(c.net)}</strong></td></tr>)}</tbody>
            <tfoot><tr><td colSpan={4}>{chosen.length} طلب</td><td className="num">{n(collected)}</td><td className="num">−{n(fees)}</td><td className="num">{n(expected)}</td></tr></tfoot></table></div>
          <div className="acc-sum"><div><span>استلموا من الزبائن</span><strong>{n(collected)}</strong></div><div><span>أجورهم</span><strong>{fees ? `−${n(fees)}` : "0"}</strong></div><div><span>المفروض تستلم</span><strong>{n(expected)}</strong></div><div><span>استلمت فعلاً</span><strong>{n(receivedNum)}</strong></div></div>
          {received !== '' && <div className={`acc-diff ${diff === 0 ? 'ok' : 'warn'}`}>{diff === 0 ? 'المبلغ مطابق.' : diff < 0 ? `ناقص ${n(-diff)} د.ع. الفرق يبقى بذمة الشركة.` : `زايد ${n(diff)} د.ع عن المتوقع. راجع الكشف أو الأجور.`}</div>}
          {canManage && <div className="admin-form-grid">
            <label className="admin-field"><span>المبلغ اللي استلمته (د.ع)</span><input type="number" min="0" step="250" placeholder={String(expected)} value={received} onChange={e => setReceived(e.target.value)} inputMode="numeric" /></label>
            <label className="admin-field"><span>وين دخلت الفلوس</span><select value={account} onChange={e => setAccount(e.target.value as 'cash' | 'master')}><option value="cash">{accountNames.cash}</option><option value="master">{accountNames.master}</option></select></label>
            <label className="admin-field"><span>تاريخ الاستلام</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <label className="admin-field"><span>ملاحظة / رقم كشفهم</span><input value={note} onChange={e => setNote(e.target.value)} /></label>
            <div className="admin-field admin-field-full"><button className="admin-btn admin-btn-primary" disabled={busy || !chosen.length || !(receivedNum >= 0)} onClick={() => void settle()}>{busy ? <LoaderCircle size={15} className="spin" /> : <CheckCheck size={15} />} تسجيل الاستلام ({chosen.length} طلب)</button></div>
          </div>}
        </>}
      </section>}
      <section className="acc-card"><h2>الكشوفات السابقة</h2>
        {!settlements.length ? <p className="acc-muted">ماكو كشوفات بعد.</p> : <div className="acc-wrap"><table className="acc-table"><thead><tr><th>رقم</th><th>التاريخ</th><th>الشركة</th><th className="num">طلبات</th><th className="num">المتوقع</th><th className="num">المستلم</th><th className="num">الفرق</th><th>دخلت إلى</th><th /></tr></thead><tbody>
          {settlements.map(s => { const diffRow = s.receivedIqd - s.expectedIqd; return <tr key={s.id}><td><Link className="admin-strong-link" href={`/admin/accounts/couriers/${s.id}`}>{s.id}</Link></td><td>{d(s.settledAt)}</td><td>{s.courierName}</td><td className="num">{s.orders}</td><td className="num">{n(s.expectedIqd)}</td><td className="num"><strong>{n(s.receivedIqd)}</strong></td><td className={`num ${diffRow ? 'acc-out' : ''}`}>{diffRow ? n(diffRow) : '—'}</td><td>{accountNames[s.account as MoneyAccount] ?? s.account}{s.note && <><br /><small className="acc-muted">{s.note}</small></>}</td><td>{canManage && <button className="admin-btn admin-btn-danger-ghost admin-btn-sm admin-icon-only" aria-label={`حذف الكشف ${s.id}`} onClick={() => void removeSettlement(s)}><Trash2 size={14} /></button>}</td></tr>; })}
        </tbody></table></div>}
      </section>
    </>}
    {editing && <CourierModal courier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={id => { setEditing(null); if (id) go(id); router.refresh(); }} />}
  </main>;
}

function CourierModal({ courier, onClose, onSaved }: { courier: CourierDTO | null; onClose: () => void; onSaved: (id?: number) => void }) {
  const { flash, fail } = useFlash();
  const [name, setName] = useState(courier?.name ?? ''), [phone, setPhone] = useState(courier?.phone ?? ''), [fee, setFee] = useState(String(courier?.defaultFeeIqd ?? '')), [returnFee, setReturnFee] = useState(String(courier?.returnFeeIqd ?? 0)), [active, setActive] = useState(courier?.active ?? true), [busy, setBusy] = useState(false);
  const [rates, setRates] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(courier?.rates ?? {}).map(([k, v]) => [k, String(v)])));
  const [showRates, setShowRates] = useState(Object.keys(courier?.rates ?? {}).length > 0);
  async function save() {
    setBusy(true);
    const json = { name, phone, defaultFeeIqd: Number(fee) || 0, returnFeeIqd: Number(returnFee) || 0, active, rates: Object.fromEntries(Object.entries(rates).filter(([, v]) => v !== '')) };
    try { const r = await api<{ courier: { id: number } }>(courier ? `/api/admin/accounts/couriers/${courier.id}` : '/api/admin/accounts/couriers', { method: courier ? 'PATCH' : 'POST', json }); onSaved(r.courier.id); }
    catch (e) { fail(e); setBusy(false); }
  }
  return <Modal title={courier ? `تعديل ${courier.name}` : 'شركة توصيل جديدة'} onClose={onClose} wide>{flash}
    <div className="admin-form-grid">
      <label className="admin-field"><span>اسم الشركة</span><input value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="admin-field"><span>رقم الهاتف</span><input value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" inputMode="tel" /></label>
      <label className="admin-field"><span>أجور التوصيل للطلب (د.ع)</span><input type="number" min="0" step="250" value={fee} onChange={e => setFee(e.target.value)} /><small className="acc-muted">تنطبق على كل المحافظات إلا اللي تكتب لها سعر خاص.</small></label>
      <label className="admin-field"><span>أجور الإرجاع (د.ع)</span><input type="number" min="0" step="250" value={returnFee} onChange={e => setReturnFee(e.target.value)} /><small className="acc-muted">صفر إذا الشركة ما تاخذ على الطلب الراجع.</small></label>
      <label className="admin-field"><span>الحالة</span><select value={active ? '1' : '0'} onChange={e => setActive(e.target.value === '1')}><option value="1">شغالة</option><option value="0">موقوفة</option></select></label>
    </div>
    <div style={{ marginTop: 14 }}><button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setShowRates(v => !v)}>{showRates ? 'إخفاء أسعار المحافظات' : 'سعر مختلف لبعض المحافظات'}</button></div>
    {showRates && <div className="acc-rates" style={{ marginTop: 12 }}>{iraqGovernorates.map(g => <label key={g.code}><span>{g.nameAr}</span><input type="number" min="0" step="250" placeholder={fee || '0'} value={rates[g.code] ?? ''} onChange={e => setRates(r => ({ ...r, [g.code]: e.target.value }))} /></label>)}</div>}
    <div className="admin-modal-actions"><button className="admin-btn admin-btn-ghost" onClick={onClose}>إلغاء</button><button className="admin-btn admin-btn-primary" disabled={busy || name.trim().length < 2} onClick={() => void save()}>{busy ? <LoaderCircle size={15} className="spin" /> : <CheckCheck size={15} />} حفظ</button></div>
  </Modal>;
}

export function SettlementView({ data }: { data: { settlement: { id: number; expectedIqd: number; receivedIqd: number; account: string; settledAt: string; note: string | null }; courierName: string; orders: { id: number; reference: string; name: string; governorate: string; status: string; paymentMethod: string; collected: number; fee: number; net: number }[] } }) {
  const s = data.settlement;
  return <main className="admin-page">
    <AccountsTabs />
    <div className="acc-head"><div><Link href="/admin/accounts/couriers" className="admin-link">← شركات التوصيل</Link><h1>كشف رقم {s.id} · {data.courierName}</h1><p>{d(s.settledAt)} · دخلت إلى {accountNames[s.account as MoneyAccount] ?? s.account}{s.note ? ` · ${s.note}` : ''}</p></div><div className="acc-actions"><button className="admin-btn admin-btn-ghost" onClick={() => window.print()}>طباعة</button></div></div>
    <div className="acc-sum"><div><span>طلبات</span><strong>{data.orders.length}</strong></div><div><span>المتوقع</span><strong>{n(s.expectedIqd)}</strong></div><div><span>المستلم</span><strong>{n(s.receivedIqd)}</strong></div><div><span>الفرق</span><strong className={s.receivedIqd - s.expectedIqd ? 'acc-out' : ''}>{n(s.receivedIqd - s.expectedIqd)}</strong></div></div>
    <section className="acc-card"><div className="acc-wrap"><table className="acc-table"><thead><tr><th>الطلب</th><th>الزبون</th><th>المحافظة</th><th>الحالة</th><th className="num">استلموا</th><th className="num">أجور</th><th className="num">الصافي</th></tr></thead><tbody>
      {data.orders.map(o => <tr key={o.id}><td><Link className="admin-strong-link" href={`/admin/orders/${o.id}`}>{o.reference}</Link></td><td>{o.name}</td><td>{govName(o.governorate)}</td><td>{o.status === 'returned' ? 'راجع' : 'مسلّم'} · <small className="acc-muted">{paymentMethodNames[o.paymentMethod] ?? o.paymentMethod}</small></td><td className="num">{n(o.collected)}</td><td className="num">−{n(o.fee)}</td><td className="num"><strong>{n(o.net)}</strong></td></tr>)}
    </tbody><tfoot><tr><td colSpan={4}>المجموع</td><td className="num">{n(data.orders.reduce((a, o) => a + o.collected, 0))}</td><td className="num">−{n(data.orders.reduce((a, o) => a + o.fee, 0))}</td><td className="num">{n(s.expectedIqd)}</td></tr></tfoot></table></div></section>
  </main>;
}

// ---------------- Ledger ----------------
export function LedgerView({ entries, couriers, account, from, to, opening, canManage }: { entries: Entry[]; couriers: CourierDTO[]; account: string; from: string; to: string; opening: number | null; canManage: boolean }) {
  const router = useRouter();
  const { flash, fail } = useFlash();
  const courierNames = useMemo(() => new Map(couriers.map(c => [c.id, c.name])), [couriers]);
  const label = (key: string) => key in accountNames ? accountNames[key as MoneyAccount] : courierNames.get(Number(key.split(':')[1])) ?? key;
  const go = (next: { account?: string; from?: string; to?: string }) => { const p = new URLSearchParams(); const a = next.account ?? account, f = next.from ?? from, t = next.to ?? to; if (a) p.set('account', a); if (f) p.set('from', f); if (t) p.set('to', t); router.push(`/admin/accounts/ledger${p.size ? `?${p}` : ''}`, { scroll: false }); };
  const totalIn = entries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0), totalOut = entries.filter(e => e.amount < 0).reduce((s, e) => s - e.amount, 0);
  async function removeMovement(id: number) { if (!window.confirm('حذف هذه الحركة اليدوية؟')) return; try { await api(`/api/admin/accounts/movements/${id}`, { method: 'DELETE' }); router.refresh(); } catch (e) { fail(e); } }
  return <main className="admin-page">
    <AccountsTabs />
    <div className="acc-head"><div><h1>كل الحركات</h1><p>كل دينار دخل أو طلع من أي حساب، ومن وين جاء.</p></div></div>
    {flash}
    <div className="acc-filters">
      <label>الحساب<select value={account} onChange={e => go({ account: e.target.value })}><option value="">كل الحسابات</option>{accountOptions(couriers)}</select></label>
      <label>من<input type="date" value={from} onChange={e => go({ from: e.target.value })} /></label>
      <label>إلى<input type="date" value={to} onChange={e => go({ to: e.target.value })} /></label>
    </div>
    <div className="acc-sum">{opening !== null && <div><span>رصيد أول الفترة</span><strong>{n(opening)}</strong></div>}<div><span>داخل</span><strong className="acc-in">{totalIn ? `+${n(totalIn)}` : "0"}</strong></div><div><span>طالع</span><strong className="acc-out">{totalOut ? `−${n(totalOut)}` : "0"}</strong></div>{opening !== null && <div><span>رصيد آخر الفترة</span><strong>{n(opening + totalIn - totalOut)}</strong></div>}</div>
    <section className="acc-card">{!entries.length ? <p className="acc-muted">ماكو حركات بهذه الفترة.</p> : <div className="acc-wrap"><table className="acc-table"><thead><tr><th>التاريخ</th><th>الحساب</th><th>التفاصيل</th><th className="num">داخل</th><th className="num">طالع</th><th /></tr></thead><tbody>
      {entries.map((e, i) => <tr key={i}><td>{d(e.at)}</td><td>{label(e.account)}</td><td>{e.orderId ? <Link className="admin-link" href={`/admin/orders/${e.orderId}`}>{e.label}</Link> : e.settlementId ? <Link className="admin-link" href={`/admin/accounts/couriers/${e.settlementId}`}>{e.label}</Link> : e.label}</td><td className="num acc-in">{e.amount > 0 ? n(e.amount) : ''}</td><td className="num acc-out">{e.amount < 0 ? n(-e.amount) : ''}</td><td>{canManage && e.movementId && <button className="admin-btn admin-btn-danger-ghost admin-btn-sm admin-icon-only" aria-label="حذف الحركة" onClick={() => void removeMovement(e.movementId!)}><Trash2 size={13} /></button>}</td></tr>)}
    </tbody></table></div>}</section>
  </main>;
}
