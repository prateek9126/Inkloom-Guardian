import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/db.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { upload, extractContentFromFile } from '../middleware/upload.js';
import { claimVerificationService } from '../services/claimVerificationService.js';
import { auditService } from '../services/auditService.js';

const router = Router();

/**
 * List approved evidence sources
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const { documentType, isOutdated, search } = req.query;

    let sql = `
      SELECT es.*,
             COUNT(sp.id)::int as passages_count
      FROM evidence_sources es
      LEFT JOIN source_passages sp ON es.id = sp.document_id
      WHERE es.org_id = $1
    `;
    const params: any[] = [orgId];

    if (documentType) {
      params.push(documentType);
      sql += ` AND es.document_type = $${params.length}`;
    }

    if (isOutdated !== undefined) {
      params.push(isOutdated === 'true');
      sql += ` AND es.is_outdated = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (es.title ILIKE $${params.length} OR es.raw_content ILIKE $${params.length})`;
    }

    sql += ' GROUP BY es.id ORDER BY es.effective_date DESC';

    const result = await db.query(sql, params);
    res.json({ sources: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch evidence sources: ' + err.message });
  }
});

/**
 * Get single evidence source with all passages
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.org_id;

    const sourceRes = await db.query(
      'SELECT * FROM evidence_sources WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (sourceRes.rows.length === 0) {
      res.status(404).json({ error: 'Evidence source document not found.' });
      return;
    }

    const passagesRes = await db.query(
      'SELECT * FROM source_passages WHERE document_id = $1 ORDER BY passage_index ASC',
      [id]
    );

    res.json({
      source: sourceRes.rows[0],
      passages: passagesRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch evidence source details: ' + err.message });
  }
});

/**
 * Upload / create approved evidence source document
 */
router.post(
  '/',
  authenticate,
  authorizeRoles('admin', 'compliance_officer', 'brand_manager'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.org_id;
      const userId = req.user!.id;
      const {
        title,
        document_type = 'audit_report',
        version = '1.0',
        effective_date,
        expiration_date,
        is_outdated = 'false',
      } = req.body;

      let raw_content = req.body.raw_content || '';
      let file_path: string | null = null;
      let file_hash: string | null = null;

      if (req.file) {
        file_path = `/uploads/${req.file.filename}`;
        const extracted = await extractContentFromFile(req.file.path, req.file.originalname);
        if (!raw_content || raw_content.trim().length === 0) {
          raw_content = extracted;
        }
        file_hash = crypto.createHash('sha256').update(raw_content).digest('hex');
      }

      if (!title || !raw_content || !effective_date) {
        res.status(400).json({ error: 'Title, effective date, and raw content (or uploaded file) are required.' });
        return;
      }

      // Insert source document
      const docRes = await db.query(
        `INSERT INTO evidence_sources
          (org_id, title, document_type, version, is_outdated, effective_date, expiration_date, file_path, file_hash, raw_content)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          orgId,
          title.trim(),
          document_type,
          version.trim(),
          is_outdated === 'true' || is_outdated === true,
          effective_date,
          expiration_date || null,
          file_path,
          file_hash,
          raw_content.trim(),
        ]
      );
      const document = docRes.rows[0];

      // Parse and chunk into passages
      const passages = claimVerificationService.chunkDocumentIntoPassages(raw_content);
      for (const p of passages) {
        await db.query(
          `INSERT INTO source_passages (document_id, passage_index, page_number, section_header, content)
           VALUES ($1, $2, $3, $4, $5)`,
          [document.id, p.passage_index, p.page_number, p.section_header || null, p.content]
        );
      }

      await auditService.logEvent({
        orgId,
        userId,
        action: 'SOURCE_DOCUMENT_UPLOADED',
        resourceType: 'evidence',
        resourceId: document.id,
        details: { title: document.title, type: document.document_type, passagesCount: passages.length },
        ipAddress: req.ip,
      });

      res.status(201).json({
        source: document,
        passagesCount: passages.length,
      });
    } catch (err: any) {
      console.error('[Evidence Upload Error]:', err);
      res.status(500).json({ error: 'Failed to upload evidence document: ' + err.message });
    }
  }
);

/**
 * Update evidence source metadata or toggle outdated status
 */
router.put(
  '/:id',
  authenticate,
  authorizeRoles('admin', 'compliance_officer', 'brand_manager'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const orgId = req.user!.org_id;
      const userId = req.user!.id;
      const { title, document_type, version, is_outdated, effective_date, expiration_date } = req.body;

      const check = await db.query('SELECT * FROM evidence_sources WHERE id = $1 AND org_id = $2', [id, orgId]);
      if (check.rows.length === 0) {
        res.status(404).json({ error: 'Evidence source not found.' });
        return;
      }

      const result = await db.query(
        `UPDATE evidence_sources
         SET title = COALESCE($1, title),
             document_type = COALESCE($2, document_type),
             version = COALESCE($3, version),
             is_outdated = COALESCE($4, is_outdated),
             effective_date = COALESCE($5, effective_date),
             expiration_date = COALESCE($6, expiration_date),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 AND org_id = $8
         RETURNING *`,
        [
          title ? title.trim() : null,
          document_type || null,
          version ? version.trim() : null,
          is_outdated !== undefined ? is_outdated : null,
          effective_date || null,
          expiration_date || null,
          id,
          orgId,
        ]
      );

      await auditService.logEvent({
        orgId,
        userId,
        action: 'SOURCE_DOCUMENT_UPDATED',
        resourceType: 'evidence',
        resourceId: id,
        details: { title: result.rows[0].title, isOutdated: result.rows[0].is_outdated },
        ipAddress: req.ip,
      });

      res.json({ source: result.rows[0] });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update evidence document: ' + err.message });
    }
  }
);

/**
 * Delete evidence source and cascading passages
 */
router.delete(
  '/:id',
  authenticate,
  authorizeRoles('admin', 'compliance_officer', 'brand_manager'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const orgId = req.user!.org_id;
      const userId = req.user!.id;

      const check = await db.query('SELECT title FROM evidence_sources WHERE id = $1 AND org_id = $2', [id, orgId]);
      if (check.rows.length === 0) {
        res.status(404).json({ error: 'Evidence source not found.' });
        return;
      }

      await db.query('DELETE FROM evidence_sources WHERE id = $1 AND org_id = $2', [id, orgId]);

      await auditService.logEvent({
        orgId,
        userId,
        action: 'SOURCE_DOCUMENT_DELETED',
        resourceType: 'evidence',
        resourceId: id,
        details: { title: check.rows[0].title },
        ipAddress: req.ip,
      });

      res.json({ success: true, message: 'Evidence source and passages deleted.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete evidence source: ' + err.message });
    }
  }
);

export default router;
