import { db } from '@/db';
import { activityLog } from '@/db/schema';
import type { AdminActor } from '@/lib/admin-auth';

export async function logActivity(actor: AdminActor | null, action: string, entity: string, entityId?: string | number | null, details?: string | null) {
  try {
    const actorLabel = actor ? `${actor.name} (${actor.username})` : 'System';
    const safeDetails = details ? `${actorLabel} — ${details}` : actorLabel;
    await db.insert(activityLog).values({
      action: action.slice(0, 120),
      entity: entity.slice(0, 120),
      entityId: entityId == null ? null : String(entityId),
      details: safeDetails.slice(0, 1000),
    });
  } catch (error) {
    console.error('Activity log failed:', error);
  }
}
