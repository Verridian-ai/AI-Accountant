# Agent 3: Payment Gateway Builder

## Role
Create the PaymentGatewayService with Stripe integration for processing invoice payments.

## Priority: SUB-WAVE 2 (After Agent 1)

## Files to CREATE

### 1. `server/src/services/payment-gateway.ts`
**Purpose**: Payment gateway configuration and payment processing via Stripe
**Pattern**: Follow `server/src/services/invoicing.ts` for service structure

#### Class: `PaymentGatewayService`

**Constructor**: Takes `db` parameter

**Methods to implement**:

- [ ] `listGateways(userId: string): Promise<PaymentGateway[]>`
  - Query `paymentGateways` table filtered by userId
  - IMPORTANT: Do NOT return the raw `config` field (contains encrypted credentials)
  - Instead, return `{ ...gateway, config: '***' }` with masked config
  - Include provider name, isActive status

- [ ] `configureGateway(input: ConfigureGatewayInput): Promise<PaymentGateway>`
  - Generate UUID for id
  - Validate provider is one of: 'stripe', 'paypal', 'bank_transfer'
  - If a gateway already exists for this provider+userId, update instead of insert
  - Return the created/updated gateway (with masked config)

  > **REVISION NOTE (D02 CRIT-05 — Payment Gateway API Key Encryption)**:
  > **CRITICAL SECURITY REQUIREMENT**: Payment gateway API keys (Stripe secret keys, webhook secrets, PayPal credentials) MUST be encrypted at rest using AES-256-GCM before storing in the `payment_gateways.config` column:
  > 1. Use a dedicated encryption key: env var `PAYMENT_ENCRYPTION_KEY` (separate from TFN_ENCRYPTION_KEY).
  > 2. **Fail-fast**: If `PAYMENT_ENCRYPTION_KEY` is not set, throw on startup — do NOT store keys in plaintext.
  > 3. Encrypt the entire config JSON using `encryptField()` from Wave 4's encryption utility (or implement equivalent AES-256-GCM).
  > 4. Decrypt only in `getGatewayConfig()` when needed for actual payment processing — keep decrypted keys in-memory only.
  > 5. **NEVER log** gateway config values or include them in error messages.
  > 6. Masked config in responses should show only provider name and last 4 chars of key (e.g., `sk_...abc1`).
  > ```typescript
  > import { encryptField, decryptField } from './encryption.js';
  > // In configureGateway():
  > const encryptedConfig = encryptField(JSON.stringify(input.config), process.env.PAYMENT_ENCRYPTION_KEY!);
  > // In getGatewayConfig():
  > const decryptedConfig = JSON.parse(decryptField(gateway.config, process.env.PAYMENT_ENCRYPTION_KEY!));
  > ```

- [ ] `getGateway(id: string): Promise<PaymentGateway>`
  - Return gateway with masked config
  - Throw 404 if not found

- [ ] `getGatewayConfig(userId: string, provider: string): Promise<GatewayConfig | null>`
  - Private/internal method — returns UNMASKED config for payment processing
  - Query by userId + provider + isActive
  - Parse JSON config and return typed config object

- [ ] `processPayment(invoiceId: string, userId: string, idempotencyKey?: string): Promise<PaymentResult>`
  - Load the invoice from DB
  - Validate invoice status is 'sent' or 'overdue' (not draft, paid, or void)
  - Determine active gateway for user (preference: stripe > paypal > bank_transfer)
  - Route to appropriate processor:
    - **Stripe**: Call `_processStripePayment()`
    - **PayPal**: Return `{ success: false, error: 'PayPal not yet implemented' }`
    - **Bank Transfer**: Return `{ success: false, error: 'Bank transfer is manual' }`
  - On success: Record payment via `InvoicingService.recordPayment()`
  - Return `PaymentResult`

  > **REVISION NOTE (D02 — Payment Idempotency)**:
  > All payment operations MUST be idempotent to prevent double-charging:
  > 1. Accept an `idempotencyKey` parameter (auto-generate as `payment-${invoiceId}-${Date.now()}` if not provided by caller).
  > 2. Pass the idempotency key to Stripe via `stripe.paymentIntents.create({ ..., idempotency_key: idempotencyKey })`.
  > 3. On the server side, check for existing payment with the same idempotency key before processing (dedup at application layer).
  > 4. Store the idempotency key in `invoice_payments` table (add column if needed) for audit trail.
  > 5. If a duplicate idempotency key is detected, return the original payment result without re-processing.

