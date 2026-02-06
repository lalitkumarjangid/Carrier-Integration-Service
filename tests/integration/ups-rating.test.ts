import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpsCarrier, UpsCarrierConfig } from '../../src/carriers/ups';
import { RateRequest } from '../../src/types/rate';
import {
  upsShopSuccessResponse,
  upsSingleRateResponse,
  sampleRateRequest,
} from '../fixtures/ups-responses';

// Mock module
vi.mock('axios', () => ({
  default: {
    create: () => ({
      post: vi.fn(),
      defaults: {},
    }),
    isAxiosError: (e: any) => e?.isAxiosError === true,
  },
  isAxiosError: (e: any) => e?.isAxiosError === true,
}));

describe('UPS Rating Integration', () => {
  const testConfig: UpsCarrierConfig = {
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    accountNumber: '123456',
    baseUrl: 'https://onlinetools.ups.com',
    timeout: 10000,
    transactionSource: 'TestApp',
    ratingApiVersion: 'v2409',
  };

  describe('Request Building', () => {
    it('should build correct UPS request payload from domain types', async () => {
      // This test verifies that mapToUpsRateRequest produces the expected structure
      const { mapToUpsRateRequest } = await import('../../src/carriers/ups/rating/mapper');

      const request: RateRequest = {
        ...sampleRateRequest,
        serviceLevel: 'GROUND',
      };

      const upsRequest = mapToUpsRateRequest(request, '123456');

      expect(upsRequest).toMatchObject({
        RateRequest: {
          Request: {
            RequestOption: 'Rate', // Single rate because serviceLevel specified
          },
          Shipment: {
            Shipper: {
              Name: 'Test Shipper',
              ShipperNumber: '123456',
              Address: {
                AddressLine: ['123 Main St'],
                City: 'San Francisco',
                StateProvinceCode: 'CA',
                PostalCode: '94105',
                CountryCode: 'US',
              },
            },
            ShipTo: {
              Name: 'Test Customer',
              Address: {
                AddressLine: ['456 Oak Ave'],
                City: 'New York',
                StateProvinceCode: 'NY',
                PostalCode: '10001',
                CountryCode: 'US',
                ResidentialAddressIndicator: 'Y',
              },
            },
            Service: {
              Code: '03', // Ground
            },
            Package: [
              {
                PackagingType: { Code: '02' }, // Customer Supplied
                Dimensions: {
                  Length: '12',
                  Width: '8',
                  Height: '6',
                  UnitOfMeasurement: { Code: 'IN' },
                },
                PackageWeight: {
                  Weight: '5.5',
                  UnitOfMeasurement: { Code: 'LBS' },
                },
              },
            ],
          },
        },
      });
    });

    it('should use Shop request option when no service level specified', async () => {
      const { mapToUpsRateRequest } = await import('../../src/carriers/ups/rating/mapper');

      const request: RateRequest = sampleRateRequest; // No serviceLevel

      const upsRequest = mapToUpsRateRequest(request, '123456');

      expect(upsRequest.RateRequest.Request.RequestOption).toBe('Shop');
      expect(upsRequest.RateRequest.Shipment.Service).toBeUndefined();
    });
  });

  describe('Response Parsing - Shop (Multiple Services)', () => {
    it('should parse and normalize multiple rated shipments', async () => {
      const { mapFromUpsRatedShipment } = await import('../../src/carriers/ups/rating/mapper');

      const ratedShipments = upsShopSuccessResponse.RateResponse.RatedShipment;
      expect(Array.isArray(ratedShipments)).toBe(true);

      const quotes = (ratedShipments as any[]).map(mapFromUpsRatedShipment);

      expect(quotes).toHaveLength(3);

      // Check Ground quote
      const ground = quotes.find((q) => q.serviceCode === '03');
      expect(ground).toMatchObject({
        carrier: 'UPS',
        serviceCode: '03',
        serviceName: 'UPS Ground',
        serviceLevel: 'GROUND',
        totalCharges: { amount: 15.5, currency: 'USD' },
        baseCharges: { amount: 15.5, currency: 'USD' },
        transitDays: 5,
        guaranteed: true,
        billingWeight: { value: 6.0, unit: 'LBS' },
      });

      // Check surcharges were parsed
      expect(ground?.surcharges).toHaveLength(1);
      expect(ground?.surcharges[0]).toMatchObject({
        code: '375',
        description: 'Fuel Surcharge',
        amount: { amount: 1.5, currency: 'USD' },
      });

      // Check 2nd Day Air quote
      const secondDay = quotes.find((q) => q.serviceCode === '02');
      expect(secondDay?.serviceName).toBe('UPS 2nd Day Air');
      expect(secondDay?.totalCharges.amount).toBe(28.75);
      expect(secondDay?.transitDays).toBe(2);

      // Check Next Day Air quote
      const nextDay = quotes.find((q) => q.serviceCode === '01');
      expect(nextDay?.serviceName).toBe('UPS Next Day Air');
      expect(nextDay?.totalCharges.amount).toBe(45.0);
      expect(nextDay?.transitDays).toBe(1);
    });
  });

  describe('Response Parsing - Single Rate', () => {
    it('should handle single rated shipment (non-array)', async () => {
      const { mapFromUpsRatedShipment } = await import('../../src/carriers/ups/rating/mapper');

      // UPS returns a single object for Rate, not an array
      const ratedShipment = upsSingleRateResponse.RateResponse.RatedShipment;
      expect(Array.isArray(ratedShipment)).toBe(false);

      const quote = mapFromUpsRatedShipment(ratedShipment as any);

      expect(quote).toMatchObject({
        carrier: 'UPS',
        serviceCode: '03',
        serviceName: 'UPS Ground',
        serviceLevel: 'GROUND',
        totalCharges: { amount: 14.25, currency: 'USD' },
        billingWeight: { value: 5.5, unit: 'LBS' },
      });
    });
  });

  describe('Service Level Mapping', () => {
    it('should map all known UPS service codes to domain service levels', async () => {
      const { mapFromUpsRatedShipment } = await import('../../src/carriers/ups/rating/mapper');

      const serviceCodeMap: Record<string, string> = {
        '01': 'NEXT_DAY_AIR',
        '02': 'SECOND_DAY_AIR',
        '03': 'GROUND',
        '07': 'EXPRESS',
        '08': 'EXPEDITED',
        '11': 'STANDARD',
        '12': 'THREE_DAY_SELECT',
        '13': 'NEXT_DAY_AIR_SAVER',
        '14': 'NEXT_DAY_AIR_EARLY',
        '54': 'EXPRESS_PLUS',
        '59': 'SECOND_DAY_AIR_AM',
        '65': 'SAVER',
      };

      for (const [code, expectedLevel] of Object.entries(serviceCodeMap)) {
        const rated = {
          Service: { Code: code },
          BillingWeight: { UnitOfMeasurement: { Code: 'LBS' }, Weight: '1.0' },
          TransportationCharges: { CurrencyCode: 'USD', MonetaryValue: '10.00' },
          ServiceOptionsCharges: { CurrencyCode: 'USD', MonetaryValue: '0.00' },
          TotalCharges: { CurrencyCode: 'USD', MonetaryValue: '10.00' },
        };

        const quote = mapFromUpsRatedShipment(rated as any);
        expect(quote.serviceLevel).toBe(expectedLevel);
      }
    });
  });

  describe('Sorting', () => {
    it('should return quotes sorted by total price ascending', async () => {
      // The operation should sort quotes
      const { UpsRatingOperation } = await import('../../src/carriers/ups/rating/operation');

      // Create a mock HTTP client
      const mockHttpClient = {
        post: vi.fn().mockResolvedValue(upsShopSuccessResponse),
      };

      const operation = new UpsRatingOperation(mockHttpClient as any, '123456', 'v2409');
      const quotes = await operation.getRates(sampleRateRequest);

      // Should be sorted by price: Ground ($15.50) < 2nd Day ($28.75) < Next Day ($45.00)
      expect(quotes[0].totalCharges.amount).toBe(15.5);
      expect(quotes[1].totalCharges.amount).toBe(28.75);
      expect(quotes[2].totalCharges.amount).toBe(45.0);
    });
  });
});
