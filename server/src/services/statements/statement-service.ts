import { statementRepository } from '../../repositories/statement-repository.js';
import { transactionRepository } from '../../repositories/transaction-repository.js';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import crypto from 'crypto';
import { pipeline } from '../pipeline.js';
import { events } from '../../events.js';
import { DuplicateError, NotFoundError } from '../../errors.js';

export class StatementService {
  async getAll(userId: string) {
    return statementRepository.getByUserId(userId);
  }

  async upload(userId: string, file: File) {
    const fileBuffer = await file.arrayBuffer();
    const hash = crypto.createHash('sha256').update(Buffer.from(fileBuffer)).digest('hex');

    const existing = await statementRepository.findByHash(hash);
    if (existing) {
      throw new DuplicateError('Statement', 'hash', hash);
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
      throw new NotFoundError('Statement', statementId);
    }

    await transactionRepository.deleteByStatementId(statementId);
    await statementRepository.update(statementId, { parsingStatus: 'PENDING' });

    const uploadDir = path.resolve(process.cwd(), '../statements');
    const fs = await import('fs/promises');
    const files = await fs.readdir(uploadDir);
    const diskFilename = files.find((f) => f.startsWith(statementId));

    if (!diskFilename) {
      throw new NotFoundError('Statement file on disk', statementId);
    }

    pipeline.processStatement(statementId, path.join(uploadDir, diskFilename));
    return { message: 'Reprocessing started' };
  }

  async getGapAnalysis(userId: string) {
    const stmts = await statementRepository.getByUserId(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completedStmts = stmts.filter((s: Record<string, unknown>) => s.parsingStatus === 'COMPLETED');
    return { totalStatements: completedStmts.length };
  }
}

export const statementService = new StatementService();
