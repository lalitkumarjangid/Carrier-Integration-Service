import { CarrierId } from '../types/common';

/** Error codes for classification */
export enum CarrierErrorCode {
  // Auth errors
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // HTTP / network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',

  // Carrier API errors
  CARRIER_API_ERROR = 'CARRIER_API_ERROR',
  CARRIER_UNAVAILABLE = 'CARRIER_UNAVAILABLE',
  MALFORMED_RESPONSE = 'MALFORMED_RESPONSE',

  // Client errors
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',

  // Internal
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/** Structured error details returned to callers */
export interface CarrierErrorDetails {
  code: CarrierErrorCode;
  message: string;
  carrier?: CarrierId;
  httpStatus?: number;
  /** Original error from the carrier API, if available */
  carrierErrorCode?: string;
  carrierErrorMessage?: string;
  /** Retry guidance */
  retryable: boolean;
  retryAfterMs?: number;
  /** Timestamp */
  timestamp: string;
}

/**
 * Base error class for all carrier integration errors.
 * Always includes structured details so callers can react programmatically.
 */
export class CarrierError extends Error {
  public readonly details: CarrierErrorDetails;

  constructor(details: CarrierErrorDetails) {
    super(details.message);
    this.name = 'CarrierError';
    this.details = details;

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, CarrierError.prototype);
  }

  /** Is this error worth retrying? */
  get retryable(): boolean {
    return this.details.retryable;
  }

  toJSON(): CarrierErrorDetails {
    return this.details;
  }
}

export function authError(carrier: CarrierId, message: string, httpStatus?: number): CarrierError {
  return new CarrierError({
    code: CarrierErrorCode.AUTH_FAILED,
    message: `[${carrier}] Authentication failed: ${message}`,
    carrier,
    httpStatus,
    retryable: false,
    timestamp: new Date().toISOString(),
  });
}

export function validationError(message: string, carrier?: CarrierId): CarrierError {
  return new CarrierError({
    code: CarrierErrorCode.VALIDATION_ERROR,
    message: `Validation error: ${message}`,
    carrier,
    retryable: false,
    timestamp: new Date().toISOString(),
  });
}

export function networkError(carrier: CarrierId, message: string): CarrierError {
  return new CarrierError({
    code: CarrierErrorCode.NETWORK_ERROR,
    message: `[${carrier}] Network error: ${message}`,
    carrier,
    retryable: true,
    timestamp: new Date().toISOString(),
  });
}

export function timeoutError(carrier: CarrierId, timeoutMs: number): CarrierError {
  return new CarrierError({
    code: CarrierErrorCode.TIMEOUT,
    message: `[${carrier}] Request timed out after ${timeoutMs}ms`,
    carrier,
    retryable: true,
    timestamp: new Date().toISOString(),
  });
}

export function rateLimitError(carrier: CarrierId, retryAfterMs?: number): CarrierError {
  return new CarrierError({
    code: CarrierErrorCode.RATE_LIMITED,
    message: `[${carrier}] Rate limit exceeded`,
    carrier,
    httpStatus: 429,
    retryable: true,
    retryAfterMs,
    timestamp: new Date().toISOString(),
  });
}

export function carrierApiError(
  carrier: CarrierId,
  message: string,
  httpStatus: number,
  carrierErrorCode?: string,
  carrierErrorMessage?: string,
): CarrierError {
  return new CarrierError({
    code: CarrierErrorCode.CARRIER_API_ERROR,
    message: `[${carrier}] API error (HTTP ${httpStatus}): ${message}`,
    carrier,
    httpStatus,
    carrierErrorCode,
    carrierErrorMessage,
    retryable: httpStatus >= 500,
    timestamp: new Date().toISOString(),
  });
}

export function malformedResponseError(carrier: CarrierId, message: string): CarrierError {
  return new CarrierError({
    code: CarrierErrorCode.MALFORMED_RESPONSE,
    message: `[${carrier}] Malformed response: ${message}`,
    carrier,
    retryable: false,
    timestamp: new Date().toISOString(),
  });
}

export function configurationError(message: string): CarrierError {
  return new CarrierError({
    code: CarrierErrorCode.CONFIGURATION_ERROR,
    message: `Configuration error: ${message}`,
    retryable: false,
    timestamp: new Date().toISOString(),
  });
}
