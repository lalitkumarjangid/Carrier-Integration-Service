import { RateRequest, RateQuote } from '../../../types/rate';
import { UpsHttpClient } from '../client';
import { UpsRateResponse } from './types';
import { mapToUpsRateRequest, mapFromUpsRatedShipment } from './mapper';
import { malformedResponseError } from '../../../errors';

export class UpsRatingOperation {
  private readonly httpClient: UpsHttpClient;
  private readonly accountNumber: string;
  private readonly apiVersion: string;

  constructor(httpClient: UpsHttpClient, accountNumber: string, apiVersion: string) {
    this.httpClient = httpClient;
    this.accountNumber = accountNumber;
    this.apiVersion = apiVersion;
  }

  /**
   * Fetch rate quotes from UPS.
   *
   * - If serviceLevel is specified: calls `/rating/{version}/Rate` for a single rate
   * - If no serviceLevel: calls `/rating/{version}/Shop` for all available services
   *
   * Returns normalized RateQuote[] sorted by total price ascending.
   */
  async getRates(request: RateRequest): Promise<RateQuote[]> {
    const requestOption = request.serviceLevel ? 'Rate' : 'Shop';
    const path = `/api/rating/${this.apiVersion}/${requestOption}`;
    const payload = mapToUpsRateRequest(request, this.accountNumber);

    const response = await this.httpClient.post<typeof payload, UpsRateResponse>(path, payload);

    return this.parseResponse(response);
  }

  private parseResponse(response: UpsRateResponse): RateQuote[] {
    try {
      const rateResponse = response?.RateResponse;
      if (!rateResponse) {
        throw malformedResponseError('UPS', 'Missing RateResponse in response body');
      }

      const ratedShipments = rateResponse.RatedShipment;
      if (!ratedShipments) {
        throw malformedResponseError('UPS', 'Missing RatedShipment in response');
      }

      // UPS returns a single object for Rate, array for Shop
      const shipments = Array.isArray(ratedShipments) ? ratedShipments : [ratedShipments];

      const quotes = shipments.map(mapFromUpsRatedShipment);

      // Sort by total price ascending
      return quotes.sort((a, b) => a.totalCharges.amount - b.totalCharges.amount);
    } catch (error) {
      if (error instanceof Error && error.name === 'CarrierError') throw error;
      throw malformedResponseError(
        'UPS',
        `Failed to parse rate response: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
