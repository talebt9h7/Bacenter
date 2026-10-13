import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { getIntegrations } from '@/lib/integrations';

export const dynamic = 'force-dynamic';
/**
 * Finds the chats that have messaged the bot (after the owner sends /start), so the chat ID
 * doesn't have to be looked up by hand. Uses the token sent by the editor, or the saved one.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('configuration', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const sent = typeof body.botToken === 'string' && !body.botToken.includes('••') ? body.botToken.trim() : '';
  const token = sent || (await getIntegrations()).telegram.botToken;
  if (!/^\d{5,15}:[A-Za-z0-9_-]{20,60}$/.test(token)) return NextResponse.json({ error: 'Add the bot token from @BotFather first.' }, { status: 400 });
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`, { signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    if (!data.ok) return NextResponse.json({ error: data.description || 'Telegram refused the token.' }, { status: 400 });
    const chats = new Map<string, { id: string; name: string; type: string }>();
    for (const update of data.result ?? []) {
      const chat = update.message?.chat ?? update.my_chat_member?.chat ?? update.channel_post?.chat;
      if (chat) chats.set(String(chat.id), { id: String(chat.id), name: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || String(chat.id), type: chat.type });
    }
    return NextResponse.json({ chats: [...chats.values()] });
  } catch { return NextResponse.json({ error: 'Could not reach Telegram. Try again.' }, { status: 502 }); }
}
