/**
 * BAS (Business Activity Statement) Service
 * TypeScript service for Australian BAS calculations and management
 */

import { db, transactions, basPeriods, basCalculations, taxCodes } from '../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';

// GST Categories
export enum GSTCategory {
    TAXABLE_10 = 'taxable_10',
    GST_FREE = 'gst_free',
    INPUT_TAXED = 'input_taxed',
    EXPORT = 'export',
    CAPITAL = 'capital',
    PRIVATE = 'private',
}

// BAS Quarter dates
export interface QuarterDates {
    startDate: string;
    endDate: string;
    lodgementDue: string;
}

// BAS Labels interface
export interface BASLabels {
    G1: number;  // Total sales
    G2: number;  // Export sales
    G3: number;  // Other GST-free sales
    G10: number; // Capital purchases
    G11: number; // Non-capital purchases
    '1A': number; // GST on sales
    '1B': number; // GST on purchases
    W1: number;  // Total wages
    W2: number;  // Amounts withheld
    '5A': number; // PAYG instalment
    '7C': number; // Fuel tax credits - business
    '7D': number; // Fuel tax credits - other
}

// BAS Calculation Result
export interface BASResult {
    period: {
        financialYear: string;
        quarter: number;
        startDate: string;
        endDate: string;
        lodgementDue: string;
    };
    labels: BASLabels;
    netGst: number;
    fuelTaxCredits: number;
    totalPayable: number;
    isRefund: boolean;
    transactionCount: number;
}

/**
 * Get quarter dates for Australian financial year
 */
export function getQuarterDates(financialYear: string, quarter: number): QuarterDates {
    const startYear = parseInt(financialYear.split('-')[0]);

    const quarterDates: Record<number, QuarterDates> = {
        1: {
            startDate: `${startYear}-07-01`,
            endDate: `${startYear}-09-30`,
            lodgementDue: `${startYear}-10-28`,
        },
        2: {
            startDate: `${startYear}-10-01`,
            endDate: `${startYear}-12-31`,
            lodgementDue: `${startYear + 1}-02-28`,
        },
        3: {
            startDate: `${startYear + 1}-01-01`,
            endDate: `${startYear + 1}-03-31`,
            lodgementDue: `${startYear + 1}-04-28`,
        },
        4: {
            startDate: `${startYear + 1}-04-01`,
            endDate: `${startYear + 1}-06-30`,
            lodgementDue: `${startYear + 1}-07-28`,
        },
    };

    return quarterDates[quarter] || { startDate: '', endDate: '', lodgementDue: '' };
}

/**
 * Get current Australian financial year
 */
export function getCurrentFinancialYear(): string {
    const today = new Date();
    const month = today.getMonth() + 1; // 1-12
    const year = today.getFullYear();

    if (month >= 7) {
        return `${year}-${(year + 1).toString().slice(2)}`;
    } else {
        return `${year - 1}-${year.toString().slice(2)}`;
    }
}

/**
 * Get current BAS quarter
 */
export function getCurrentQuarter(): { financialYear: string; quarter: number } {
    const today = new Date();
    const month = today.getMonth() + 1;
    const financialYear = getCurrentFinancialYear();

    if (month >= 7 && month <= 9) return { financialYear, quarter: 1 };
    if (month >= 10 && month <= 12) return { financialYear, quarter: 2 };
    if (month >= 1 && month <= 3) return { financialYear, quarter: 3 };
    return { financialYear, quarter: 4 };
}

/**
 * Calculate GST from GST-inclusive amount
 */
export function calculateGstFromInclusive(amountCents: number, gstRate: number = 0.10): number {
    if (gstRate === 0) return 0;
    return Math.round(Math.abs(amountCents) * gstRate / (1 + gstRate));
}

/**
 * BAS Service class
 */
export class BASService {
    /**
     * Get or create a BAS period
     */
    async getOrCreatePeriod(
        userId: string,
        financialYear: string,
        quarter: number,
        accountingMethod: string = 'accrual'
    ) {
        // Check if period exists
        const existing = await db
            .select()
            .from(basPeriods)
            .where(
                and(
                    eq(basPeriods.userId, userId),
                    eq(basPeriods.financialYear, financialYear),
                    eq(basPeriods.quarter, quarter)
                )
            )
            .get();

        if (existing) {
            return existing;
        }

        // Create new period
        const dates = getQuarterDates(financialYear, quarter);
        const now = new Date().toISOString();

        const newPeriod = {
            id: crypto.randomUUID(),
            userId,
            financialYear,
            quarter,
            startDate: dates.startDate,
            endDate: dates.endDate,
            lodgementDue: dates.lodgementDue,
            status: 'draft',
            accountingMethod,
            createdAt: now,
            updatedAt: now,
        };

        await db.insert(basPeriods).values(newPeriod);
        return newPeriod;
    }

