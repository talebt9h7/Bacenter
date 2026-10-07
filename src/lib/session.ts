import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';

export async function getSession() {
  const jar = await cookies();
  let id = jar.get('bellroy_session')?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = randomUUID();
    jar.set('bellroy_session', id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === 'production' });
  }
  return id;
}
