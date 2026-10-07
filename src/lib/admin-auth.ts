import { cookies } from 'next/headers';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { adminUsers, settings } from '@/db/schema';

export const ADMIN_COOKIE = 'bellroy_admin';
const SESSION_HOURS = 12;

export type PermissionLevel = 'view' | 'manage';
export type AdminSection = 'overview' | 'sales' | 'catalog' | 'storefront' | 'finance' | 'configuration' | 'team';
export type AdminPermissions = Partial<Record<AdminSection, { view: boolean; manage: boolean }>>;
export type AdminActor =
  | { type: 'owner'; id: null; username: 'owner'; name: string; role: 'owner'; permissions: Record<AdminSection, { view: true; manage: true }> }
  | { type: 'user'; id: number; username: string; name: string; role: string; permissions: AdminPermissions };

export const SECTION_LABELS: Record<AdminSection, string> = {
  overview: 'Overview',
  sales: 'Sales',
  catalog: 'Catalog',
  storefront: 'Storefront',
  finance: 'Finance',
  configuration: 'Configuration',
  team: 'Team & Permissions',
};

export const ROLE_DEFAULTS: Record<string, AdminPermissions> = {
  manager: {
    overview: { view: true, manage: true },
    sales: { view: true, manage: true },
    catalog: { view: true, manage: true },
    storefront: { view: true, manage: true },
    finance: { view: true, manage: true },
    configuration: { view: true, manage: true },
    team: { view: true, manage: true },
  },
  sales: {
    overview: { view: true, manage: false },
    sales: { view: true, manage: true },
    catalog: { view: true, manage: false },
  },
  inventory: {
    overview: { view: true, manage: false },
    catalog: { view: true, manage: true },
  },
  content: {
    overview: { view: true, manage: false },
    storefront: { view: true, manage: true },
  },
  accountant: {
    overview: { view: true, manage: false },
    sales: { view: true, manage: false },
    finance: { view: true, manage: true },
    configuration: { view: true, manage: false },
  },
};

export const DEFAULT_ADMIN_PASSWORD = 'bellroy-admin';
function adminPassword() { return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD; }
export async function usingDefaultPassword() { return !process.env.ADMIN_PASSWORD && !(await storedHash()); }
function secret() { return process.env.ADMIN_SESSION_SECRET || `${adminPassword()}::bellroy-admin-session`; }

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

async function storedHash() {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, 'adminPasswordHash'));
    return typeof row?.value === 'string' ? row.value : null;
  } catch {
    return null;
  }
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyHash(candidate: string, hash: string) {
  const [salt, digest] = hash.split(':');
  if (!salt || !digest) return false;
  try {
    return safeEqual(scryptSync(candidate, salt, 64).toString('hex'), digest);
  } catch {
    return false;
  }
}

export async function ownerPasswordMatches(candidate: string) {
  const hash = await storedHash();
  if (hash) return verifyHash(candidate, hash);
  return safeEqual(adminPassword(), candidate);
}

function createToken(payload: string) {
  const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
  const body = `${payload}:${expires}`;
  return { token: `${body}.${sign(body)}`, maxAge: SESSION_HOURS * 3600 };
}

export function createOwnerSessionToken() {
  return createToken('owner');
}

export function createUserSessionToken(userId: number) {
  return createToken(`user:${userId}`);
}

export function verifySessionToken(token?: string) {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const colon = body.lastIndexOf(':');
  const expires = Number(body.slice(colon + 1));
  if (!Number.isFinite(expires) || expires < Date.now() || !signature) return null;
  if (!safeEqual(sign(body), signature)) return null;
  const identity = body.slice(0, colon);
  if (identity === 'owner') return { type: 'owner' as const };
  const match = identity.match(/^user:(\d+)$/);
  return match ? { type: 'user' as const, id: Number(match[1]) } : null;
}

export async function getAdminActor(): Promise<AdminActor | null> {
  const jar = await cookies();
  const identity = verifySessionToken(jar.get(ADMIN_COOKIE)?.value);
  if (!identity) return null;
  if (identity.type === 'owner') {
    return {
      type: 'owner',
      id: null,
      username: 'owner',
      name: 'Store Owner',
      role: 'owner',
      permissions: {
        overview: { view: true, manage: true },
        sales: { view: true, manage: true },
        catalog: { view: true, manage: true },
        storefront: { view: true, manage: true },
        finance: { view: true, manage: true },
        configuration: { view: true, manage: true },
        team: { view: true, manage: true },
      },
    };
  }
  const [user] = await db.select().from(adminUsers).where(and(eq(adminUsers.id, identity.id), eq(adminUsers.active, true)));
  if (!user) return null;
  return { type: 'user', id: user.id, username: user.username, name: user.name, role: user.role, permissions: user.permissions || {} };
}

export async function isAdmin() {
  return !!(await getAdminActor());
}

export async function requireAdminSection(section: AdminSection, level: PermissionLevel = 'view') {
  const actor = await getAdminActor();
  if (!actor) return null;
  if (actor.type === 'owner') return actor;
  const permission = actor.permissions[section];
  if (!permission?.view) return null;
  if (level === 'manage' && !permission.manage) return null;
  return actor;
}

export function permissionsForRole(role: string): AdminPermissions {
  return JSON.parse(JSON.stringify(ROLE_DEFAULTS[role] || {}));
}

export async function authenticateTeamUser(username: string, password: string) {
  const normalized = username.trim().toLowerCase();
  if (!normalized || !password) return null;
  const [user] = await db.select().from(adminUsers).where(and(eq(adminUsers.username, normalized), eq(adminUsers.active, true)));
  if (!user || !verifyHash(password, user.passwordHash)) return null;
  await db.update(adminUsers).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(adminUsers.id, user.id));
  return user;
}
