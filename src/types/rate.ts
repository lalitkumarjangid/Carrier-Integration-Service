
import { Address } from './address';
import { Package } from './package';
import { CarrierId, Money, ServiceLevel } from './common';

/** Input to the rate shopping service */
export interface RateRequest {
  /** Origin / ship-from address */
  origin: Address;
  /** Destination / ship-to address */
  destination: Address;
  /** One or more packages in the shipment */
  packages: Package[];
  /** Optionally restrict to a specific service level */
  serviceLevel?: ServiceLevel;
  /** Optionally restrict to specific carriers */
  carriers?: CarrierId[];
  /** Shipper account number (if not using default from config) */
  shipperAccountNumber?: string;
}

/** A single normalized rate quote */
export interface RateQuote {
  /** Which carrier provided this rate */
  carrier: CarrierId;
  /** Carrier-specific service code (e.g., "03" for UPS Ground) */
  serviceCode: string;
  /** Human-readable service name */
  serviceName: string;
  /** Normalized service level */
  serviceLevel: ServiceLevel;
  /** Total shipping charges */
  totalCharges: Money;
  /** Base transportation charges */
  baseCharges: Money;
  /** Itemized surcharges, if any */
  surcharges: Surcharge[];
  /** Estimated transit days (if available) */
  transitDays?: number;
  /** Estimated delivery date (if available) */
  estimatedDelivery?: string;
  /** Whether guaranteed delivery */
  guaranteed: boolean;
  /** Billing weight used for pricing */
  billingWeight?: {
    value: number;
    unit: string;
  };
}

export interface Surcharge {
  code: string;
  description: string;
  amount: Money;
}

/** Response from the rate shopping service */
export interface RateResponse {
  /** All returned rate quotes, sorted by total price ascending */
  quotes: RateQuote[];
  /** Which carriers were queried */
  carriers: CarrierId[];
  /** Request timestamp */
  requestedAt: string;
}
