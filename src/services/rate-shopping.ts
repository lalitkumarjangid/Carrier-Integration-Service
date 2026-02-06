// ─── Rate Shopping Service ─────────────────────────────────────────────
// Top-level service that callers use to get rate quotes.
// Coordinates across multiple carriers, validates input, and returns
// normalized, sorted results. The caller never touches carrier-specific code.

import { RateRequest, RateResponse, RateQuote } from '../types/rate';
import { CarrierId } from '../types/common';
import { CarrierRegistry } from '../carriers/registry';
import { RateRequestSchema } from '../validation/schemas';
import { validationError, CarrierError, CarrierErrorCode } from '../errors';
import { ZodError } from 'zod';

export class RateShoppingService {
  private readonly registry: CarrierRegistry;

  constructor(registry: CarrierRegistry) {
    this.registry = registry;
  }

  /**
   * Get rate quotes from one or more carriers.
   *
   * 1. Validates the request (runtime schema validation)
   * 2. Determines which carriers to query
   * 3. Queries all selected carriers in parallel
   * 4. Merges and sorts results by price
   *
   * Returns a RateResponse with normalized quotes from all carriers.
   */
  async getQuotes(request: RateRequest): Promise<RateResponse> {
    // ── Step 1: Validate input before any external call ──
    this.validateRequest(request);

    // ── Step 2: Determine carriers to query ──
    const carriers = this.resolveCarriers(request.carriers);

    // ── Step 3: Query all carriers in parallel ──
    const results = await Promise.allSettled(
      carriers.map(async (carrierId) => {
        const provider = this.registry.get(carrierId);
        return provider.getRates(request);
      }),
    );

    // ── Step 4: Collect results, track errors ──
    const allQuotes: RateQuote[] = [];
    const errors: CarrierError[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allQuotes.push(...result.value);
      } else {
        const error =
          result.reason instanceof CarrierError
            ? result.reason
            : new CarrierError({
                code: CarrierErrorCode.UNKNOWN,
                message: `Carrier ${carriers[index]} failed: ${result.reason?.message ?? 'Unknown error'}`,
                carrier: carriers[index],
                retryable: false,
                timestamp: new Date().toISOString(),
              });
        errors.push(error);
      }
    });

    // If ALL carriers failed, throw the first error
    if (allQuotes.length === 0 && errors.length > 0) {
      throw errors[0];
    }

    // Sort all quotes by total charges ascending
    allQuotes.sort((a, b) => a.totalCharges.amount - b.totalCharges.amount);

    return {
      quotes: allQuotes,
      carriers,
      requestedAt: new Date().toISOString(),
    };
  }

  /** Validate the rate request using Zod schema */
  private validateRequest(request: RateRequest): void {
    try {
      RateRequestSchema.parse(request);
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        throw validationError(messages.join('; '));
      }
      throw error;
    }
  }

  /** Resolve which carriers to query */
  private resolveCarriers(requestedCarriers?: CarrierId[]): CarrierId[] {
    if (requestedCarriers && requestedCarriers.length > 0) {
      return requestedCarriers;
    }
    // Default: all carriers that support the 'rate' operation
    return this.registry.getByOperation('rate').map((c) => c.carrierId);
  }
}
