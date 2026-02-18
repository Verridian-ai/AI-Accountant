export interface MergedPoint {
  date: string;
  timestamp: number;
  balances: Record<string, number>;
  sources: Record<string, string>;
}
