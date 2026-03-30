import { prisma } from "@/app/lib/prisma";

interface AuditParams {
  adminId: string;
  adminEmail: string;
  action: string;
  targetId?: string;
  targetKind?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/**
 * Write an audit log entry for an admin action.
 * Fires-and-forgets — never throws so it cannot break a server action.
 */
export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        adminEmail: params.adminEmail,
        action: params.action,
        targetId: params.targetId ?? null,
        targetKind: params.targetKind ?? null,
        before: params.before ? JSON.stringify(params.before) : null,
        after: params.after ? JSON.stringify(params.after) : null,
      },
    });
  } catch {
    // Audit logging must never break the main operation
  }
}
