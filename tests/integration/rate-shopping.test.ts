import { describe, it, expect, vi } from 'vitest';
import { RateShoppingService } from '../../src/services/rate-shopping';
import { CarrierRegistry } from '../../src/carriers/registry';
import { CarrierProvider } from '../../src/carriers/carrier.interface';
import { RateRequest, RateQuote } from '../../src/types/rate';
import { CarrierError, CarrierErrorCode } from '../../src/errors';
import { sampleRateRequest } from '../fixtures/ups-responses';

// Create a mock carrier for testing
function createMockCarrier(
  carrierId: 'UPS' | 'FEDEX',
  quotes: RateQuote[],
): CarrierProvider {
  return {
    carrierId,
    carrierName: carrierId === 'UPS' ? 'United Parcel Service' : 'FedEx',
    supportedOperations: ['rate'],
    getRates: vi.fn().mockResolvedValue(quotes),
  };
}

describe('RateShoppingService', () => {
  describe('Single Carrier', () => {
    it('should return sorted quotes from a single carrier', async () => {
      const quotes: RateQuote[] = [
        {
          carrier: 'UPS',
          serviceCode: '01',
          serviceName: 'UPS Next Day Air',
          serviceLevel: 'NEXT_DAY_AIR',
          totalCharges: { amount: 45.00, currency: 'USD' },
          baseCharges: { amount: 42.00, currency: 'USD' },
          surcharges: [],
          guaranteed: true,
        },
        {
          carrier: 'UPS',
          serviceCode: '03',
          serviceName: 'UPS Ground',
          serviceLevel: 'GROUND',
          totalCharges: { amount: 15.50, currency: 'USD' },
          baseCharges: { amount: 14.00, currency: 'USD' },
          surcharges: [],
          guaranteed: false,
        },
      ];

      const mockCarrier = createMockCarrier('UPS', quotes);
      const registry = new CarrierRegistry();
      registry.register(mockCarrier);

      const service = new RateShoppingService(registry);
      const response = await service.getQuotes(sampleRateRequest);

      expect(response.quotes).toHaveLength(2);
      // Should be sorted by price ascending
      expect(response.quotes[0].totalCharges.amount).toBe(15.50);
      expect(response.quotes[1].totalCharges.amount).toBe(45.00);
      expect(response.carriers).toContain('UPS');
      expect(response.requestedAt).toBeDefined();
    });
  });

  describe('Multiple Carriers', () => {
    it('should aggregate and sort quotes from multiple carriers', async () => {
      const upsQuotes: RateQuote[] = [
        {
          carrier: 'UPS',
          serviceCode: '03',
          serviceName: 'UPS Ground',
          serviceLevel: 'GROUND',
          totalCharges: { amount: 15.50, currency: 'USD' },
          baseCharges: { amount: 14.00, currency: 'USD' },
          surcharges: [],
          guaranteed: false,
        },
      ];

      const fedexQuotes: RateQuote[] = [
        {
          carrier: 'FEDEX',
          serviceCode: 'FEDEX_GROUND',
          serviceName: 'FedEx Ground',
          serviceLevel: 'GROUND',
          totalCharges: { amount: 14.25, currency: 'USD' },
          baseCharges: { amount: 13.00, currency: 'USD' },
          surcharges: [],
          guaranteed: false,
        },
      ];

      const registry = new CarrierRegistry();
      registry.register(createMockCarrier('UPS', upsQuotes));
      registry.register(createMockCarrier('FEDEX', fedexQuotes));

      const service = new RateShoppingService(registry);
      const response = await service.getQuotes(sampleRateRequest);

      expect(response.quotes).toHaveLength(2);
      // FedEx is cheaper, should be first
      expect(response.quotes[0].carrier).toBe('FEDEX');
      expect(response.quotes[0].totalCharges.amount).toBe(14.25);
      expect(response.quotes[1].carrier).toBe('UPS');
      expect(response.carriers).toContain('UPS');
      expect(response.carriers).toContain('FEDEX');
    });

    it('should only query specified carriers when provided', async () => {
      const upsCarrier = createMockCarrier('UPS', []);
      const fedexCarrier = createMockCarrier('FEDEX', []);

      const registry = new CarrierRegistry();
      registry.register(upsCarrier);
      registry.register(fedexCarrier);

      const service = new RateShoppingService(registry);
      const request = { ...sampleRateRequest, carriers: ['UPS' as const] };
      await service.getQuotes(request);

      expect(upsCarrier.getRates).toHaveBeenCalled();
      expect(fedexCarrier.getRates).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should throw on validation error before querying carriers', async () => {
      const registry = new CarrierRegistry();
      registry.register(createMockCarrier('UPS', []));

      const service = new RateShoppingService(registry);
      
      const invalidRequest = {
        ...sampleRateRequest,
        packages: [], // Invalid: at least one package required
      };

      await expect(service.getQuotes(invalidRequest as any)).rejects.toMatchObject({
        details: expect.objectContaining({
          code: CarrierErrorCode.VALIDATION_ERROR,
        }),
      });
    });

    it('should throw when all carriers fail', async () => {
      const mockCarrier: CarrierProvider = {
        carrierId: 'UPS',
        carrierName: 'UPS',
        supportedOperations: ['rate'],
        getRates: vi.fn().mockRejectedValue(
          new CarrierError({
            code: CarrierErrorCode.CARRIER_API_ERROR,
            message: 'API Error',
            carrier: 'UPS',
            retryable: true,
            timestamp: new Date().toISOString(),
          }),
        ),
      };

      const registry = new CarrierRegistry();
      registry.register(mockCarrier);

      const service = new RateShoppingService(registry);

      await expect(service.getQuotes(sampleRateRequest)).rejects.toMatchObject({
        details: expect.objectContaining({
          code: CarrierErrorCode.CARRIER_API_ERROR,
        }),
      });
    });

    it('should return partial results when some carriers fail', async () => {
      const upsQuotes: RateQuote[] = [
        {
          carrier: 'UPS',
          serviceCode: '03',
          serviceName: 'UPS Ground',
          serviceLevel: 'GROUND',
          totalCharges: { amount: 15.50, currency: 'USD' },
          baseCharges: { amount: 14.00, currency: 'USD' },
          surcharges: [],
          guaranteed: false,
        },
      ];

      const successCarrier = createMockCarrier('UPS', upsQuotes);
      const failingCarrier: CarrierProvider = {
        carrierId: 'FEDEX',
        carrierName: 'FedEx',
        supportedOperations: ['rate'],
        getRates: vi.fn().mockRejectedValue(new Error('FedEx is down')),
      };

      const registry = new CarrierRegistry();
      registry.register(successCarrier);
      registry.register(failingCarrier);

      const service = new RateShoppingService(registry);
      const response = await service.getQuotes(sampleRateRequest);

      // Should still return UPS quotes even though FedEx failed
      expect(response.quotes).toHaveLength(1);
      expect(response.quotes[0].carrier).toBe('UPS');
    });
  });

  describe('Carrier Registry', () => {
    it('should throw when requesting unregistered carrier', async () => {
      const registry = new CarrierRegistry();
      registry.register(createMockCarrier('UPS', []));

      const service = new RateShoppingService(registry);
      const request = { ...sampleRateRequest, carriers: ['FEDEX' as const] };

      await expect(service.getQuotes(request)).rejects.toMatchObject({
        details: expect.objectContaining({
          code: CarrierErrorCode.CARRIER_UNAVAILABLE,
        }),
      });
    });
  });
});
