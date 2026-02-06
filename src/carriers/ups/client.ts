// ─── UPS HTTP Client ──────────────────────────────────────────────────
// Thin wrapper around axios for UPS API calls.
// Handles auth header injection, retries on 401, and error classification.

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { UpsAuthManager } from './auth';
import {
  CarrierError,
  CarrierErrorCode,
  carrierApiError,
  networkError,
  timeoutError,
  rateLimitError,
  malformedResponseError,
} from '../../errors';

export interface UpsClientConfig {
  baseUrl: string;
  timeout: number;
  transactionSource: string;
}

/**
 * HTTP client for UPS API calls.
 * - Automatically injects OAuth bearer token
 * - Retries once on 401 (after refreshing token)
 * - Classifies all errors into structured CarrierErrors
 */
export class UpsHttpClient {
  private readonly httpClient: AxiosInstance;
  private readonly auth: UpsAuthManager;
  private readonly transactionSource: string;

  constructor(config: UpsClientConfig, auth: UpsAuthManager, httpClient?: AxiosInstance) {
    this.auth = auth;
    this.transactionSource = config.transactionSource;
    this.httpClient =
      httpClient ??
      axios.create({
        baseURL: config.baseUrl,
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
  }

  /**
   * Make an authenticated POST request to the UPS API.
   * Transparently handles token injection and 401 retry.
   */
  async post<TRequest, TResponse>(
    path: string,
    data: TRequest,
    config?: AxiosRequestConfig,
  ): Promise<TResponse> {
    const makeRequest = async (): Promise<AxiosResponse<TResponse>> => {
      const token = await this.auth.getAccessToken();
      return this.httpClient.post<TResponse>(path, data, {
        ...config,
        headers: {
          ...config?.headers,
          Authorization: `Bearer ${token}`,
          transactionSrc: this.transactionSource,
          transId: this.generateTransactionId(),
        },
      });
    };

    try {
      const response = await makeRequest();
      return response.data;
    } catch (error) {
      // If 401, invalidate token and retry once
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        this.auth.invalidateToken();
        try {
          const response = await makeRequest();
          return response.data;
        } catch (retryError) {
          throw this.classifyError(retryError);
        }
      }
      throw this.classifyError(error);
    }
  }

  /** Classify raw errors into structured CarrierErrors */
  private classifyError(error: unknown): CarrierError {
    if (error instanceof CarrierError) return error;

    if (axios.isAxiosError(error)) {
      // Network / timeout errors (no response)
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return timeoutError('UPS', this.httpClient.defaults.timeout ?? 10_000);
      }
      if (!error.response) {
        return networkError('UPS', error.message);
      }

      const { status, data } = error.response;

      // Rate limiting
      if (status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        return rateLimitError('UPS', retryAfter ? Number(retryAfter) * 1000 : undefined);
      }

      // Extract UPS-specific error details from response body
      const upsError = this.extractUpsError(data);

      // Auth errors
      if (status === 401) {
        return new CarrierError({
          code: CarrierErrorCode.AUTH_FAILED,
          message: `[UPS] Authentication failed: ${upsError.message}`,
          carrier: 'UPS',
          httpStatus: status,
          carrierErrorCode: upsError.code,
          carrierErrorMessage: upsError.message,
          retryable: false,
          timestamp: new Date().toISOString(),
        });
      }

      if (status === 403) {
        return new CarrierError({
          code: CarrierErrorCode.FORBIDDEN,
          message: `[UPS] Forbidden: ${upsError.message}`,
          carrier: 'UPS',
          httpStatus: status,
          carrierErrorCode: upsError.code,
          carrierErrorMessage: upsError.message,
          retryable: false,
          timestamp: new Date().toISOString(),
        });
      }

      // Client errors (4xx)
      if (status >= 400 && status < 500) {
        return carrierApiError('UPS', upsError.message, status, upsError.code, upsError.message);
      }

      // Server errors (5xx) — retryable
      return carrierApiError('UPS', upsError.message, status, upsError.code, upsError.message);
    }

    // Non-axios errors (e.g., JSON parse failures)
    return malformedResponseError('UPS', error instanceof Error ? error.message : 'Unknown error');
  }

  /** Extract error details from UPS API response body */
  private extractUpsError(data: unknown): { code: string; message: string } {
    try {
      if (data && typeof data === 'object') {
        const response = data as Record<string, unknown>;

        // UPS error response format
        if (response.response && typeof response.response === 'object') {
          const resp = response.response as Record<string, unknown>;
          if (resp.errors && Array.isArray(resp.errors) && resp.errors.length > 0) {
            const firstError = resp.errors[0] as Record<string, unknown>;
            return {
              code: String(firstError.code ?? 'UNKNOWN'),
              message: String(firstError.message ?? 'Unknown UPS error'),
            };
          }
        }
      }
    } catch {
      // Fall through to default
    }
    return { code: 'UNKNOWN', message: 'Unknown UPS API error' };
  }

  private generateTransactionId(): string {
    return `cis-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
