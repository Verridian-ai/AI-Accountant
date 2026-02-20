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
      id,
      filename: file.name,
      hash,
      uploadDate: new Date().toISOString(),
      parsingStatus: 'PENDING',
      userId,
    });

    events.emit('update', { type: 'statement_added', id });
    pipeline.processStatement(id, filePath).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[StatementService] Pipeline processing failed for ${id}: ${msg}`);
    });

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

    pipeline
      .processStatement(statementId, path.join(uploadDir, diskFilename))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[StatementService] Reprocess pipeline failed for ${statementId}: ${msg}`);
      });
    return { message: 'Reprocessing started' };
  }

  async getGapAnalysis(userId: string) {
    const stmts = await statementRepository.getByUserId(userId);

    const completedStmts = stmts
      .filter(
        (s) =>
          s.parsingStatus === 'COMPLETED' &&
          s.periodStartDate != null &&
          s.periodEndDate != null,
      )
      .sort((a, b) => {
        const aStart = a.periodStartDate ?? '';
        const bStart = b.periodStartDate ?? '';
        return aStart.localeCompare(bStart);
      });

    // Find gaps between consecutive statement periods
    const gaps: Array<{ from: string; to: string; daysMissing: number }> = [];

    for (let i = 1; i < completedStmts.length; i++) {
      const prevEnd = new Date(completedStmts[i - 1].periodEndDate!);
      const currStart = new Date(completedStmts[i].periodStartDate!);
      const daysDiff = Math.floor(
        (currStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff > 1) {
        gaps.push({
          from: completedStmts[i - 1].periodEndDate!,
          to: completedStmts[i].periodStartDate!,
          daysMissing: daysDiff - 1,
        });
      }
    }

    return {
      totalStatements: completedStmts.length,
      gaps,
      coverageFromDate: completedStmts[0]?.periodStartDate ?? null,
      coverageToDate: completedStmts[completedStmts.length - 1]?.periodEndDate ?? null,
      hasGaps: gaps.length > 0,
    };
  }
}

export const statementService = new StatementService();
