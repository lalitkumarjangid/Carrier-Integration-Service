import { describe, it, expect } from 'vitest';
import { RateRequestSchema } from '../../src/validation/schemas';
import { ZodError } from 'zod';

describe('Input Validation', () => {
  const validRequest = {
    origin: {
      name: 'Shipper',
      addressLines: ['123 Main St'],
      city: 'San Francisco',
      stateCode: 'CA',
      postalCode: '94105',
      countryCode: 'US',
    },
    destination: {
      name: 'Customer',
      addressLines: ['456 Oak Ave'],
      city: 'New York',
      stateCode: 'NY',
      postalCode: '10001',
      countryCode: 'US',
    },
    packages: [
      {
        dimensions: { length: 12, width: 8, height: 6, unit: 'IN' },
        weight: { value: 5.5, unit: 'LBS' },
      },
    ],
  };

  describe('Valid Requests', () => {
    it('should accept a valid rate request', () => {
      const result = RateRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should accept request with optional fields', () => {
      const request = {
        ...validRequest,
        serviceLevel: 'GROUND',
        carriers: ['UPS'],
        shipperAccountNumber: '123456',
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should accept multiple packages', () => {
      const request = {
        ...validRequest,
        packages: [
          { dimensions: { length: 12, width: 8, height: 6, unit: 'IN' }, weight: { value: 5, unit: 'LBS' } },
          { dimensions: { length: 10, width: 10, height: 10, unit: 'IN' }, weight: { value: 10, unit: 'LBS' } },
        ],
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('Address Validation', () => {
    it('should reject missing origin name', () => {
      const request = {
        ...validRequest,
        origin: { ...validRequest.origin, name: '' },
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
      expect((result as any).error.errors[0].path).toContain('name');
    });

    it('should reject missing address lines', () => {
      const request = {
        ...validRequest,
        origin: { ...validRequest.origin, addressLines: [] },
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject more than 3 address lines', () => {
      const request = {
        ...validRequest,
        origin: {
          ...validRequest.origin,
          addressLines: ['Line 1', 'Line 2', 'Line 3', 'Line 4'],
        },
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject invalid country code length', () => {
      const request = {
        ...validRequest,
        origin: { ...validRequest.origin, countryCode: 'USA' }, // Should be 2 chars
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should accept and uppercase country code', () => {
      const request = {
        ...validRequest,
        origin: { ...validRequest.origin, countryCode: 'us' },
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      expect((result as any).data.origin.countryCode).toBe('US');
    });
  });

  describe('Package Validation', () => {
    it('should reject empty packages array', () => {
      const request = { ...validRequest, packages: [] };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject negative dimensions', () => {
      const request = {
        ...validRequest,
        packages: [
          {
            dimensions: { length: -1, width: 8, height: 6, unit: 'IN' },
            weight: { value: 5, unit: 'LBS' },
          },
        ],
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject zero weight', () => {
      const request = {
        ...validRequest,
        packages: [
          {
            dimensions: { length: 12, width: 8, height: 6, unit: 'IN' },
            weight: { value: 0, unit: 'LBS' },
          },
        ],
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject invalid dimension unit', () => {
      const request = {
        ...validRequest,
        packages: [
          {
            dimensions: { length: 12, width: 8, height: 6, unit: 'METERS' },
            weight: { value: 5, unit: 'LBS' },
          },
        ],
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject invalid weight unit', () => {
      const request = {
        ...validRequest,
        packages: [
          {
            dimensions: { length: 12, width: 8, height: 6, unit: 'IN' },
            weight: { value: 5, unit: 'GRAMS' },
          },
        ],
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should accept valid packaging type', () => {
      const request = {
        ...validRequest,
        packages: [
          {
            dimensions: { length: 12, width: 8, height: 6, unit: 'IN' },
            weight: { value: 5, unit: 'LBS' },
            packagingType: 'SMALL_BOX',
          },
        ],
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject invalid packaging type', () => {
      const request = {
        ...validRequest,
        packages: [
          {
            dimensions: { length: 12, width: 8, height: 6, unit: 'IN' },
            weight: { value: 5, unit: 'LBS' },
            packagingType: 'INVALID_TYPE',
          },
        ],
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('Service Level Validation', () => {
    it('should accept valid service level', () => {
      const request = { ...validRequest, serviceLevel: 'GROUND' };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject invalid service level', () => {
      const request = { ...validRequest, serviceLevel: 'SUPER_FAST' };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('Carrier Validation', () => {
    it('should accept valid carrier list', () => {
      const request = { ...validRequest, carriers: ['UPS', 'FEDEX'] };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject invalid carrier', () => {
      const request = { ...validRequest, carriers: ['UPS', 'UNKNOWN_CARRIER'] };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('Declared Value Validation', () => {
    it('should accept valid declared value', () => {
      const request = {
        ...validRequest,
        packages: [
          {
            dimensions: { length: 12, width: 8, height: 6, unit: 'IN' },
            weight: { value: 5, unit: 'LBS' },
            declaredValue: { amount: 100, currency: 'USD' },
          },
        ],
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject invalid currency code', () => {
      const request = {
        ...validRequest,
        packages: [
          {
            dimensions: { length: 12, width: 8, height: 6, unit: 'IN' },
            weight: { value: 5, unit: 'LBS' },
            declaredValue: { amount: 100, currency: 'DOLLARS' },
          },
        ],
      };
      const result = RateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });
});
