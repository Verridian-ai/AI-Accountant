/** Expected annual returns by risk profile */
export const RISK_PROFILE_RETURNS: Record<string, number> = {
  conservative: 0.04,
  balanced: 0.06,
  growth: 0.08,
  aggressive: 0.1,
};

/** 50/30/20 budget rule variants by risk profile */
export const BUDGET_RULES: Record<string, { needs: number; wants: number; savings: number }> = {
  conservative: { needs: 50, wants: 20, savings: 30 },
  balanced: { needs: 50, wants: 30, savings: 20 },
  growth: { needs: 50, wants: 25, savings: 25 },
  aggressive: { needs: 45, wants: 20, savings: 35 },
};
