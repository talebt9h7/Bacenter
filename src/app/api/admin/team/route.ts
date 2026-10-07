import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { adminUsers } from '@/db/schema';
import { hashPassword, permissionsForRole, requireAdminSection, ROLE_DEFAULTS } from '@/lib/admin-auth';
import { logActivity } from '@/lib/activity-log';

export const dynamic = 'force-dynamic';

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
      const view = manage || p.view === true;
      result[key] = { view, manage };
    }
  }
  return result;
}

export async function GET() {
  const actor = await requireAdminSection('team', 'view');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await db.select({
    id: adminUsers.id, username: adminUsers.username, name: adminUsers.name,
    role: adminUsers.role, permissions: adminUsers.permissions, active: adminUsers.active,
    lastLoginAt: adminUsers.lastLoginAt, createdAt: adminUsers.createdAt,
  }).from(adminUsers).orderBy(asc(adminUsers.name));
  return NextResponse.json({ items: rows, roles });
}

export async function POST(request: NextRequest) {
  const actor = await requireAdminSection('team', 'manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const role = typeof body.role === 'string' && roles.includes(body.role) ? body.role : 'manager';
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return NextResponse.json({ error: 'Username must be 3–40 characters and use letters, numbers, dot, dash or underscore.' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  const permissions = cleanPermissions(body.permissions) || permissionsForRole(role);
  try {
    const [row] = await db.insert(adminUsers).values({
      username, name, passwordHash: hashPassword(password), role, permissions,
      active: body.active !== false,
    }).returning({
      id: adminUsers.id, username: adminUsers.username, name: adminUsers.name,
      role: adminUsers.role, permissions: adminUsers.permissions, active: adminUsers.active,
      lastLoginAt: adminUsers.lastLoginAt, createdAt: adminUsers.createdAt,
    });
    await logActivity(actor, 'create', 'admin_user', row.id, `Created team member ${row.name} (@${row.username})`);
    return NextResponse.json({ item: row }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) return NextResponse.json({ error: 'That username is already in use.' }, { status: 409 });
    console.error(error); return NextResponse.json({ error: 'The user could not be created.' }, { status: 500 });
  }
}
