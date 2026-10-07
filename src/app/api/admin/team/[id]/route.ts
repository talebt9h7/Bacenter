import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { adminUsers } from '@/db/schema';
import { hashPassword, permissionsForRole, requireAdminSection, ROLE_DEFAULTS } from '@/lib/admin-auth';
import { logActivity } from '@/lib/activity-log';

type Context = { params: Promise<{ id: string }> };
const roles = Object.keys(ROLE_DEFAULTS);

function cleanPermissions(value: unknown) {
  if (!value || typeof value !== 'object') return {};
  const input = value as Record<string, unknown>;
  const result: Record<string, { view: boolean; manage: boolean }> = {};
  for (const key of Object.keys(ROLE_DEFAULTS.manager)) {
    const item = input[key];
    if (item && typeof item === 'object') {
      const p = item as Record<string, unknown>;
      const manage = p.manage === true;
      result[key] = { view: manage || p.view === true, manage };
    }
  }
  return result;
}

export async function PUT(request: NextRequest, { params }: Context) {
  const actor = await requireAdminSection('team', 'manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid user.' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const role = typeof body.role === 'string' && roles.includes(body.role) ? body.role : 'manager';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!name || !/^[a-z0-9._-]{3,40}$/.test(username)) return NextResponse.json({ error: 'Valid name and username are required.' }, { status: 400 });
  if (password && password.length < 8) return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  const permissions = cleanPermissions(body.permissions);
  const values = {
    name,
    username,
    role,
    permissions: Object.keys(permissions).length ? permissions : permissionsForRole(role),
    active: body.active !== false,
    updatedAt: new Date(),
    ...(password ? { passwordHash: hashPassword(password) } : {}),
  };
  try {
    const [row] = await db.update(adminUsers).set(values).where(eq(adminUsers.id, id)).returning({
      id: adminUsers.id, username: adminUsers.username, name: adminUsers.name,
      role: adminUsers.role, permissions: adminUsers.permissions, active: adminUsers.active,
      lastLoginAt: adminUsers.lastLoginAt, createdAt: adminUsers.createdAt,
    });
    if (!row) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    await logActivity(actor, 'update', 'admin_user', row.id, `Updated team member ${row.name} (@${row.username})`);
    return NextResponse.json({ item: row });
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) return NextResponse.json({ error: 'That username is already in use.' }, { status: 409 });
    console.error(error); return NextResponse.json({ error: 'The user could not be saved.' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const actor = await requireAdminSection('team', 'manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid user.' }, { status: 400 });
  if (actor.type === 'user' && actor.id === id) return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  const [target] = await db.select({ id: adminUsers.id, name: adminUsers.name, username: adminUsers.username }).from(adminUsers).where(eq(adminUsers.id, id));
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  const [row] = await db.delete(adminUsers).where(eq(adminUsers.id, id)).returning({ id: adminUsers.id });
  if (!row) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  await logActivity(actor, 'delete', 'admin_user', row.id, `Deleted team member ${target.name} (@${target.username})`);
  return NextResponse.json({ ok: true });
}
