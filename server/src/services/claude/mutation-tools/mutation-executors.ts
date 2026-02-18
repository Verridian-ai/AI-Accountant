/**
 * MutationTools — SQL execution helpers (UPDATE / CREATE / DELETE / BATCH)
 */

import type { MutationDb } from './mutation-validators.js';
import { validateTableName, validateColumnNames } from './mutation-validators.js';

export async function executeUpdate(
  db: MutationDb,
  table: string,
  targetId: string,
  afterState: Record<string, unknown>,
): Promise<number> {
  validateTableName(table);
  const columns = Object.keys(afterState);
  validateColumnNames(columns);
  const setClause = columns.map((col) => `${col} = ?`).join(', ');
  const result = await db.run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [
    ...columns.map((col) => afterState[col]),
    targetId,
  ]);
  return result?.changes ?? 1;
}

export async function executeCreate(
  db: MutationDb,
  table: string,
  afterState: Record<string, unknown>,
): Promise<number> {
  validateTableName(table);
  const columns = Object.keys(afterState);
  validateColumnNames(columns);
  const placeholders = columns.map(() => '?').join(', ');
  await db.run(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    columns.map((col) => afterState[col]),
  );
  return 1;
}

export async function executeDelete(
  db: MutationDb,
  table: string,
  targetId: string,
): Promise<number> {
  validateTableName(table);
  const result = await db.run(`DELETE FROM ${table} WHERE id = ?`, [targetId]);
  return result?.changes ?? 1;
}

export async function executeBatchUpdate(
  db: MutationDb,
  table: string,
  targetIds: string[],
  afterState: Record<string, unknown>,
): Promise<number> {
  validateTableName(table);
  validateColumnNames(Object.keys(afterState));
  let totalAffected = 0;
  for (const id of targetIds) {
    totalAffected += await executeUpdate(db, table, id, afterState);
  }
  return totalAffected;
}
