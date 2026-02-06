// ─── UPS Rating Mappers ───────────────────────────────────────────────
// Bidirectional mapping between carrier-agnostic domain models and
// UPS-specific API shapes. This is the boundary layer — all UPS
// specifics are contained here.

import { Address } from '../../../types/address';
import { Package, PackagingType } from '../../../types/package';
import { RateRequest, RateQuote, Surcharge } from '../../../types/rate';
import { ServiceLevel, Money } from '../../../types/common';
import {
  UpsRateRequest,
  UpsRatedShipment,
  UpsAddress,
  UpsPackage,
  UpsItemizedCharge,
} from './types';

// ─── Service Code Mappings ───────────────────────────────────────────
// Maps between UPS service codes and our carrier-agnostic service levels.
// Reference: UPS Service Code listing from Rating API appendix.

const UPS_SERVICE_CODE_TO_LEVEL: Record<string, ServiceLevel> = {
  '01': 'NEXT_DAY_AIR',
  '02': 'SECOND_DAY_AIR',
  '03': 'GROUND',
  '07': 'EXPRESS',            // Worldwide Express
  '08': 'EXPEDITED',          // Worldwide Expedited
  '11': 'STANDARD',           // Standard
  '12': 'THREE_DAY_SELECT',
  '13': 'NEXT_DAY_AIR_SAVER',
  '14': 'NEXT_DAY_AIR_EARLY', // Next Day Air Early
  '54': 'EXPRESS_PLUS',       // Worldwide Express Plus
  '59': 'SECOND_DAY_AIR_AM',
  '65': 'SAVER',              // World Wide Saver
};

const SERVICE_LEVEL_TO_UPS_CODE: Partial<Record<ServiceLevel, string>> = {
  NEXT_DAY_AIR: '01',
  SECOND_DAY_AIR: '02',
  GROUND: '03',
  EXPRESS: '07',
  EXPEDITED: '08',
  STANDARD: '11',
  THREE_DAY_SELECT: '12',
  NEXT_DAY_AIR_SAVER: '13',
  NEXT_DAY_AIR_EARLY: '14',
  EXPRESS_PLUS: '54',
  SECOND_DAY_AIR_AM: '59',
  SAVER: '65',
};

const UPS_SERVICE_NAMES: Record<string, string> = {
  '01': 'UPS Next Day Air',
  '02': 'UPS 2nd Day Air',
  '03': 'UPS Ground',
  '07': 'UPS Worldwide Express',
  '08': 'UPS Worldwide Expedited',
  '11': 'UPS Standard',
  '12': 'UPS 3 Day Select',
  '13': 'UPS Next Day Air Saver',
  '14': 'UPS Next Day Air Early',
  '54': 'UPS Worldwide Express Plus',
  '59': 'UPS 2nd Day Air A.M.',
  '65': 'UPS Worldwide Saver',
};

// ─── Packaging Type Mappings ─────────────────────────────────────────

const PACKAGING_TYPE_TO_UPS: Record<PackagingType, string> = {
  CUSTOM: '02',        // Customer Supplied Package
  LETTER: '01',        // UPS Letter
  TUBE: '03',          // Tube
  PAK: '04',           // PAK
  SMALL_BOX: '21',     // UPS Express Small Box
  MEDIUM_BOX: '22',    // UPS Express Medium Box
  LARGE_BOX: '25',     // UPS Express Large Box
};

// ─── Request Mapping ─────────────────────────────────────────────────

/**
 * Map a domain RateRequest into a UPS-specific RateRequest payload.
 * The caller never needs to know about UPS's format.
 */
export function mapToUpsRateRequest(
  request: RateRequest,
  accountNumber: string,
): UpsRateRequest {
  const requestOption = request.serviceLevel ? 'Rate' : 'Shop';

  const upsRequest: UpsRateRequest = {
    RateRequest: {
      Request: {
        RequestOption: requestOption,
        TransactionReference: {
          CustomerContext: 'CybershipCIS Rating',
        },
      },
      Shipment: {
        Shipper: {
          Name: request.origin.name,
          ShipperNumber: request.shipperAccountNumber ?? accountNumber,
          Address: mapToUpsAddress(request.origin),
        },
        ShipTo: {
          Name: request.destination.name,
          Address: mapToUpsAddress(request.destination),
        },
        ShipFrom: {
          Name: request.origin.name,
          Address: mapToUpsAddress(request.origin),
        },
        Package: request.packages.map(mapToUpsPackage),
        PaymentDetails: {
          ShipmentCharge: [
            {
              Type: '01', // Transportation
              BillShipper: {
                AccountNumber: request.shipperAccountNumber ?? accountNumber,
              },
            },
          ],
        },
      },
    },
  };

  // If a specific service level was requested, include the service code
  if (request.serviceLevel) {
    const serviceCode = SERVICE_LEVEL_TO_UPS_CODE[request.serviceLevel];
    if (serviceCode) {
      upsRequest.RateRequest.Shipment.Service = {
        Code: serviceCode,
        Description: UPS_SERVICE_NAMES[serviceCode],
      };
    }
  }

  return upsRequest;
}

