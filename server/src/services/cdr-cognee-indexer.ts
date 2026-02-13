/**
 * CDR Cognee Indexer (Wave 18)
 *
 * Reads CDR products, rates, fees, and features from the database and indexes
 * them into 3 Cognee datasets for semantic search:
 *   1. cdr_products    — product name, description, category (CHUNKS search)
 *   2. cdr_rates       — lending/deposit rates with types (CHUNKS_LEXICAL search)
 *   3. banking_product_knowledge — rich product summaries for AI reasoning (GRAPH_COMPLETION)
 */

import { eq, gt } from 'drizzle-orm';
import {
  db,
  cdrProducts,
  cdrLendingRates,
  cdrDepositRates,
  cdrFees,
  cdrFeatures,
  cdrEligibility,
  cdrDataHolders,
} from '../schema.js';
import { cogneeTools, COGNEE_DATASETS } from './claude/cognee-tools.js';
import { cogneeClient, type CogneeSearchType } from './cognee_client.js';

export interface CdrIndexResult {
  productsIndexed: number;
  ratesIndexed: number;
  knowledgeDocsIndexed: number;
  errors: string[];
  durationMs: number;
}

export class CdrCogneeIndexer {
  /**
   * Index all CDR products into the cdr_products Cognee dataset.
   * Formats each product as a human-readable string for embedding.
   */
  async indexProducts(): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];

    try {
      const products = await db.select().from(cdrProducts).all();
      if (!products?.length) return { count: 0, errors: [] };

      const texts: string[] = [];

      for (const product of products as any[]) {
        // Look up the data holder name
        let holderName = product.brandName ?? product.brand ?? '';
        if (!holderName && product.dataHolderId) {
          const holder = await db
            .select()
            .from(cdrDataHolders)
            .where(eq(cdrDataHolders.id, product.dataHolderId))
            .get();
          holderName = (holder as any)?.brandName ?? product.dataHolderId;
        }

        const text =
          `Product: ${product.name}. ` +
          `Bank: ${holderName}. ` +
          `Category: ${product.productCategory}. ` +
          (product.description ? `Description: ${product.description}. ` : '') +
          (product.isTailored ? 'Tailored product. ' : '') +
          (product.applicationUri ? `Apply: ${product.applicationUri}. ` : '');

        texts.push(text.trim());
      }

      await cogneeTools.index(texts, COGNEE_DATASETS.cdrProducts);
      return { count: texts.length, errors };
    } catch (err: any) {
      errors.push(`Product indexing failed: ${err.message}`);
      return { count: 0, errors };
    }
  }

  /**
   * Index lending and deposit rates into the cdr_rates dataset.
   * Uses descriptive text with rate types and values for keyword search.
   */
  async indexRates(): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];

    try {
      const texts: string[] = [];

      // Lending rates
      const lendingRates = await db.select().from(cdrLendingRates).all();
      for (const lr of (lendingRates ?? []) as any[]) {
        // Get product name
        const product = await db
          .select()
          .from(cdrProducts)
          .where(eq(cdrProducts.id, lr.productId))
          .get();
        const productName = (product as any)?.name ?? lr.productId;
        const bankName = (product as any)?.brandName ?? '';

        const ratePercent = ((lr.rate ?? 0) * 100).toFixed(2);
        const compRatePercent = lr.comparisonRate
          ? ((lr.comparisonRate * 100).toFixed(2) + '% comparison')
          : '';

        const text =
          `Lending Rate: ${productName} (${bankName}). ` +
          `Type: ${lr.lendingRateType}. ` +
          `Rate: ${ratePercent}%. ` +
          (compRatePercent ? `${compRatePercent}. ` : '') +
          (lr.repaymentType ? `Repayment: ${lr.repaymentType}. ` : '') +
          (lr.loanPurpose ? `Purpose: ${lr.loanPurpose}. ` : '') +
          (lr.additionalInfo ? `${lr.additionalInfo}. ` : '');

        texts.push(text.trim());
      }

      // Deposit rates
      const depositRates = await db.select().from(cdrDepositRates).all();
      for (const dr of (depositRates ?? []) as any[]) {
        const product = await db
          .select()
          .from(cdrProducts)
          .where(eq(cdrProducts.id, dr.productId))
          .get();
        const productName = (product as any)?.name ?? dr.productId;
        const bankName = (product as any)?.brandName ?? '';

        const ratePercent = ((dr.rate ?? 0) * 100).toFixed(2);

        const text =
          `Deposit Rate: ${productName} (${bankName}). ` +
          `Type: ${dr.depositRateType}. ` +
          `Rate: ${ratePercent}%. ` +
          (dr.additionalInfo ? `${dr.additionalInfo}. ` : '');

        texts.push(text.trim());
      }

      if (texts.length > 0) {
        await cogneeTools.index(texts, COGNEE_DATASETS.cdrRates);
      }

      return { count: texts.length, errors };
    } catch (err: any) {
      errors.push(`Rate indexing failed: ${err.message}`);
      return { count: 0, errors };
    }
  }

  /**
   * Index comprehensive product knowledge documents into the
   * banking_product_knowledge dataset. Each document combines product info
   * with all its rates, fees, features, and eligibility for rich AI reasoning.
   */
  async indexProductKnowledge(): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];

    try {
      const products = await db.select().from(cdrProducts).all();
      if (!products?.length) return { count: 0, errors: [] };

      const texts: string[] = [];

      for (const product of products as any[]) {
        try {
          // Get holder name
          let holderName = product.brandName ?? product.brand ?? '';
          if (!holderName && product.dataHolderId) {
            const holder = await db
              .select()
              .from(cdrDataHolders)
              .where(eq(cdrDataHolders.id, product.dataHolderId))
              .get();
            holderName = (holder as any)?.brandName ?? '';
          }

          const pid = product.id;

          // Lending rates
          const lRates = await db
            .select()
            .from(cdrLendingRates)
            .where(eq(cdrLendingRates.productId, pid))
            .all();

          const lendingText = (lRates as any[])
            .map(
              (lr) =>
                `${lr.lendingRateType}: ${((lr.rate ?? 0) * 100).toFixed(2)}%` +
                (lr.comparisonRate
                  ? ` (comparison ${(lr.comparisonRate * 100).toFixed(2)}%)`
                  : '') +
                (lr.repaymentType ? ` [${lr.repaymentType}]` : '')
            )
            .join('; ');

          // Deposit rates
          const dRates = await db
            .select()
            .from(cdrDepositRates)
            .where(eq(cdrDepositRates.productId, pid))
            .all();

          const depositText = (dRates as any[])
            .map(
              (dr) =>
                `${dr.depositRateType}: ${((dr.rate ?? 0) * 100).toFixed(2)}%`
            )
            .join('; ');

          // Fees
          const fees = await db
            .select()
            .from(cdrFees)
            .where(eq(cdrFees.productId, pid))
            .all();

          const feesText = (fees as any[])
            .map(
              (f) =>
                `${f.name} (${f.feeType}): ${f.amount ? `$${f.amount}` : 'varies'}`
            )
            .join('; ');

          // Features
          const features = await db
            .select()
            .from(cdrFeatures)
            .where(eq(cdrFeatures.productId, pid))
            .all();

          const featuresText = (features as any[])
            .map(
              (f) =>
                f.featureType +
                (f.additionalValue ? `: ${f.additionalValue}` : '')
            )
            .join('; ');

          // Eligibility
          const eligibility = await db
            .select()
            .from(cdrEligibility)
            .where(eq(cdrEligibility.productId, pid))
            .all();

          const eligibilityText = (eligibility as any[])
            .map(
              (e) =>
                e.eligibilityType +
                (e.additionalValue ? `: ${e.additionalValue}` : '')
            )
            .join('; ');

          // Compose full knowledge document
          let doc =
            `Banking Product: ${product.name} by ${holderName}. ` +
            `Category: ${product.productCategory}. `;

          if (product.description) doc += `${product.description}. `;
          if (lendingText) doc += `Lending Rates: ${lendingText}. `;
          if (depositText) doc += `Deposit Rates: ${depositText}. `;
          if (feesText) doc += `Fees: ${feesText}. `;
          if (featuresText) doc += `Features: ${featuresText}. `;
          if (eligibilityText) doc += `Eligibility: ${eligibilityText}. `;

          texts.push(doc.trim());
        } catch (err: any) {
          errors.push(
            `Failed to build knowledge for ${product.name}: ${err.message}`
          );
        }
      }

      if (texts.length > 0) {
        await cogneeTools.index(
          texts,
          COGNEE_DATASETS.bankingProductKnowledge
        );
      }

      return { count: texts.length, errors };
    } catch (err: any) {
      errors.push(`Product knowledge indexing failed: ${err.message}`);
      return { count: 0, errors };
    }
  }

  /**
   * Run a full indexing pipeline: products → rates → product knowledge.
   * Triggers cognify on all 3 datasets after indexing.
   */
  async indexAll(): Promise<CdrIndexResult> {
    const start = Date.now();
    const allErrors: string[] = [];

    console.log('[CDR-Indexer] Starting full CDR Cognee indexing...');

    // Index products
    const productResult = await this.indexProducts();
    allErrors.push(...productResult.errors);
    console.log(
      `[CDR-Indexer] Indexed ${productResult.count} products`
    );

    // Index rates
    const rateResult = await this.indexRates();
    allErrors.push(...rateResult.errors);
    console.log(`[CDR-Indexer] Indexed ${rateResult.count} rates`);

    // Index product knowledge
    const knowledgeResult = await this.indexProductKnowledge();
    allErrors.push(...knowledgeResult.errors);
    console.log(
      `[CDR-Indexer] Indexed ${knowledgeResult.count} knowledge documents`
    );

    // Trigger cognify on all 3 datasets
    const datasets = [
      COGNEE_DATASETS.cdrProducts,
      COGNEE_DATASETS.cdrRates,
      COGNEE_DATASETS.bankingProductKnowledge,
    ];

    for (const dataset of datasets) {
      try {
        await cogneeTools.cognify(dataset);
        console.log(`[CDR-Indexer] Cognified dataset: ${dataset}`);
      } catch (err: any) {
        allErrors.push(`Cognify failed for ${dataset}: ${err.message}`);
      }
    }

    const durationMs = Date.now() - start;
    console.log(
      `[CDR-Indexer] Complete: ${productResult.count} products, ${rateResult.count} rates, ${knowledgeResult.count} knowledge docs in ${durationMs}ms`
    );

    return {
      productsIndexed: productResult.count,
      ratesIndexed: rateResult.count,
      knowledgeDocsIndexed: knowledgeResult.count,
      errors: allErrors,
      durationMs,
    };
  }

  /**
   * Index products for a single data holder.
   * Useful after crawling a single holder incrementally.
   */
  async indexDataHolder(dataHolderId: string): Promise<CdrIndexResult> {
    const start = Date.now();
    const allErrors: string[] = [];

    const products = await db
      .select()
      .from(cdrProducts)
      .where(eq(cdrProducts.dataHolderId, dataHolderId))
      .all();

    if (!products?.length) {
      return {
        productsIndexed: 0,
        ratesIndexed: 0,
        knowledgeDocsIndexed: 0,
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    // Get holder name
    const holder = await db
      .select()
      .from(cdrDataHolders)
      .where(eq(cdrDataHolders.id, dataHolderId))
      .get();
    const holderName = (holder as any)?.brandName ?? dataHolderId;

    const productTexts: string[] = [];
    const rateTexts: string[] = [];
    const knowledgeTexts: string[] = [];

    for (const product of products as any[]) {
      const pid = product.id;

      // Product text
      productTexts.push(
        `Product: ${product.name}. Bank: ${holderName}. Category: ${product.productCategory}. ${product.description ?? ''}`.trim()
      );

      // Lending rates
      const lRates = await db
        .select()
        .from(cdrLendingRates)
        .where(eq(cdrLendingRates.productId, pid))
        .all();

      for (const lr of lRates as any[]) {
        const ratePercent = ((lr.rate ?? 0) * 100).toFixed(2);
        rateTexts.push(
          `Lending Rate: ${product.name} (${holderName}). Type: ${lr.lendingRateType}. Rate: ${ratePercent}%.`
        );
      }

      // Deposit rates
      const dRates = await db
        .select()
        .from(cdrDepositRates)
        .where(eq(cdrDepositRates.productId, pid))
        .all();

      for (const dr of dRates as any[]) {
        const ratePercent = ((dr.rate ?? 0) * 100).toFixed(2);
        rateTexts.push(
          `Deposit Rate: ${product.name} (${holderName}). Type: ${dr.depositRateType}. Rate: ${ratePercent}%.`
        );
      }

      // Knowledge doc
      const fees = await db
        .select()
        .from(cdrFees)
        .where(eq(cdrFees.productId, pid))
        .all();
      const features = await db
        .select()
        .from(cdrFeatures)
        .where(eq(cdrFeatures.productId, pid))
        .all();

      const lendingSummary = (lRates as any[])
        .map((lr) => `${lr.lendingRateType}: ${((lr.rate ?? 0) * 100).toFixed(2)}%`)
        .join('; ');
      const depositSummary = (dRates as any[])
        .map((dr) => `${dr.depositRateType}: ${((dr.rate ?? 0) * 100).toFixed(2)}%`)
        .join('; ');
      const feeSummary = (fees as any[])
        .map((f) => `${f.name}: ${f.amount ? `$${f.amount}` : 'varies'}`)
        .join('; ');
      const featureSummary = (features as any[])
        .map((f) => f.featureType)
        .join('; ');

      let doc = `Banking Product: ${product.name} by ${holderName}. Category: ${product.productCategory}. `;
      if (product.description) doc += `${product.description}. `;
      if (lendingSummary) doc += `Lending Rates: ${lendingSummary}. `;
      if (depositSummary) doc += `Deposit Rates: ${depositSummary}. `;
      if (feeSummary) doc += `Fees: ${feeSummary}. `;
      if (featureSummary) doc += `Features: ${featureSummary}. `;

      knowledgeTexts.push(doc.trim());
    }

    // Index all 3 datasets
    try {
      if (productTexts.length)
        await cogneeTools.index(productTexts, COGNEE_DATASETS.cdrProducts);
    } catch (err: any) {
      allErrors.push(`Product indexing: ${err.message}`);
    }

    try {
      if (rateTexts.length)
        await cogneeTools.index(rateTexts, COGNEE_DATASETS.cdrRates);
    } catch (err: any) {
      allErrors.push(`Rate indexing: ${err.message}`);
    }

    try {
      if (knowledgeTexts.length)
        await cogneeTools.index(
          knowledgeTexts,
          COGNEE_DATASETS.bankingProductKnowledge
        );
    } catch (err: any) {
      allErrors.push(`Knowledge indexing: ${err.message}`);
    }

    return {
      productsIndexed: productTexts.length,
      ratesIndexed: rateTexts.length,
      knowledgeDocsIndexed: knowledgeTexts.length,
      errors: allErrors,
      durationMs: Date.now() - start,
    };
  }
  /**
   * Index 10 static Australian banking knowledge documents into
   * banking_product_knowledge. These don't depend on crawled data —
   * they encode domain expertise for AI reasoning about loan products.
   */
  async indexBankingKnowledge(): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];

    const BANKING_KNOWLEDGE_DOCS: string[] = [
      // 1. Australian lending rate types
      `Australian Lending Rate Types: Variable rates track the lender's standard variable rate (SVR) and can change at any time. Fixed rates are locked for a term (1–5 years typically), providing repayment certainty. Split loans combine both. Introductory/honeymoon rates offer a discounted variable rate for 1–3 years before reverting to SVR. Interest-only loans require only interest payments for a set period (usually 1–5 years), common for investment properties. Comparison rates (mandated by ASIC) include fees and charges to give a truer cost picture. The RBA cash rate influences all lending rates but banks set their own margins.`,

      // 2. APRA 3% serviceability buffer
      `APRA Serviceability Buffer: The Australian Prudential Regulation Authority (APRA) requires banks to assess borrowers' ability to repay at the loan's interest rate plus a buffer of at least 3 percentage points (raised from 2.5% in October 2021). For example, if a loan rate is 6.5%, the bank must verify the borrower can service repayments at 9.5%. This buffer protects against rate rises and reduces maximum borrowing capacity. It applies to all new residential mortgage applications, including refinances, and is a key factor in determining borrowing power. Some lenders apply additional internal buffers beyond the APRA minimum.`,

      // 3. LVR tiers and LMI
      `Loan-to-Value Ratio (LVR) and Lenders Mortgage Insurance (LMI): LVR is the loan amount as a percentage of the property value. LVR tiers: ≤60% (lowest risk, best rates), 60–70%, 70–80% (standard), 80–90% (higher rates, LMI usually required), 90–95% (highest rates, LMI mandatory). LMI is a one-off premium paid by the borrower that protects the lender if the borrower defaults. LMI costs range from 1–4% of the loan amount depending on LVR and loan size. First Home Loan Deposit Scheme (FHLDS) allows eligible buyers to purchase with 5% deposit without LMI, government guarantees the remaining 15%.`,

      // 4. Comparison rate ASIC rules
      `ASIC Comparison Rate Rules: Under the National Consumer Credit Protection Act 2009, lenders must display a comparison rate alongside any advertised interest rate. The comparison rate is calculated on a $150,000 loan over 25 years (standardised scenario). It includes the advertised rate plus most ongoing fees and charges (establishment fees, monthly account fees, discharge fees). It excludes: government charges (stamp duty, registration), redraw fees, early repayment fees, and lender's mortgage insurance. Comparison rates help consumers compare the true cost of loans across providers, though they may not perfectly reflect individual circumstances due to the standardised calculation method.`,

      // 5. Offset vs redraw accounts
      `Offset vs Redraw Accounts: An offset account is a transaction account linked to a home loan where the balance reduces the principal on which interest is calculated. A 100% offset means $50,000 in the offset on a $500,000 loan means interest is charged on $450,000. Redraw allows borrowers to access extra repayments they've made above the minimum. Key differences: Offset funds are instantly accessible with no restrictions; redraw may have minimum amounts or fees. For investment loans, offset is preferred for tax purposes — offset doesn't reduce the loan balance (preserving deductible interest), while redraw technically repays and then re-borrows. Partial offset accounts (e.g., only 40% of balance offsets) exist but are less common.`,

      // 6. Fixed rate break costs
      `Fixed Rate Break Costs in Australia: Breaking a fixed-rate loan early incurs break costs (also called early repayment costs or economic costs). These are calculated based on the difference between the fixed rate and the current wholesale rate for the remaining term. If wholesale rates have dropped since the loan was fixed, break costs can be substantial — potentially tens of thousands of dollars. If rates have risen, break costs may be zero. Formula: Break cost ≈ (Fixed rate – Current wholesale rate) × Remaining term × Loan balance. Most lenders cap extra repayments during a fixed term at $10,000–$25,000 per year without penalty. Borrowers should carefully calculate break costs before refinancing a fixed loan.`,

      // 7. CDR product categories
      `CDR Banking Product Categories: The Consumer Data Right classifies banking products into these categories: RESIDENTIAL_MORTGAGES (home loans for owner-occupier and investment), BUSINESS_LOANS (secured and unsecured business lending), PERSONAL_LOANS (secured and unsecured consumer lending), TRANS_AND_SAVINGS_ACCOUNTS (everyday transaction and savings accounts), TERM_DEPOSITS (fixed-term investments), CRED_AND_CHRG_CARDS (credit cards and charge cards), OVERDRAFTS (overdraft facilities), REGULATED_TRUST_ACCOUNTS (statutory trust accounts), TRADE_FINANCE (import/export financing), TRAVEL_CARDS (multi-currency prepaid cards), MARGIN_LOANS (margin lending for securities). Each category has specific data fields for rates, fees, and features that must be disclosed under CDR.`,

      // 8. RBA cash rate impact on products
      `RBA Cash Rate and Banking Products: The Reserve Bank of Australia (RBA) sets the cash rate target at monthly meetings (except January). Changes flow through to banking products: Variable home loans typically adjust within 1–2 weeks of a cash rate change. Term deposits adjust based on market expectations of future rates. Credit card rates rarely change with cash rate movements. Savings account rates may be adjusted but with varying lag. Business lending rates follow with some delay. Historically, banks pass on rate increases faster than decreases. Since May 2022, the RBA raised rates rapidly from 0.10% to combat inflation. The cash rate directly affects the bank bill swap rate (BBSW) and the interbank overnight cash rate, which are the underlying benchmarks for variable lending.`,

      // 9. Refinancing decision framework
      `Refinancing Decision Framework: When evaluating whether to refinance a home loan, consider: 1) Rate differential — is the new rate at least 0.25–0.50% lower after comparing true rates (comparison rates)? 2) Break costs — for fixed loans, calculate economic cost vs savings. 3) Switching costs — discharge fee ($150–$350), new application fee, property valuation ($200–$600), legal/settlement fees ($200–$500). 4) Cash-back offers — some lenders offer $2,000–$4,000 but may have higher ongoing rates. 5) Loan features — does the new loan offer offset, redraw, extra repayments, split facility? 6) LVR position — has property value increased enough to reduce LVR tier and eliminate LMI? 7) Clawback clauses — some brokers face commission clawback if the loan is refinanced within 1–2 years. Generally, refinancing is worthwhile if net savings exceed $1,500–$2,000 in the first year.`,

      // 10. Australian deposit guarantee and savings products
      `Australian Deposit Products and Government Guarantee: The Financial Claims Scheme (FCS) guarantees deposits up to $250,000 per person per ADI (Authorised Deposit-taking Institution). This covers transaction accounts, savings accounts, term deposits, and some other deposit products. Savings account types: Bonus saver (requires monthly deposit and no withdrawals for bonus rate), Goal saver (target balance growth), High-interest online saver (higher rate for online-only), At-call savings (flexible access, lower rate). Term deposit considerations: Early withdrawal penalties apply, interest can be paid monthly, annually, or at maturity. For amounts over $250,000, spreading across multiple ADIs ensures full FCS coverage. The guarantee applies automatically — no need to register.`,
    ];

    try {
      await cogneeTools.index(
        BANKING_KNOWLEDGE_DOCS,
        COGNEE_DATASETS.bankingProductKnowledge
      );

      await cogneeTools.cognify(COGNEE_DATASETS.bankingProductKnowledge);

      console.log(
        `[CDR-Indexer] Indexed ${BANKING_KNOWLEDGE_DOCS.length} static banking knowledge documents`
      );

      return { count: BANKING_KNOWLEDGE_DOCS.length, errors };
    } catch (err: any) {
      errors.push(`Banking knowledge indexing failed: ${err.message}`);
      return { count: 0, errors };
    }
  }

  /**
   * Incremental index: only process products/rates updated since a timestamp.
   * Avoids re-indexing unchanged data for efficiency.
   */
  async incrementalIndex(since: string): Promise<CdrIndexResult> {
    const start = Date.now();
    const allErrors: string[] = [];

    console.log(`[CDR-Indexer] Incremental index for products updated since ${since}`);

    // Fetch products updated since the given timestamp
    const updatedProducts = await db
      .select()
      .from(cdrProducts)
      .where(gt(cdrProducts.updatedAt, since))
      .all();

    if (!updatedProducts?.length) {
      console.log('[CDR-Indexer] No updated products found');
      return {
        productsIndexed: 0,
        ratesIndexed: 0,
        knowledgeDocsIndexed: 0,
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    const productTexts: string[] = [];
    const rateTexts: string[] = [];
    const knowledgeTexts: string[] = [];

    for (const product of updatedProducts as any[]) {
      const pid = product.id;

      // Resolve holder name
      let holderName = product.brandName ?? product.brand ?? '';
      if (!holderName && product.dataHolderId) {
        const holder = await db
          .select()
          .from(cdrDataHolders)
          .where(eq(cdrDataHolders.id, product.dataHolderId))
          .get();
        holderName = (holder as any)?.brandName ?? product.dataHolderId;
      }

      // Product text
      productTexts.push(
        `Product: ${product.name}. Bank: ${holderName}. Category: ${product.productCategory}. ${product.description ?? ''}`.trim()
      );

      // Lending rates for this product
      const lRates = await db
        .select()
        .from(cdrLendingRates)
        .where(eq(cdrLendingRates.productId, pid))
        .all();

      for (const lr of lRates as any[]) {
        const ratePercent = ((lr.rate ?? 0) * 100).toFixed(2);
        rateTexts.push(
          `Lending Rate: ${product.name} (${holderName}). Type: ${lr.lendingRateType}. Rate: ${ratePercent}%.` +
          (lr.comparisonRate ? ` Comparison: ${((lr.comparisonRate * 100).toFixed(2))}%.` : '') +
          (lr.repaymentType ? ` Repayment: ${lr.repaymentType}.` : '')
        );
      }

      // Deposit rates for this product
      const dRates = await db
        .select()
        .from(cdrDepositRates)
        .where(eq(cdrDepositRates.productId, pid))
        .all();

      for (const dr of dRates as any[]) {
        const ratePercent = ((dr.rate ?? 0) * 100).toFixed(2);
        rateTexts.push(
          `Deposit Rate: ${product.name} (${holderName}). Type: ${dr.depositRateType}. Rate: ${ratePercent}%.`
        );
      }

      // Knowledge doc with all child records
      const fees = await db.select().from(cdrFees).where(eq(cdrFees.productId, pid)).all();
      const features = await db.select().from(cdrFeatures).where(eq(cdrFeatures.productId, pid)).all();

      const lendingSummary = (lRates as any[])
        .map((lr) => `${lr.lendingRateType}: ${((lr.rate ?? 0) * 100).toFixed(2)}%`)
        .join('; ');
      const depositSummary = (dRates as any[])
        .map((dr) => `${dr.depositRateType}: ${((dr.rate ?? 0) * 100).toFixed(2)}%`)
        .join('; ');
      const feeSummary = (fees as any[])
        .map((f) => `${f.name}: ${f.amount ? `$${f.amount}` : 'varies'}`)
        .join('; ');
      const featureSummary = (features as any[])
        .map((f) => f.featureType)
        .join('; ');

      let doc = `Banking Product: ${product.name} by ${holderName}. Category: ${product.productCategory}. `;
      if (product.description) doc += `${product.description}. `;
      if (lendingSummary) doc += `Lending Rates: ${lendingSummary}. `;
      if (depositSummary) doc += `Deposit Rates: ${depositSummary}. `;
      if (feeSummary) doc += `Fees: ${feeSummary}. `;
      if (featureSummary) doc += `Features: ${featureSummary}. `;

      knowledgeTexts.push(doc.trim());
    }

    // Index into all 3 datasets
    try {
      if (productTexts.length)
        await cogneeTools.index(productTexts, COGNEE_DATASETS.cdrProducts);
    } catch (err: any) {
      allErrors.push(`Incremental product indexing: ${err.message}`);
    }

    try {
      if (rateTexts.length)
        await cogneeTools.index(rateTexts, COGNEE_DATASETS.cdrRates);
    } catch (err: any) {
      allErrors.push(`Incremental rate indexing: ${err.message}`);
    }

    try {
      if (knowledgeTexts.length)
        await cogneeTools.index(knowledgeTexts, COGNEE_DATASETS.bankingProductKnowledge);
    } catch (err: any) {
      allErrors.push(`Incremental knowledge indexing: ${err.message}`);
    }

    // Cognify updated datasets
    const datasetsToUpdate = [
      ...(productTexts.length ? [COGNEE_DATASETS.cdrProducts] : []),
      ...(rateTexts.length ? [COGNEE_DATASETS.cdrRates] : []),
      ...(knowledgeTexts.length ? [COGNEE_DATASETS.bankingProductKnowledge] : []),
    ];

    for (const dataset of datasetsToUpdate) {
      try {
        await cogneeTools.cognify(dataset);
      } catch (err: any) {
        allErrors.push(`Incremental cognify ${dataset}: ${err.message}`);
      }
    }

    const durationMs = Date.now() - start;
    console.log(
      `[CDR-Indexer] Incremental: ${productTexts.length} products, ${rateTexts.length} rates, ${knowledgeTexts.length} knowledge docs in ${durationMs}ms`
    );

    return {
      productsIndexed: productTexts.length,
      ratesIndexed: rateTexts.length,
      knowledgeDocsIndexed: knowledgeTexts.length,
      errors: allErrors,
      durationMs,
    };
  }

  /**
   * Convenience search wrapper that fans out across all 3 CDR datasets.
   * Returns merged results sorted by relevance.
   */
  async searchProducts(
    query: string,
    searchType?: CogneeSearchType
  ): Promise<string[]> {
    const datasets = [
      COGNEE_DATASETS.cdrProducts,
      COGNEE_DATASETS.cdrRates,
      COGNEE_DATASETS.bankingProductKnowledge,
    ];

    const results = await cogneeClient.crossDatasetSearch(query, datasets, {
      searchType: searchType ?? 'CHUNKS',
      topK: 5,
      mergeResults: true,
    });
    return results.map((r: any) => typeof r === 'string' ? r : r.content ?? JSON.stringify(r));
  }
}

export const cdrCogneeIndexer = new CdrCogneeIndexer();
