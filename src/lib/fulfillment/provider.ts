/**
 * Data provider abstraction. Fulfillment logic depends on this contract only,
 * so the real telecom/reseller API can be dropped in as another implementation.
 */

export interface PurchaseRequest {
  /** Idempotency key — the provider must not deliver twice for the same key. */
  idempotencyKey: string;
  recipientPhone: string;
  networkSlug: string;
  /** Provider's product code, snapshotted on the order. */
  productCode: string | null;
  dataAmountMb: number;
  amount: number;
}

export type DeliveryState = "SUCCESSFUL" | "PROCESSING" | "FAILED";

export interface PurchaseResult {
  state: DeliveryState;
  providerReference: string | null;
  message: string;
  /** Only true for transient faults where no delivery could have occurred. */
  retryable: boolean;
  raw: unknown;
}

export interface DataProvider {
  readonly name: string;
  getAvailableProducts(): Promise<Array<{ code: string; name: string; amountMb: number }>>;
  purchaseBundle(req: PurchaseRequest): Promise<PurchaseResult>;
  getTransactionStatus(providerReference: string): Promise<PurchaseResult>;
  checkBalance(): Promise<{ balance: number; currency: string }>;
}
