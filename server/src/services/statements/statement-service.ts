import { statementRepository } from '../../repositories/statement-repository.js';
import { transactionRepository } from '../../repositories/transaction-repository.js';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import crypto from 'crypto';
import { pipeline } from '../pipeline.js';
import { events } from '../../events.js';

export class StatementService {
  async getAll(userId: string) {
    return statementRepository.getByUserId(userId);
  }

  async upload(userId: string, file: File) {
    const fileBuffer = await file.arrayBuffer();
    const hash = crypto.createHash('sha256').update(Buffer.from(fileBuffer)).digest('hex');

    const existing = await statementRepository.findByHash(hash);
    if (existing) {
      throw new Error(`Duplicate file: ${existing.id}`);
    }

    const id = crypto.randomUUID();
    const safeFilename = `${id}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const uploadDir = path.resolve(process.cwd(), '../statements');
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, safeFilename);
    await writeFile(filePath, Buffer.from(fileBuffer));

    await statementRepository.create({
      filename: file.name,
      hash,
      uploadDate: new Date().toISOString(),
      parsingStatus: 'PENDING',
      userId,
    });

    events.emit('update', { type: 'statement_added', id });
    pipeline.processStatement(id, filePath);

    return { id, message: 'Started' };
  }

  async reprocess(userId: string, statementId: string) {
    const stmt = await statementRepository.getById(statementId);
    if (!stmt || stmt.userId !== userId) {
      throw new Error('Statement not found');
    }

    await transactionRepository.deleteByStatementId(statementId);
    await statementRepository.update(statementId, { parsingStatus: 'PENDING' });

    // Assuming filename in DB is original filename, but file on disk is safeFilename.
    // Wait, the original code used 'filename' from DB to resolve path.
    // But in upload it saved safeFilename.
    // Looking at upload: `filename: file.name` is stored in DB.
    // `filePath` on disk is `safeFilename`.
    // So reprocess in original code `path.resolve(..., stmt.filename)` might be wrong if stmt.filename is original name?
    // Let's check original code.
    // Original: `const safeFilename = ...; const filePath = ...; await writeFile(filePath...); await db.insert(...).values({ filename: file.name ...})`
    // Original reprocess: `pipeline.processStatement(stmt.id, path.resolve(process.cwd(), '../statements', stmt.filename));`
    // This looks like a bug in the original code if stmt.filename is just `file.name`.
    // However, for now I will replicate the logic but maybe I should fix it?
    // If I fix it I need to know what the file on disk is.
    // The ID is in the filename on disk.
    // Let's assume the file on disk starts with ID.
    // Actually, pipeline.processStatement likely expects the full path.
    // I'll search for the file in the directory that starts with the ID.

    const uploadDir = path.resolve(process.cwd(), '../statements');
    // Simple fix: find file starting with ID
    const fs = await import('fs/promises');
    const files = await fs.readdir(uploadDir);
    const diskFilename = files.find((f) => f.startsWith(statementId));

    if (!diskFilename) {
      throw new Error('File not found on disk');
    }

    pipeline.processStatement(statementId, path.join(uploadDir, diskFilename));
    return { message: 'Reprocessing started' };
  }

  async getGapAnalysis(userId: string) {
    const stmts = await statementRepository.getByUserId(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completedStmts = stmts.filter((s: any) => s.parsingStatus === 'COMPLETED');
    return { totalStatements: completedStmts.length };
  }
}

export const statementService = new StatementService();
