export * from './types';
export * from './errors';
export * from './carriers';
export * from './services';
export * from './validation/schemas';
export { loadConfig, AppConfig } from './config';

import { loadConfig } from './config';
import { CarrierRegistry, UpsCarrier } from './carriers';
import { RateShoppingService } from './services';

/**
 * Create a fully configured RateShoppingService with default settings.
 * Reads configuration from environment variables.
 */
export function createRateShoppingService(): RateShoppingService {
  const config = loadConfig();

  // Initialize carriers
  const upsCarrier = new UpsCarrier({
    clientId: config.ups.clientId,
    clientSecret: config.ups.clientSecret,
    accountNumber: config.ups.accountNumber,
    baseUrl: config.ups.baseUrl,
    timeout: config.http.timeout,
    transactionSource: config.transactionSource,
    ratingApiVersion: config.ups.ratingApiVersion,
  });

  // Build registry
  const registry = new CarrierRegistry();
  registry.register(upsCarrier);

  // Future carriers would be added here:
  // registry.register(new FedExCarrier(fedexConfig));
  // registry.register(new UspsCarrier(uspsConfig));

  return new RateShoppingService(registry);
}
