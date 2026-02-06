import { CarrierProvider, CarrierOperation } from '../carrier.interface';
import { CarrierId } from '../../types/common';
import { RateRequest, RateQuote } from '../../types/rate';
import { UpsAuthManager, UpsAuthConfig } from './auth';
import { UpsHttpClient, UpsClientConfig } from './client';
import { UpsRatingOperation } from './rating/operation';

export interface UpsCarrierConfig {
  clientId: string;
  clientSecret: string;
  accountNumber: string;
  baseUrl: string;
  timeout: number;
  transactionSource: string;
  ratingApiVersion: string;
}

export class UpsCarrier implements CarrierProvider {
  readonly carrierId: CarrierId = 'UPS';
  readonly carrierName = 'United Parcel Service';
  readonly supportedOperations: CarrierOperation[] = ['rate'];

  private readonly ratingOperation: UpsRatingOperation;
  private readonly authManager: UpsAuthManager;

  constructor(config: UpsCarrierConfig, authManager?: UpsAuthManager, httpClient?: UpsHttpClient) {
    // Auth
    const authConfig: UpsAuthConfig = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
    };
    this.authManager = authManager ?? new UpsAuthManager(authConfig);

    // HTTP client
    const clientConfig: UpsClientConfig = {
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      transactionSource: config.transactionSource,
    };
    const client = httpClient ?? new UpsHttpClient(clientConfig, this.authManager);

    // Operations
    this.ratingOperation = new UpsRatingOperation(client, config.accountNumber, config.ratingApiVersion);
  }

  /**
   * Get normalized rate quotes from UPS.
   * The caller provides carrier-agnostic types and receives carrier-agnostic results.
   */
  async getRates(request: RateRequest): Promise<RateQuote[]> {
    return this.ratingOperation.getRates(request);
  }

  // Future operations would be added here:
  // async purchaseLabel(request: LabelRequest): Promise<LabelResponse> { ... }
  // async trackShipment(trackingNumber: string): Promise<TrackingResponse> { ... }
}
