// ─── Common Types ─────────────────────────────────────────────────────
// Shared enumerations and types used across the domain.

/** Carrier-agnostic service levels */
export type ServiceLevel =
  | 'GROUND'
  | 'EXPRESS'
  | 'EXPRESS_PLUS'
  | 'EXPEDITED'
  | 'STANDARD'
  | 'NEXT_DAY_AIR'
  | 'NEXT_DAY_AIR_EARLY'
  | 'NEXT_DAY_AIR_SAVER'
  | 'SECOND_DAY_AIR'
  | 'SECOND_DAY_AIR_AM'
  | 'THREE_DAY_SELECT'
  | 'SAVER';

/** Supported carrier identifiers */
export type CarrierId = 'UPS' | 'FEDEX' | 'USPS' | 'DHL';

/** ISO 4217 currency representation */
export interface Money {
  amount: number;
  currency: string;
}
