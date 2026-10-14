'use client';

import { useState } from 'react';
import { BarChart3, Bell, CheckCircle2, ExternalLink, LoaderCircle, MessageCircle, MousePointerClick, Save, Search, Send, Activity } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { Integrations } from '@/lib/integrations';
import { api, useFlash } from './ui';
import { Card, PageHero } from './dash-ui';

type Chat = { id: string; name: string; type: string };

export function IntegrationsManager({ initial, canManage }: { initial: Integrations; canManage: boolean }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, arText: string) => ar ? arText : en;
  const { flash, success, fail } = useFlash();
  const [s, setS] = useState<Integrations>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[] | null>(null);
  const set = <K extends keyof Integrations>(key: K, patch: Partial<Integrations[K]>) => setS(current => ({ ...current, [key]: { ...current[key], ...patch } }));

  async function save(quiet = false) {
    const data = await api<{ integrations: Integrations }>('/api/admin/integrations', { method: 'PUT', json: s });
    setS(data.integrations);
    if (!quiet) success(tt('Saved.', 'تم الحفظ.'));
  }
  async function run(label: string, job: () => Promise<void>) { setBusy(label); try { await job(); } catch (e) { fail(e); } finally { setBusy(null); } }
  const findChats = () => run('chats', async () => {
    const data = await api<{ chats: Chat[] }>('/api/admin/integrations/telegram-chats', { method: 'POST', json: { botToken: s.telegram.botToken } });
    setChats(data.chats);
    if (!data.chats.length) fail(new Error(tt('No chats yet. Open your bot in Telegram, press Start (or send any message), then try again.', 'ماكو محادثات بعد. افتح البوت بتيليكرام واضغط Start (أو ابعثله أي رسالة)، وبعدين جرّب مرة ثانية.')));
  });
  const testMeta = () => run('test-meta', async () => {
    await save(true);
    const r = await api<{ received: number; testCode: string }>('/api/admin/integrations/test', { method: 'POST', json: { channel: 'meta' } });
    success(r.testCode ? tt(`Meta received the test event. Check Events Manager → Test events (${r.testCode}).`, `ميتا استلمت الحدث التجريبي. شوفه بـ Events Manager ← Test events (${r.testCode}).`) : tt('Meta accepted the event. Add a test event code to see it live in Events Manager → Test events.', 'ميتا قبلت الحدث. حط كود Test event حتى تشوفه مباشرة بـ Events Manager ← Test events.'));
  });
  const test = (channel: 'telegram' | 'whatsapp') => run(`test-${channel}`, async () => {
    await save(true);
    await api('/api/admin/integrations/test', { method: 'POST', json: { channel } });
    success(channel === 'telegram' ? tt('Test message sent to Telegram.', 'انبعثت رسالة تجريبية على تيليكرام.') : tt('Test message sent to WhatsApp.', 'انبعثت رسالة تجريبية على واتساب.'));
  });
  const steps = (items: React.ReactNode[]) => <ol className="int-steps">{items.map((item, i) => <li key={i}><i>{i + 1}</i><span>{item}</span></li>)}</ol>;
  const disabled = !canManage;

  return <main className="admin-page dash">
    <PageHero eyebrow={tt('Configuration', 'الإعدادات')} title={tt('Notifications & tracking', 'الإشعارات والتتبع')} description={tt('Get every new order on Telegram or WhatsApp the moment it is placed, and connect Meta Pixel, Google Analytics and Microsoft Clarity. All free.', 'توصلك كل طلبية جديدة على تيليكرام أو واتساب لحظة ما تنطلب، واربط ميتا بكسل وكوكل أناليتكس ومايكروسوفت كلاريتي. كلها مجانية.')}
      actions={canManage ? <div className="dash-quick"><button type="button" className="dash-btn primary" disabled={busy !== null} onClick={() => void run('save', () => save())}>{busy === 'save' ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />} {tt('Save all', 'حفظ الكل')}</button></div> : null} />
    {flash}

    <div className="dash-grid two">
      <Card icon={<Send size={17} />} title={<>Telegram <span className={`dash-chip ${s.telegram.enabled ? 'success' : ''}`}>{s.telegram.enabled ? tt('On', 'مفعّل') : tt('Off', 'متوقف')}</span></>} action={<label className="int-switch"><input type="checkbox" disabled={disabled} checked={s.telegram.enabled} onChange={e => set('telegram', { enabled: e.target.checked })} /><span /></label>}>
        <p className="int-lead">{tt('Recommended: free, instant, no limits, works for you and your team (add the bot to a group).', 'الأفضل: مجاني، فوري، بلا حدود، ويوصل إلك وللفريق (ضيف البوت لكروب).')}</p>
        {steps([
          <>{tt('In Telegram open ', 'بتيليكرام افتح ')}<a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather <ExternalLink size={12} /></a>{tt(', send /newbot and follow the steps. Copy the token it gives you.', '، ابعث ‎/newbot وكمّل الخطوات. انسخ التوكن اللي يعطيك.')}</>,
          <>{tt('Open your new bot and press Start. For the team, add the bot to a group and send a message there.', 'افتح البوت الجديد واضغط Start. إذا تريده للفريق، ضيفه لكروب وابعث رسالة بيه.')}</>,
          <>{tt('Paste the token below and press “Find my chat”.', 'الصق التوكن تحت واضغط «جيب المحادثة».')}</>,
        ])}
        <label className="admin-field"><span>{tt('Bot token', 'توكن البوت')}</span><input dir="ltr" disabled={disabled} value={s.telegram.botToken} onChange={e => set('telegram', { botToken: e.target.value })} placeholder="123456789:AAH…" autoComplete="off" /></label>
        <div className="int-row"><button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={disabled || busy !== null} onClick={() => void findChats()}>{busy === 'chats' ? <LoaderCircle size={14} className="spin" /> : <Search size={14} />} {tt('Find my chat', 'جيب المحادثة')}</button></div>
        {chats && chats.length > 0 && <ul className="int-chats">{chats.map(c => { const on = s.telegram.chatIds.includes(c.id); return <li key={c.id}><label><input type="checkbox" checked={on} onChange={() => set('telegram', { chatIds: on ? s.telegram.chatIds.filter(x => x !== c.id) : [...s.telegram.chatIds, c.id] })} /><b>{c.name}</b><small>{c.type === 'private' ? tt('private chat', 'محادثة خاصة') : tt('group', 'كروب')} · {c.id}</small></label></li>; })}</ul>}
        <label className="admin-field"><span>{tt('Chat IDs (one per line)', 'أرقام المحادثات (كل رقم بسطر)')}</span><textarea dir="ltr" rows={2} disabled={disabled} value={s.telegram.chatIds.join('\n')} onChange={e => set('telegram', { chatIds: e.target.value.split(/\s+/).filter(Boolean) })} /></label>
        <div className="int-row"><button type="button" className="admin-btn admin-btn-primary admin-btn-sm" disabled={disabled || busy !== null || !s.telegram.botToken || !s.telegram.chatIds.length} onClick={() => void test('telegram')}>{busy === 'test-telegram' ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />} {tt('Save & send a test', 'حفظ وإرسال تجربة')}</button></div>
      </Card>

      <Card icon={<MessageCircle size={17} />} title={<>WhatsApp <span className={`dash-chip ${s.whatsapp.enabled ? 'success' : ''}`}>{s.whatsapp.enabled ? tt('On', 'مفعّل') : tt('Off', 'متوقف')}</span></>} action={<label className="int-switch"><input type="checkbox" disabled={disabled} checked={s.whatsapp.enabled} onChange={e => set('whatsapp', { enabled: e.target.checked })} /><span /></label>}>
        <p className="int-lead">{tt('Free through CallMeBot, to your own number only (personal use). Good as a second channel.', 'مجاني عن طريق CallMeBot، يوصل لرقمك أنت بس (استخدام شخصي). ممتاز كقناة ثانية.')}</p>
        {steps([
          <>{tt('Save this number in your phone contacts: ', 'احفظ هذا الرقم بجهات الاتصال: ')}<b dir="ltr">+34 644 31 95 65</b></>,
          <>{tt('Send it this exact WhatsApp message: ', 'ابعثله على واتساب هاي الرسالة بالضبط: ')}<code dir="ltr">I allow callmebot to send me messages</code></>,
          <>{tt('You get a reply with your API key within a couple of minutes. Paste it below with your number.', 'يوصلك رد بيه الـ API key خلال دقيقتين. الصقه تحت ويا رقمك.')}</>,
        ])}
        <div className="admin-form-grid">
          <label className="admin-field"><span>{tt('Your WhatsApp number', 'رقم الواتساب مالتك')}</span><input dir="ltr" disabled={disabled} value={s.whatsapp.phone} onChange={e => set('whatsapp', { phone: e.target.value })} placeholder="+9647701234567" /></label>
          <label className="admin-field"><span>API key</span><input dir="ltr" disabled={disabled} value={s.whatsapp.apiKey} onChange={e => set('whatsapp', { apiKey: e.target.value })} placeholder="123456" autoComplete="off" /></label>
        </div>
        <div className="int-row"><button type="button" className="admin-btn admin-btn-primary admin-btn-sm" disabled={disabled || busy !== null || !s.whatsapp.phone || !s.whatsapp.apiKey} onClick={() => void test('whatsapp')}>{busy === 'test-whatsapp' ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />} {tt('Save & send a test', 'حفظ وإرسال تجربة')}</button></div>
      </Card>
    </div>

    <Card icon={<Bell size={17} />} title={tt('What to send', 'شنو يوصلك')}>
      <div className="int-toggles">
        <label><input type="checkbox" disabled={disabled} checked={s.notify.newOrder} onChange={e => set('notify', { newOrder: e.target.checked })} /><span><b>{tt('Every new order', 'كل طلب جديد')}</b><small>{tt('Customer, phone, address, items, offers, total to collect and a link to the order.', 'الزبون، الرقم، العنوان، المنتجات، العروض، المبلغ المطلوب، ورابط الطلب.')}</small></span></label>
        <label><input type="checkbox" disabled={disabled} checked={s.notify.lowStock} onChange={e => set('notify', { lowStock: e.target.checked })} /><span><b>{tt('Low-stock warning in the same message', 'تنبيه المخزون القليل بنفس الرسالة')}</b><small>{tt('When an order leaves a colour at or below the low-stock level.', 'إذا الطلب خلّى لون وصل لحد المخزون المنخفض أو أقل.')}</small></span></label>
      </div>
      <pre className="int-sample" dir="rtl">{`🛍️ طلب جديد UR-4F2A9C
👤 أحمد علي
📞 07701234567
📍 بغداد — الكرادة، شارع 62
• 1 × محفظة كرافت — بني  30,000 د.ع
💰 المطلوب تحصيله: 35,000 د.ع
🔗 …/admin/orders/128`}</pre>
    </Card>

    <div className="dash-grid three">
      <Card icon={<Activity size={17} />} title={<>Meta Pixel {s.tracking.metaPixelId && <CheckCircle2 size={15} className="int-ok" />}</>}>
        <p className="int-lead">{tt('For Facebook & Instagram ads: builds audiences and reports purchases back to Ads Manager.', 'لإعلانات فيسبوك وإنستغرام: يبني جماهير ويرجّع المشتريات لمدير الإعلانات.')}</p>
        <label className="admin-field"><span>Pixel ID</span><input dir="ltr" disabled={disabled} value={s.tracking.metaPixelId} onChange={e => set('tracking', { metaPixelId: e.target.value.replace(/\D/g, '') })} placeholder="1234567890123456" /></label>
        <p className="int-help">{tt('Events Manager → Data sources → your pixel → the number under its name.', 'Events Manager ← Data sources ← البكسل مالتك ← الرقم تحت الاسم.')}</p>
        <p className="int-events">PageView · ViewContent · AddToCart · InitiateCheckout · Purchase</p>
        <div className="int-capi">
          <h4>{tt('Conversions API (server)', 'Conversions API (من السيرفر)')} {s.tracking.metaCapiToken && <CheckCircle2 size={14} className="int-ok" />}</h4>
          <p className="int-help">{tt('Sends the same events from the server, so purchases still reach Meta when the pixel is blocked (iPhone, ad blockers). Duplicates are removed by Meta automatically.', 'يبعث نفس الأحداث من السيرفر، فالمشتريات توصل لميتا حتى لو البكسل انمنع (آيفون، مانع إعلانات). ميتا تحذف المكرر تلقائياً.')}</p>
          <label className="admin-field"><span>{tt('Access token', 'رمز الوصول (Access token)')}</span><input dir="ltr" disabled={disabled} type="password" autoComplete="off" value={s.tracking.metaCapiToken} onChange={e => set('tracking', { metaCapiToken: e.target.value.trim() })} placeholder="EAAG…" /></label>
          <p className="int-help">{tt('Events Manager → your pixel → Settings → Conversions API → Generate access token.', 'Events Manager ← البكسل ← Settings ← Conversions API ← Generate access token.')}</p>
          <label className="admin-field"><span>{tt('Test event code (optional)', 'كود الاختبار (اختياري)')}</span><input dir="ltr" disabled={disabled} value={s.tracking.metaTestCode} onChange={e => set('tracking', { metaTestCode: e.target.value.toUpperCase().trim() })} placeholder="TEST12345" /></label>
          <p className="int-help">{tt('Only while testing: events with this code show in Test events and are not counted. Clear it when done.', 'بس وقت التجربة: الأحداث بهذا الكود تظهر بـ Test events وما تنحسب. امسحه بعد ما تخلص.')}</p>
          <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={disabled || busy !== null || !s.tracking.metaPixelId || !s.tracking.metaCapiToken} onClick={() => void testMeta()}>{busy === 'test-meta' ? <LoaderCircle size={13} className="spin" /> : <Send size={13} />} {tt('Send test event', 'إرسال حدث تجريبي')}</button>
        </div>
      </Card>
      <Card icon={<BarChart3 size={17} />} title={<>Google Analytics 4 {s.tracking.ga4Id && <CheckCircle2 size={15} className="int-ok" />}</>}>
        <p className="int-lead">{tt('Visitors, traffic sources and the full purchase funnel.', 'الزوار، مصادر الزيارات، ومسار الشراء كامل.')}</p>
        <label className="admin-field"><span>Measurement ID</span><input dir="ltr" disabled={disabled} value={s.tracking.ga4Id} onChange={e => set('tracking', { ga4Id: e.target.value.toUpperCase() })} placeholder="G-XXXXXXXXXX" /></label>
        <p className="int-help">{tt('Admin → Data streams → your website → Measurement ID.', 'Admin ← Data streams ← موقعك ← Measurement ID.')}</p>
        <p className="int-events">page_view · view_item · add_to_cart · begin_checkout · purchase</p>
      </Card>
      <Card icon={<MousePointerClick size={17} />} title={<>Microsoft Clarity {s.tracking.clarityId && <CheckCircle2 size={15} className="int-ok" />}</>}>
        <p className="int-lead">{tt('Session recordings and heatmaps: see where shoppers click, scroll and get stuck.', 'تسجيل جلسات وخرائط حرارية: تشوف وين يضغط الزبون، لوين ينزل، ووين يتوقف.')}</p>
        <label className="admin-field"><span>Project ID</span><input dir="ltr" disabled={disabled} value={s.tracking.clarityId} onChange={e => set('tracking', { clarityId: e.target.value.toLowerCase().trim() })} placeholder="abcd1234ef" /></label>
        <p className="int-help">{tt('clarity.microsoft.com → your project → Settings → Overview → Project ID.', 'clarity.microsoft.com ← المشروع ← Settings ← Overview ← Project ID.')}</p>
        <p className="int-events">{tt('Records automatically', 'يسجل تلقائياً')}</p>
      </Card>
    </div>
    <p className="dash-generated">{tt('Tracking tags load only on the storefront, never in the admin. Money is sent in IQD.', 'أكواد التتبع تشتغل بالموقع بس، مو بلوحة الإدارة. المبالغ تنبعث بالدينار العراقي.')}</p>
  </main>;
}
