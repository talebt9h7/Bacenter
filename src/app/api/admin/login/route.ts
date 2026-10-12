import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, authenticateTeamUser, createOwnerSessionToken, createUserSessionToken, ownerPasswordMatches } from '@/lib/admin-auth';
import { clearFailures, clientIp, isLockedOut, recordFailure, throttleKeys } from '@/lib/login-throttle';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === 'string' ? body.password.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const keys = throttleKeys(clientIp(request.headers), username);

  if (await isLockedOut(keys)) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }

  let tokenData: { token: string; maxAge: number } | null = null;
  if (!username) {
    if (password && password.length <= 200 && await ownerPasswordMatches(password)) tokenData = createOwnerSessionToken();
  } else {
    const user = password.length <= 200 ? await authenticateTeamUser(username, password) : null;
    if (user) tokenData = createUserSessionToken(user.id);
  }

  if (!tokenData) {
    await recordFailure(keys);
    return NextResponse.json({ error: 'The username or password is incorrect.' }, { status: 401 });
  }

  await clearFailures(keys);
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
