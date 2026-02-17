/**
 * BAS available quarters — delegates to parent BASService.
 */
import { BASService } from '../bas.js';

const _svc = new BASService();

export async function getAvailableQuarters(
  userId: string,
): Promise<Array<{ financialYear: string; quarter: number }>> {
  return _svc.getAvailableQuarters(userId);
}