    /**
     * Get all BAS periods for a user
     */
    async getUserPeriods(userId: string) {
        return db
            .select()
            .from(basPeriods)
            .where(eq(basPeriods.userId, userId))
            .orderBy(sql`${basPeriods.financialYear} DESC, ${basPeriods.quarter} DESC`)
            .all();
    }

    /**
     * Calculate BAS for a quarter
     */
    async calculateBAS(
        userId: string,
        financialYear: string,
        quarter: number,
        accountingMethod: string = 'accrual'
    ): Promise<BASResult> {
        const dates = getQuarterDates(financialYear, quarter);

        // Get transactions for the quarter
        const quarterTransactions = await db
            .select()
            .from(transactions)
            .where(
                and(
                    eq(transactions.userId, userId),
                    gte(transactions.date, dates.startDate),
                    lte(transactions.date, dates.endDate),
                    eq(transactions.isTransfer, false) // Exclude transfers
                )
            )
            .all();

        // Initialize BAS labels
        const labels: BASLabels = {
            G1: 0, G2: 0, G3: 0, G10: 0, G11: 0,
            '1A': 0, '1B': 0,
            W1: 0, W2: 0, '5A': 0,
            '7C': 0, '7D': 0,
        };

        // Process transactions
        for (const tx of quarterTransactions) {
            const amount = tx.amount;
            const gstCategory = (tx.gstCategory as GSTCategory) || GSTCategory.TAXABLE_10;
            const gstAmount = tx.gstAmount || calculateGstFromInclusive(amount);

            if (amount > 0) {
                // Income/Sales
                switch (gstCategory) {
                    case GSTCategory.EXPORT:
                        labels.G2 += amount;
                        break;
                    case GSTCategory.GST_FREE:
                        labels.G3 += amount;
                        break;
                    case GSTCategory.INPUT_TAXED:
                    case GSTCategory.PRIVATE:
                        // Not reported on BAS
                        break;
                    default:
                        labels.G1 += amount;
                        labels['1A'] += gstAmount;
                }
            } else {
                // Expenses/Purchases
                const absAmount = Math.abs(amount);
                switch (gstCategory) {
                    case GSTCategory.CAPITAL:
                        labels.G10 += absAmount;
                        labels['1B'] += gstAmount;
                        break;
                    case GSTCategory.INPUT_TAXED:
                    case GSTCategory.PRIVATE:
                        // No GST claim
                        break;
                    case GSTCategory.GST_FREE:
                        // No GST to claim, but still business expense
                        break;
                    default:
                        labels.G11 += absAmount;
                        labels['1B'] += gstAmount;
                }
            }
        }

        // Calculate totals
        const netGst = labels['1A'] - labels['1B'];
        const fuelTaxCredits = labels['7C'] + labels['7D'];
        const totalPayable = netGst + labels.W2 + labels['5A'] - fuelTaxCredits;

        return {
            period: {
                financialYear,
                quarter,
                startDate: dates.startDate,
                endDate: dates.endDate,
                lodgementDue: dates.lodgementDue,
            },
            labels,
            netGst,
            fuelTaxCredits,
            totalPayable,
            isRefund: totalPayable < 0,
            transactionCount: quarterTransactions.length,
        };
    }

