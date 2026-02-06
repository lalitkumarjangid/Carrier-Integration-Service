import { CarrierId } from '../types/common';
import { RateRequest, RateQuote } from '../types/rate';

/**
 * Operation types that a carrier can support.
 * Extending with new operations (e.g., 'label', 'tracking') doesn't
 * require changing existing carrier implementations.
 */
export type CarrierOperation = 'rate' | 'label' | 'tracking' | 'address_validation';

/**
 * Interface that every carrier provider must implement.
 * Each carrier declares which operations it supports, and the
 * service layer dispatches accordingly.
 */
export interface CarrierProvider {
  /** Unique carrier identifier */
  readonly carrierId: CarrierId;

  /** Human-readable carrier name */
  readonly carrierName: string;

  /** Which operations this carrier currently supports */
  readonly supportedOperations: CarrierOperation[];

  /**
   * Get rate quotes for a shipment.
   * Returns normalized RateQuote[] — the caller never sees carrier-specific formats.
   */
  getRates(request: RateRequest): Promise<RateQuote[]>;

  // ─── Future operations (stubbed as optional for forward-compatibility) ──

  /**
   * Purchase a shipping label.
   * @future — not yet implemented for any carrier.
   */
  // purchaseLabel?(request: LabelRequest): Promise<LabelResponse>;

  /**
   * Track a shipment.
   * @future — not yet implemented for any carrier.
   */
  // trackShipment?(trackingNumber: string): Promise<TrackingResponse>;

  /**
   * Validate an address.
   * @future — not yet implemented for any carrier.
   */
  // validateAddress?(address: Address): Promise<AddressValidationResponse>;
}
