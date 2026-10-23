import { db } from '../db/db.js';

export interface AuditEventParams {
  orgId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export class AuditService {
  public async logEvent(params: AuditEventParams): Promise<void> {
    try {
      await db.query(
        `INSERT INTO audit_logs (org_id, user_id, action, resource_type, resource_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          params.orgId,
          params.userId || null,
          params.action,
          params.resourceType,
          params.resourceId,
          JSON.stringify(params.details || {}),
          params.ipAddress || '127.0.0.1',
        ]
      );
    } catch (err: any) {
      console.error('[AuditService] Failed to record audit log:', err.message);
    }
  }

  public async logAction(params: {
    org_id: string;
    user_id?: string;
    action: string;
    resource_type: string;
    resource_id: string;
    details?: Record<string, any>;
    ip_address?: string;
  }): Promise<void> {
    return this.logEvent({
      orgId: params.org_id,
      userId: params.user_id,
      action: params.action,
      resourceType: params.resource_type,
      resourceId: params.resource_id,
      details: params.details,
      ipAddress: params.ip_address,
    });
  }

  public async getLogs(orgId: string, limit: number = 100, offset: number = 0, resourceType?: string): Promise<any[]> {
    let sql = `
      SELECT a.*, u.full_name as user_name, u.email as user_email, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.org_id = $1
    `;
    const params: any[] = [orgId];

    if (resourceType) {
      params.push(resourceType);
      sql += ` AND a.resource_type = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY a.created_at DESC LIMIT $${params.length}`;

    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const res = await db.query(sql, params);
    return res.rows;
  }
}

export const auditService = new AuditService();
