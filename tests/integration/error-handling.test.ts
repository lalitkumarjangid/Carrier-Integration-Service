import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { UpsHttpClient, UpsClientConfig } from '../../src/carriers/ups/client';
import { UpsAuthManager } from '../../src/carriers/ups/auth';
import { CarrierError, CarrierErrorCode } from '../../src/errors';
import {
  upsError400Response,
  upsError401Response,
  upsError429Response,
  upsError500Response,
} from '../fixtures/ups-responses';

describe('Error Handling', () => {
  const clientConfig: UpsClientConfig = {
    baseUrl: 'https://onlinetools.ups.com',
    timeout: 10000,
    transactionSource: 'TestApp',
  };

  describe('HTTP Error Classification', () => {
    it('should produce structured error for 400 Bad Request', async () => {
      const mockAuth = {
        getAccessToken: vi.fn().mockResolvedValue('token'),
        invalidateToken: vi.fn(),
      } as unknown as UpsAuthManager;

      const error = {
        isAxiosError: true,
        response: {
          status: 400,
          data: upsError400Response,
          headers: {},
        },
        message: 'Bad Request',
      };

      const mockAxios = {
        post: vi.fn().mockRejectedValue(error),
        defaults: { timeout: 10000 },
      };

      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      const client = new UpsHttpClient(clientConfig, mockAuth, mockAxios as any);

      try {
        await client.post('/test', {});
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CarrierError);
        const err = e as CarrierError;
        expect(err.details.code).toBe(CarrierErrorCode.CARRIER_API_ERROR);
        expect(err.details.carrier).toBe('UPS');
        expect(err.details.httpStatus).toBe(400);
        expect(err.details.retryable).toBe(false);
        expect(err.details.carrierErrorCode).toBe('111210');
      }
    });

    it('should produce structured error for 401 Unauthorized', async () => {
      const mockAuth = {
        getAccessToken: vi.fn().mockResolvedValue('token'),
        invalidateToken: vi.fn(),
      } as unknown as UpsAuthManager;

      const error = {
        isAxiosError: true,
        response: {
          status: 401,
          data: upsError401Response,
          headers: {},
        },
        message: 'Unauthorized',
      };

      const mockAxios = {
        post: vi.fn().mockRejectedValue(error),
        defaults: {},
      };

      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      const client = new UpsHttpClient(clientConfig, mockAuth, mockAxios as any);

      try {
        await client.post('/test', {});
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CarrierError);
        const err = e as CarrierError;
        expect(err.details.code).toBe(CarrierErrorCode.AUTH_FAILED);
        expect(err.details.retryable).toBe(false);
      }
    });

    it('should produce structured error for 403 Forbidden', async () => {
      const mockAuth = {
        getAccessToken: vi.fn().mockResolvedValue('token'),
        invalidateToken: vi.fn(),
      } as unknown as UpsAuthManager;

      const error = {
        isAxiosError: true,
        response: {
          status: 403,
          data: { response: { errors: [{ code: 'BLOCKED', message: 'Merchant blocked' }] } },
          headers: {},
        },
        message: 'Forbidden',
      };

      const mockAxios = {
        post: vi.fn().mockRejectedValue(error),
        defaults: {},
      };

      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      const client = new UpsHttpClient(clientConfig, mockAuth, mockAxios as any);

      try {
        await client.post('/test', {});
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CarrierError);
        const err = e as CarrierError;
        expect(err.details.code).toBe(CarrierErrorCode.FORBIDDEN);
      }
    });

    it('should produce retryable error for 429 Rate Limited', async () => {
      const mockAuth = {
        getAccessToken: vi.fn().mockResolvedValue('token'),
        invalidateToken: vi.fn(),
      } as unknown as UpsAuthManager;

      const error = {
        isAxiosError: true,
        response: {
          status: 429,
          data: upsError429Response,
          headers: { 'retry-after': '30' },
        },
        message: 'Too Many Requests',
      };

      const mockAxios = {
        post: vi.fn().mockRejectedValue(error),
        defaults: {},
      };

      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      const client = new UpsHttpClient(clientConfig, mockAuth, mockAxios as any);

      try {
        await client.post('/test', {});
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CarrierError);
        const err = e as CarrierError;
        expect(err.details.code).toBe(CarrierErrorCode.RATE_LIMITED);
        expect(err.details.retryable).toBe(true);
        expect(err.details.retryAfterMs).toBe(30000);
      }
    });

    it('should produce retryable error for 500 Server Error', async () => {
      const mockAuth = {
        getAccessToken: vi.fn().mockResolvedValue('token'),
        invalidateToken: vi.fn(),
      } as unknown as UpsAuthManager;

      const error = {
        isAxiosError: true,
        response: {
          status: 500,
          data: upsError500Response,
          headers: {},
        },
        message: 'Internal Server Error',
      };

      const mockAxios = {
        post: vi.fn().mockRejectedValue(error),
        defaults: {},
      };

      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      const client = new UpsHttpClient(clientConfig, mockAuth, mockAxios as any);

      try {
        await client.post('/test', {});
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CarrierError);
        const err = e as CarrierError;
        expect(err.details.code).toBe(CarrierErrorCode.CARRIER_API_ERROR);
        expect(err.details.retryable).toBe(true); // 5xx should be retryable
        expect(err.details.httpStatus).toBe(500);
      }
    });

    it('should produce timeout error for ECONNABORTED', async () => {
      const mockAuth = {
        getAccessToken: vi.fn().mockResolvedValue('token'),
        invalidateToken: vi.fn(),
      } as unknown as UpsAuthManager;

      const error = {
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      };

      const mockAxios = {
        post: vi.fn().mockRejectedValue(error),
        defaults: { timeout: 10000 },
      };

      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      const client = new UpsHttpClient(clientConfig, mockAuth, mockAxios as any);

      try {
        await client.post('/test', {});
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CarrierError);
        const err = e as CarrierError;
        expect(err.details.code).toBe(CarrierErrorCode.TIMEOUT);
        expect(err.details.retryable).toBe(true);
      }
    });

    it('should produce network error when no response', async () => {
      const mockAuth = {
        getAccessToken: vi.fn().mockResolvedValue('token'),
        invalidateToken: vi.fn(),
      } as unknown as UpsAuthManager;

      const error = {
        isAxiosError: true,
        message: 'Network Error',
        // No response property
      };

      const mockAxios = {
        post: vi.fn().mockRejectedValue(error),
        defaults: {},
      };

      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      const client = new UpsHttpClient(clientConfig, mockAuth, mockAxios as any);

      try {
        await client.post('/test', {});
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CarrierError);
        const err = e as CarrierError;
        expect(err.details.code).toBe(CarrierErrorCode.NETWORK_ERROR);
        expect(err.details.retryable).toBe(true);
      }
    });
  });

  describe('Malformed Response Handling', () => {
    it('should produce malformed response error for missing RateResponse', async () => {
      const { UpsRatingOperation } = await import('../../src/carriers/ups/rating/operation');

      const mockHttpClient = {
        post: vi.fn().mockResolvedValue({ notRateResponse: {} }),
      };

      const operation = new UpsRatingOperation(mockHttpClient as any, '123456', 'v2409');

      try {
        await operation.getRates({
          origin: { name: 'A', addressLines: ['1'], city: 'C', stateCode: 'CA', postalCode: '90210', countryCode: 'US' },
          destination: { name: 'B', addressLines: ['2'], city: 'D', stateCode: 'NY', postalCode: '10001', countryCode: 'US' },
          packages: [{ dimensions: { length: 1, width: 1, height: 1, unit: 'IN' }, weight: { value: 1, unit: 'LBS' } }],
        });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CarrierError);
        const err = e as CarrierError;
        expect(err.details.code).toBe(CarrierErrorCode.MALFORMED_RESPONSE);
      }
    });

    it('should produce malformed response error for missing RatedShipment', async () => {
      const { UpsRatingOperation } = await import('../../src/carriers/ups/rating/operation');

      const mockHttpClient = {
        post: vi.fn().mockResolvedValue({
          RateResponse: {
            Response: { ResponseStatus: { Code: '1' } },
            // Missing RatedShipment
          },
        }),
      };

      const operation = new UpsRatingOperation(mockHttpClient as any, '123456', 'v2409');

      try {
        await operation.getRates({
          origin: { name: 'A', addressLines: ['1'], city: 'C', stateCode: 'CA', postalCode: '90210', countryCode: 'US' },
          destination: { name: 'B', addressLines: ['2'], city: 'D', stateCode: 'NY', postalCode: '10001', countryCode: 'US' },
          packages: [{ dimensions: { length: 1, width: 1, height: 1, unit: 'IN' }, weight: { value: 1, unit: 'LBS' } }],
        });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CarrierError);
        expect((e as CarrierError).details.code).toBe(CarrierErrorCode.MALFORMED_RESPONSE);
      }
    });
  });

  describe('Automatic 401 Retry', () => {
    it('should retry after invalidating token on 401', async () => {
      const mockAuth = {
        getAccessToken: vi.fn()
          .mockResolvedValueOnce('old_token')
          .mockResolvedValueOnce('new_token'),
        invalidateToken: vi.fn(),
      } as unknown as UpsAuthManager;

      const error401 = {
        isAxiosError: true,
        response: { status: 401, data: upsError401Response, headers: {} },
        message: 'Unauthorized',
      };

      const successResponse = { data: 'success' };

      const mockAxios = {
        post: vi.fn()
          .mockRejectedValueOnce(error401)
          .mockResolvedValueOnce({ data: successResponse }),
        defaults: {},
      };

      vi.spyOn(axios, 'isAxiosError').mockImplementation((e: any) => e?.isAxiosError);

      const client = new UpsHttpClient(clientConfig, mockAuth, mockAxios as any);

      const result = await client.post('/test', {});

      expect(mockAuth.invalidateToken).toHaveBeenCalledTimes(1);
      expect(mockAuth.getAccessToken).toHaveBeenCalledTimes(2);
      expect(result).toEqual(successResponse);
    });
  });
});
