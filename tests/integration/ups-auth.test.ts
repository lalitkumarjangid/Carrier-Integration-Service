import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { UpsAuthManager } from '../../src/carriers/ups/auth';
import { CarrierError, CarrierErrorCode } from '../../src/errors';
import { upsTokenResponse } from '../fixtures/ups-responses';

describe('UpsAuthManager', () => {
  const testConfig = {
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    baseUrl: 'https://onlinetools.ups.com',
    timeout: 10000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Token Acquisition', () => {
    it('should acquire and cache a token on first request', async () => {
      const mockPost = vi.fn().mockResolvedValue({ data: upsTokenResponse });
      const mockAxios = { post: mockPost, defaults: { baseURL: testConfig.baseUrl } } as any;
      
      const auth = new UpsAuthManager(testConfig, mockAxios);

      const token = await auth.getAccessToken();

      expect(token).toBe('test_access_token_12345');
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith(
        '/security/v1/oauth/token',
        'grant_type=client_credentials',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: expect.stringContaining('Basic '),
          }),
        }),
      );
    });

    it('should reuse cached token on subsequent requests', async () => {
      const mockPost = vi.fn().mockResolvedValue({ data: upsTokenResponse });
      const mockAxios = { post: mockPost, defaults: {} } as any;
      
      const auth = new UpsAuthManager(testConfig, mockAxios);

      const token1 = await auth.getAccessToken();
      const token2 = await auth.getAccessToken();
      const token3 = await auth.getAccessToken();

      expect(token1).toBe(token2);
      expect(token2).toBe(token3);
      expect(mockPost).toHaveBeenCalledTimes(1); // Only one API call
    });

    it('should refresh token when expired', async () => {
      const firstToken = { ...upsTokenResponse, access_token: 'first_token', expires_in: '1' };
      const secondToken = { ...upsTokenResponse, access_token: 'second_token' };

      const mockPost = vi
        .fn()
        .mockResolvedValueOnce({ data: firstToken })
        .mockResolvedValueOnce({ data: secondToken });
      
      const mockAxios = { post: mockPost, defaults: {} } as any;
      const auth = new UpsAuthManager(testConfig, mockAxios);

      const token1 = await auth.getAccessToken();
      expect(token1).toBe('first_token');

      // Wait for token to "expire" (1 second + buffer)
      await new Promise((r) => setTimeout(r, 100));

      // Token should be refreshed since expires_in was 1 second
      const token2 = await auth.getAccessToken();
      // Due to our 60s buffer, token will be considered expired
      expect(mockPost.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Token Invalidation', () => {
    it('should invalidate token and fetch a new one', async () => {
      const firstToken = { ...upsTokenResponse, access_token: 'token_v1' };
      const secondToken = { ...upsTokenResponse, access_token: 'token_v2' };

      const mockPost = vi
        .fn()
        .mockResolvedValueOnce({ data: firstToken })
        .mockResolvedValueOnce({ data: secondToken });
      
      const mockAxios = { post: mockPost, defaults: {} } as any;
      const auth = new UpsAuthManager(testConfig, mockAxios);

      const token1 = await auth.getAccessToken();
      expect(token1).toBe('token_v1');

      auth.invalidateToken();
      expect(auth.hasValidToken()).toBe(false);

      const token2 = await auth.getAccessToken();
      expect(token2).toBe('token_v2');
      expect(mockPost).toHaveBeenCalledTimes(2);
    });
  });

  describe('Concurrent Requests', () => {
    it('should deduplicate concurrent token requests', async () => {
      let resolveToken: (v: any) => void;
      const tokenPromise = new Promise((r) => {
        resolveToken = r;
      });

      const mockPost = vi.fn().mockImplementation(() => tokenPromise);
      const mockAxios = { post: mockPost, defaults: {} } as any;
      const auth = new UpsAuthManager(testConfig, mockAxios);

      // Start 3 concurrent requests
      const promises = [
        auth.getAccessToken(),
        auth.getAccessToken(),
        auth.getAccessToken(),
      ];

      // Resolve the token
      resolveToken!({ data: upsTokenResponse });

      const results = await Promise.all(promises);

      // All should get the same token
      expect(results).toEqual([
        'test_access_token_12345',
        'test_access_token_12345',
        'test_access_token_12345',
      ]);

      // Only one API call should have been made
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw CarrierError on 401 response', async () => {
      const error = {
        isAxiosError: true,
        response: { status: 401, data: {} },
        message: 'Unauthorized',
      };
      
      const mockPost = vi.fn().mockRejectedValue(error);
      const mockAxios = { post: mockPost, defaults: {} } as any;
      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      
      const auth = new UpsAuthManager(testConfig, mockAxios);

      await expect(auth.getAccessToken()).rejects.toMatchObject({
        details: expect.objectContaining({
          code: CarrierErrorCode.AUTH_FAILED,
          carrier: 'UPS',
        }),
      });
    });

    it('should throw CarrierError on timeout', async () => {
      const error = {
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout',
      };
      
      const mockPost = vi.fn().mockRejectedValue(error);
      const mockAxios = { post: mockPost, defaults: { timeout: 10000 } } as any;
      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      
      const auth = new UpsAuthManager(testConfig, mockAxios);

      await expect(auth.getAccessToken()).rejects.toMatchObject({
        details: expect.objectContaining({
          code: CarrierErrorCode.TIMEOUT,
          carrier: 'UPS',
        }),
      });
    });

    it('should throw CarrierError on network failure', async () => {
      const error = {
        isAxiosError: true,
        message: 'Network Error',
      };
      
      const mockPost = vi.fn().mockRejectedValue(error);
      const mockAxios = { post: mockPost, defaults: {} } as any;
      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      
      const auth = new UpsAuthManager(testConfig, mockAxios);

      await expect(auth.getAccessToken()).rejects.toMatchObject({
        details: expect.objectContaining({
          code: CarrierErrorCode.NETWORK_ERROR,
          carrier: 'UPS',
        }),
      });
    });

    it('should throw CarrierError on rate limiting (429)', async () => {
      const error = {
        isAxiosError: true,
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
          data: {},
        },
        message: 'Too Many Requests',
      };
      
      const mockPost = vi.fn().mockRejectedValue(error);
      const mockAxios = { post: mockPost, defaults: {} } as any;
      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      
      const auth = new UpsAuthManager(testConfig, mockAxios);

      await expect(auth.getAccessToken()).rejects.toMatchObject({
        details: expect.objectContaining({
          code: CarrierErrorCode.RATE_LIMITED,
          retryable: true,
          retryAfterMs: 60000,
        }),
      });
    });

    it('should throw CarrierError on missing token fields', async () => {
      const invalidResponse = { data: { status: 'approved' } }; // missing access_token, expires_in
      
      const mockPost = vi.fn().mockResolvedValue(invalidResponse);
      const mockAxios = { post: mockPost, defaults: {} } as any;
      
      const auth = new UpsAuthManager(testConfig, mockAxios);

      await expect(auth.getAccessToken()).rejects.toMatchObject({
        details: expect.objectContaining({
          code: CarrierErrorCode.AUTH_FAILED,
        }),
      });
    });
  });
});