    /**
     * Save BAS calculation
     */
    async saveBASCalculation(
        userId: string,
        financialYear: string,
        quarter: number,
        result: BASResult
    ) {
        // Get or create period
        const period = await this.getOrCreatePeriod(userId, financialYear, quarter);
        const now = new Date().toISOString();

        // Check for existing calculation
        const existing = await db
            .select()
            .from(basCalculations)
            .where(eq(basCalculations.basPeriodId, period.id))
            .get();

        const calculationData = {
            labelG1: result.labels.G1,
            labelG2: result.labels.G2,
            labelG3: result.labels.G3,
            labelG10: result.labels.G10,
            labelG11: result.labels.G11,
            label1A: result.labels['1A'],
            label1B: result.labels['1B'],
            labelW1: result.labels.W1,
            labelW2: result.labels.W2,
            label5A: result.labels['5A'],
            label7C: result.labels['7C'],
            label7D: result.labels['7D'],
            netGst: result.netGst,
            fuelTaxCredit: result.fuelTaxCredits,
            totalPayable: result.totalPayable,
            calculationNotes: JSON.stringify({
                transactionCount: result.transactionCount,
                calculatedAt: now,
            }),
            updatedAt: now,
        };

        if (existing) {
            await db
                .update(basCalculations)
                .set(calculationData)
                .where(eq(basCalculations.id, existing.id));
            return { ...existing, ...calculationData };
        } else {
            const newCalc = {
                id: crypto.randomUUID(),
                basPeriodId: period.id,
                ...calculationData,
                createdAt: now,
            };
            await db.insert(basCalculations).values(newCalc);
            return newCalc;
        }
    }

    /**
     * Get saved BAS calculation
     */
    async getSavedBASCalculation(userId: string, financialYear: string, quarter: number) {
        const period = await db
            .select()
            .from(basPeriods)
            .where(
                and(
                    eq(basPeriods.userId, userId),
                    eq(basPeriods.financialYear, financialYear),
                    eq(basPeriods.quarter, quarter)
                )
            )
            .get();

        if (!period) return null;

        const calculation = await db
            .select()
            .from(basCalculations)
            .where(eq(basCalculations.basPeriodId, period.id))
            .get();

        return calculation ? { period, calculation } : null;
    }

    /**
     * Update BAS period status
     */
    async updatePeriodStatus(
        periodId: string,
        status: 'draft' | 'ready' | 'lodged' | 'amended',
        lodgementDate?: string
    ) {
        const updateData: any = {
            status,
            updatedAt: new Date().toISOString(),
        };

        if (lodgementDate) {
            updateData.lodgementDate = lodgementDate;
        }

        await db
            .update(basPeriods)
            .set(updateData)
            .where(eq(basPeriods.id, periodId));
    }

    /**
     * Get tax codes
     */
    async getTaxCodes() {
        return db.select().from(taxCodes).all();
    }

    /**
     * Batch update GST categories for transactions
     */
    async batchUpdateGSTCategories(
        updates: Array<{
            transactionId: string;
            gstCategory: GSTCategory;
            gstAmount: number;
        }>
    ) {
        for (const update of updates) {
            await db
                .update(transactions)
                .set({
                    gstCategory: update.gstCategory,
                    gstAmount: update.gstAmount,
                    isEdited: true,
                })
                .where(eq(transactions.id, update.transactionId));
        }
    }

    /**
     * Get available quarters for a user (based on transaction dates)
     */
    async getAvailableQuarters(userId: string): Promise<Array<{ financialYear: string; quarter: number }>> {
        // Get min and max transaction dates
        const result = await db
            .select({
                minDate: sql<string>`MIN(${transactions.date})`,
                maxDate: sql<string>`MAX(${transactions.date})`,
            })
            .from(transactions)
            .where(eq(transactions.userId, userId))
            .get();

        if (!result?.minDate || !result?.maxDate) {
            return [];
        }

        const quarters: Array<{ financialYear: string; quarter: number }> = [];
        const minDate = new Date(result.minDate);
        const maxDate = new Date(result.maxDate);

        // Iterate through each quarter from min to max date
        let current = new Date(minDate);
        while (current <= maxDate) {
            const month = current.getMonth() + 1;
            const year = current.getFullYear();

            let financialYear: string;
            let quarter: number;

            if (month >= 7) {
                financialYear = `${year}-${(year + 1).toString().slice(2)}`;
                if (month >= 7 && month <= 9) quarter = 1;
                else quarter = 2;
            } else {
                financialYear = `${year - 1}-${year.toString().slice(2)}`;
                if (month >= 1 && month <= 3) quarter = 3;
                else quarter = 4;
            }

            // Check if already added
            if (!quarters.some(q => q.financialYear === financialYear && q.quarter === quarter)) {
                quarters.push({ financialYear, quarter });
            }

            // Move to next quarter
            current.setMonth(current.getMonth() + 3);
        }

        return quarters;
    }
}

export const basService = new BASService();
