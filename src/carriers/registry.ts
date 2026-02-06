import { CarrierId } from '../types/common';
import { CarrierProvider, CarrierOperation } from './carrier.interface';
import { CarrierError, CarrierErrorCode } from '../errors';

export class CarrierRegistry {
  private carriers = new Map<CarrierId, CarrierProvider>();

  /** Register a carrier provider */
  register(provider: CarrierProvider): void {
    if (this.carriers.has(provider.carrierId)) {
      throw new CarrierError({
        code: CarrierErrorCode.CONFIGURATION_ERROR,
        message: `Carrier ${provider.carrierId} is already registered`,
        retryable: false,
        timestamp: new Date().toISOString(),
      });
    }
    this.carriers.set(provider.carrierId, provider);
  }

  /** Get a specific carrier provider */
  get(carrierId: CarrierId): CarrierProvider {
    const provider = this.carriers.get(carrierId);
    if (!provider) {
      throw new CarrierError({
        code: CarrierErrorCode.CARRIER_UNAVAILABLE,
        message: `Carrier ${carrierId} is not registered`,
        carrier: carrierId,
        retryable: false,
        timestamp: new Date().toISOString(),
      });
    }
    return provider;
  }

  /** Get all registered carriers */
  getAll(): CarrierProvider[] {
    return Array.from(this.carriers.values());
  }

  /** Get carriers that support a specific operation */
  getByOperation(operation: CarrierOperation): CarrierProvider[] {
    return this.getAll().filter((c) => c.supportedOperations.includes(operation));
  }

  /** Get carriers filtered by ID list */
  getByIds(ids: CarrierId[]): CarrierProvider[] {
    return ids.map((id) => this.get(id));
  }

  /** Check if a carrier is registered */
  has(carrierId: CarrierId): boolean {
    return this.carriers.has(carrierId);
  }

  /** List all registered carrier IDs */
  listCarrierIds(): CarrierId[] {
    return Array.from(this.carriers.keys());
  }
}