function mapToUpsAddress(address: Address): UpsAddress {
  const upsAddr: UpsAddress = {
    AddressLine: address.addressLines,
    City: address.city,
    StateProvinceCode: address.stateCode,
    PostalCode: address.postalCode,
    CountryCode: address.countryCode,
  };

  if (address.isResidential) {
    upsAddr.ResidentialAddressIndicator = 'Y';
  }

  return upsAddr;
}

function mapToUpsPackage(pkg: Package): UpsPackage {
  const upsPackage: UpsPackage = {
    PackagingType: {
      Code: pkg.packagingType ? PACKAGING_TYPE_TO_UPS[pkg.packagingType] : '02',
      Description: pkg.packagingType ?? 'Customer Supplied Package',
    },
    Dimensions: {
      UnitOfMeasurement: {
        Code: pkg.dimensions.unit,
        Description: pkg.dimensions.unit === 'IN' ? 'Inches' : 'Centimeters',
      },
      Length: String(pkg.dimensions.length),
      Width: String(pkg.dimensions.width),
      Height: String(pkg.dimensions.height),
    },
    PackageWeight: {
      UnitOfMeasurement: {
        Code: pkg.weight.unit,
        Description: pkg.weight.unit === 'LBS' ? 'Pounds' : 'Kilograms',
      },
      Weight: String(pkg.weight.value),
    },
  };

  if (pkg.declaredValue) {
    upsPackage.PackageServiceOptions = {
      DeclaredValue: {
        CurrencyCode: pkg.declaredValue.currency,
        MonetaryValue: String(pkg.declaredValue.amount),
      },
    };
  }

  return upsPackage;
}

// ─── Response Mapping ────────────────────────────────────────────────

/**
 * Map a UPS RatedShipment into a normalized RateQuote.
 * All UPS-specific fields are translated to domain types.
 */
export function mapFromUpsRatedShipment(rated: UpsRatedShipment): RateQuote {
  const serviceCode = rated.Service.Code;

  return {
    carrier: 'UPS',
    serviceCode,
    serviceName: UPS_SERVICE_NAMES[serviceCode] ?? rated.Service.Description ?? `UPS Service ${serviceCode}`,
    serviceLevel: UPS_SERVICE_CODE_TO_LEVEL[serviceCode] ?? 'STANDARD',
    totalCharges: mapUpsCharges(rated.TotalCharges),
    baseCharges: mapUpsCharges(rated.TransportationCharges),
    surcharges: mapUpsSurcharges(rated.ItemizedCharges),
    transitDays: parseTransitDays(rated),
    estimatedDelivery: parseEstimatedDelivery(rated),
    guaranteed: !!rated.GuaranteedDelivery,
    billingWeight: {
      value: parseFloat(rated.BillingWeight.Weight),
      unit: rated.BillingWeight.UnitOfMeasurement.Code,
    },
  };
}

function mapUpsCharges(charges: { CurrencyCode: string; MonetaryValue: string }): Money {
  return {
    amount: parseFloat(charges.MonetaryValue),
    currency: charges.CurrencyCode,
  };
}

function mapUpsSurcharges(itemized?: UpsItemizedCharge | UpsItemizedCharge[]): Surcharge[] {
  if (!itemized) return [];

  const charges = Array.isArray(itemized) ? itemized : [itemized];
  return charges
    .filter((c) => parseFloat(c.MonetaryValue) > 0)
    .map((charge) => ({
      code: charge.Code,
      description: charge.Description ?? `Surcharge ${charge.Code}`,
      amount: {
        amount: parseFloat(charge.MonetaryValue),
        currency: charge.CurrencyCode,
      },
    }));
}

function parseTransitDays(rated: UpsRatedShipment): number | undefined {
  // From GuaranteedDelivery
  if (rated.GuaranteedDelivery?.BusinessDaysInTransit) {
    return parseInt(rated.GuaranteedDelivery.BusinessDaysInTransit, 10);
  }
  // From TimeInTransit
  if (rated.TimeInTransit?.ServiceSummary?.EstimatedArrival?.BusinessDaysInTransit) {
    return parseInt(rated.TimeInTransit.ServiceSummary.EstimatedArrival.BusinessDaysInTransit, 10);
  }
  return undefined;
}

function parseEstimatedDelivery(rated: UpsRatedShipment): string | undefined {
  if (rated.TimeInTransit?.ServiceSummary?.EstimatedArrival?.Arrival?.Date) {
    return rated.TimeInTransit.ServiceSummary.EstimatedArrival.Arrival.Date;
  }
  return undefined;
}
