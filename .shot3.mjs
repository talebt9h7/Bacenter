import { chromium } from '@playwright/test';
const S = '/tmp/claude-0/-home-claude-bacenter/da099a9e-1d79-5c60-ab44-f09308495e89/scratchpad';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.request.post('http://localhost:3001/api/admin/login', { data: { password: process.env.ADMIN_PASSWORD } });
await ctx.addCookies([{ name: 'UR_lang', value: 'ar', url: 'http://localhost:3001' }]);
for (const s of process.argv.slice(2)) { const [path, name] = s.split('|'); await p.goto('http://localhost:3001' + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(1400); await p.screenshot({ path: `${S}/${name}.png`, fullPage: true }); }
console.log('errors', errs);
await b.close();
