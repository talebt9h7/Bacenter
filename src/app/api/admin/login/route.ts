import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, authenticateTeamUser, createOwnerSessionToken, createUserSessionToken, ownerPasswordMatches } from '@/lib/admin-auth';

const attempts = new Map<string, { count: number; until: number }>();

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const record = attempts.get(ip);
  if (record && record.count >= 8 && record.until > Date.now()) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === 'string' ? body.password.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim() : '';

  let tokenData: { token: string; maxAge: number } | null = null;
  if (!username) {
    if (password && password.length <= 200 && await ownerPasswordMatches(password)) tokenData = createOwnerSessionToken();
  } else {
    const user = password.length <= 200 ? await authenticateTeamUser(username, password) : null;
    if (user) tokenData = createUserSessionToken(user.id);
  }

  if (!tokenData) {
    attempts.set(ip, { count: (record?.until ?? 0) > Date.now() ? (record?.count ?? 0) + 1 : 1, until: Date.now() + 10 * 60 * 1000 });
    return NextResponse.json({ error: 'The username or password is incorrect.' }, { status: 401 });
  }

  attempts.delete(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, tokenData.token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: tokenData.maxAge,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