- [ ] `_processStripePayment(invoice: Invoice, config: StripeConfig): Promise<PaymentResult>`
  - Private method
  - Import Stripe SDK: `import Stripe from 'stripe'`
  - Create Stripe instance with secret key from config
  - Create a PaymentIntent:
    ```typescript
    const paymentIntent = await stripe.paymentIntents.create({
      amount: invoice.amountDue, // already in cents
      currency: (invoice.currency ?? 'aud').toLowerCase(),
      description: `Invoice ${invoice.invoiceNumber}`,
      metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
    });
    ```
  - Return `{ success: true, transactionRef: paymentIntent.id, amount: invoice.amountDue }`
  - Handle Stripe errors gracefully

- [ ] `handleStripeWebhook(payload: string, signature: string): Promise<void>`
  - Handle event types:
    - `payment_intent.succeeded` → Record payment, update invoice status
    - `payment_intent.payment_failed` → Log failure

  > **REVISION NOTE (D02 — Webhook Signature Verification)**:
  > Stripe webhook signature verification is MANDATORY — never process unverified webhooks:
  > 1. Use `stripe.webhooks.constructEvent(payload, signature, webhookSecret)` to verify the signature BEFORE processing any event.
  > 2. If signature verification fails, return 400 immediately and log the attempt.
  > 3. The `STRIPE_WEBHOOK_SECRET` must come from the encrypted gateway config (not hardcoded env var alone).
  > 4. Reject webhooks with timestamps older than 5 minutes (Stripe's `tolerance` parameter).
  > ```typescript
  > try {
  >   const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  >   // Process verified event...
  > } catch (err) {
  >   console.error('Webhook signature verification failed:', err.message);
  >   throw new Error('Invalid webhook signature');
  > }
  > ```

#### Types to export:

```typescript
export interface ConfigureGatewayInput {
  userId: string;
  provider: 'stripe' | 'paypal' | 'bank_transfer';
  config: Record<string, string>; // provider-specific config
}

export interface StripeConfig {
  secretKey: string;
  publishableKey?: string;
  webhookSecret?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionRef?: string;
  amount?: number; // cents
  error?: string;
}

export interface GatewayConfig {
  provider: string;
  [key: string]: unknown;
}
```

#### Environment variables:
- `STRIPE_SECRET_KEY` — Default Stripe secret key (used when no per-user gateway configured)
- `STRIPE_WEBHOOK_SECRET` — For webhook signature verification
- `PAYMENT_GATEWAY` — Default gateway provider (default: 'stripe')
- `PAYMENT_ENCRYPTION_KEY` — **REQUIRED** — AES-256 key for encrypting gateway configs at rest. **Server MUST fail to start if this is missing.** (REVISION NOTE: D02 CRIT-05)

#### Important notes:
- **Stripe SDK is already installed**: `"stripe": "^20.2.0"` in `server/package.json`
- Config stored as JSON TEXT in DB — encryption handled at application level
- PaymentIntent is server-side only — no client-side Stripe Elements in Wave 8
- All amounts in **cents** (Stripe also uses cents/minor units)

## Verification
- [ ] `PaymentGatewayService` exports all methods
- [ ] Stripe SDK imported and used correctly
- [ ] Gateway config is masked in list/get responses
- [ ] `processPayment()` validates invoice status before processing
- [ ] `_processStripePayment()` creates PaymentIntent with correct amount/currency
- [ ] `handleStripeWebhook()` verifies signatures
- [ ] Types exported: `ConfigureGatewayInput`, `StripeConfig`, `PaymentResult`, `GatewayConfig`
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W08-03`

## Dependencies
- **Agent 1**: Schema tables must exist for type imports
- **Wave 7**: `InvoicingService.recordPayment()` for recording successful payments
- **Stripe SDK**: Already in `server/package.json`
