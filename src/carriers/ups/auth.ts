

import axios, { AxiosInstance } from 'axios';
import {
  CarrierError,
  CarrierErrorCode,
  authError,
  networkError,
  timeoutError,
} from '../../errors';

export interface UpsAuthConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  timeout: number;
}

interface TokenData {
  accessToken: string;
  expiresAt: number; // unix timestamp in ms
  tokenType: string;
}

/**
 * Manages UPS OAuth 2.0 client-credentials tokens.
 *
 * - Acquires token on first use
 * - Caches and reuses valid tokens
 * - Transparently refreshes when token is expired or about to expire
 * - Thread-safe: concurrent callers share one inflight token request
 */
export class UpsAuthManager {
  private token: TokenData | null = null;
  private inflightRequest: Promise<TokenData> | null = null;
  private readonly httpClient: AxiosInstance;
  private readonly config: UpsAuthConfig;

  /** Buffer before actual expiry to proactively refresh (60 seconds) */
  private static readonly EXPIRY_BUFFER_MS = 60_000;

  constructor(config: UpsAuthConfig, httpClient?: AxiosInstance) {
    this.config = config;
    this.httpClient =
      httpClient ??
      axios.create({
        baseURL: config.baseUrl,
        timeout: config.timeout,
      });
  }

  /**
   * Get a valid access token. Acquires or refreshes as needed.
   * The caller never manages the token lifecycle.
   */
  async getAccessToken(): Promise<string> {
    if (this.token && !this.isExpired(this.token)) {
      return this.token.accessToken;
    }

    // Deduplicate concurrent requests — only one token fetch at a time
    if (!this.inflightRequest) {
      this.inflightRequest = this.acquireToken().finally(() => {
        this.inflightRequest = null;
      });
    }

    const tokenData = await this.inflightRequest;
    this.token = tokenData;
    return tokenData.accessToken;
  }

  /** Force-clear the cached token (e.g., after a 401 from the API) */
  invalidateToken(): void {
    this.token = null;
  }

  /** Check whether the current token is still valid */
  hasValidToken(): boolean {
    return this.token !== null && !this.isExpired(this.token);
  }

  private isExpired(token: TokenData): boolean {
    return Date.now() >= token.expiresAt - UpsAuthManager.EXPIRY_BUFFER_MS;
  }

  /**
   * Acquire a new token via the UPS OAuth client-credentials endpoint.
   *
   * POST /security/v1/oauth/token
   * Authorization: Basic base64(client_id:client_secret)
   * Content-Type: application/x-www-form-urlencoded
   * Body: grant_type=client_credentials
   */
  private async acquireToken(): Promise<TokenData> {
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');

    try {
      const response = await this.httpClient.post(
        '/security/v1/oauth/token',
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const data = response.data;

      // Validate the response contains expected fields
      if (!data.access_token || !data.expires_in) {
        throw authError(
          'UPS',
          'Token response missing required fields (access_token, expires_in)',
          response.status,
        );
      }

      return {
        accessToken: data.access_token,
        tokenType: data.token_type ?? 'Bearer',
        expiresAt: Date.now() + Number(data.expires_in) * 1000,
      };
    } catch (error) {
      if (error instanceof CarrierError) throw error;
      throw this.classifyAuthError(error);
    }
  }

  /** Map raw errors to structured CarrierErrors */
  private classifyAuthError(error: unknown): CarrierError {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return timeoutError('UPS', this.config.timeout);
      }
      if (!error.response) {
        return networkError('UPS', error.message);
      }
      const status = error.response.status;
      if (status === 401 || status === 403) {
        return authError('UPS', 'Invalid client credentials', status);
      }
      if (status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        return new CarrierError({
          code: CarrierErrorCode.RATE_LIMITED,
          message: '[UPS] Rate limited during authentication',
          carrier: 'UPS',
          httpStatus: 429,
          retryable: true,
          retryAfterMs: retryAfter ? Number(retryAfter) * 1000 : undefined,
          timestamp: new Date().toISOString(),
        });
      }
      return authError('UPS', `HTTP ${status}: ${error.message}`, status);
    }
    return authError('UPS', error instanceof Error ? error.message : 'Unknown auth error');
  }
}
