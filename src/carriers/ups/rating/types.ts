// ─── UPS Rating API Types ─────────────────────────────────────────────
// These types mirror the UPS Rating API request/response shapes.
// They are INTERNAL to the UPS carrier module — callers never see these.
// Based on: https://developer.ups.com/tag/Rating?loc=en_US

// ─── Request Types ───────────────────────────────────────────────────

export interface UpsRateRequest {
  RateRequest: {
    Request: {
      /** "Rate" for single service, "Shop" for all available services */
      RequestOption: string;
      SubVersion?: string;
      TransactionReference?: {
        CustomerContext?: string;
      };
    };
    Shipment: {
      Shipper: UpsShipper;
      ShipTo: UpsShipTo;
      ShipFrom: UpsShipFrom;
      /** Required for single-rate, optional for shop */
      Service?: UpsService;
      Package: UpsPackage[];
      /** Shipment-level options */
      ShipmentRatingOptions?: {
        NegotiatedRatesIndicator?: string;
        UserLevelDiscountIndicator?: string;
      };
      PaymentDetails?: {
        ShipmentCharge: Array<{
          Type: string;
          BillShipper: {
            AccountNumber: string;
          };
        }>;
      };
    };
  };
}

export interface UpsShipper {
  Name?: string;
  ShipperNumber: string;
  Address: UpsAddress;
}

export interface UpsShipTo {
  Name?: string;
  Address: UpsAddress;
}

export interface UpsShipFrom {
  Name?: string;
  Address: UpsAddress;
}

export interface UpsAddress {
  AddressLine?: string[];
  City?: string;
  StateProvinceCode?: string;
  PostalCode: string;
  CountryCode: string;
  ResidentialAddressIndicator?: string;
}

export interface UpsService {
  Code: string;
  Description?: string;
}

export interface UpsPackage {
  PackagingType: {
    Code: string;
    Description?: string;
  };
  Dimensions?: {
    UnitOfMeasurement: {
      Code: string;
      Description?: string;
    };
    Length: string;
    Width: string;
    Height: string;
  };
  PackageWeight: {
    UnitOfMeasurement: {
      Code: string;
      Description?: string;
    };
    Weight: string;
  };
  PackageServiceOptions?: {
    DeclaredValue?: {
      CurrencyCode: string;
      MonetaryValue: string;
    };
  };
}

// ─── Response Types ──────────────────────────────────────────────────

export interface UpsRateResponse {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: string;
        Description: string;
      };
      Alert?: Array<{
        Code: string;
        Description: string;
      }>;
      TransactionReference?: {
        CustomerContext?: string;
      };
    };
    RatedShipment: UpsRatedShipment | UpsRatedShipment[];
  };
}

export interface UpsRatedShipment {
  Service: {
    Code: string;
    Description?: string;
  };
  RatedShipmentAlert?: Array<{
    Code: string;
    Description: string;
  }>;
  BillingWeight: {
    UnitOfMeasurement: {
      Code: string;
      Description?: string;
    };
    Weight: string;
  };
  TransportationCharges: UpsCharges;
  BaseServiceCharge?: UpsCharges;
  ServiceOptionsCharges: UpsCharges;
  TotalCharges: UpsCharges;
  NegotiatedRateCharges?: {
    TotalCharge: UpsCharges;
  };
  GuaranteedDelivery?: {
    BusinessDaysInTransit?: string;
    DeliveryByTime?: string;
  };
  ItemizedCharges?: UpsItemizedCharge | UpsItemizedCharge[];
  RatedPackage?: UpsRatedPackage | UpsRatedPackage[];
  TimeInTransit?: {
    ServiceSummary?: {
      EstimatedArrival?: {
        Arrival?: {
          Date?: string;
          Time?: string;
        };
        BusinessDaysInTransit?: string;
      };
      Service?: {
        Description?: string;
      };
    };
  };
}

export interface UpsCharges {
  CurrencyCode: string;
  MonetaryValue: string;
}

export interface UpsItemizedCharge {
  Code: string;
  Description?: string;
  CurrencyCode: string;
  MonetaryValue: string;
  SubType?: string;
}

export interface UpsRatedPackage {
  TransportationCharges: UpsCharges;
  ServiceOptionsCharges: UpsCharges;
  TotalCharges: UpsCharges;
  Weight?: string;
  BillingWeight?: {
    UnitOfMeasurement: {
      Code: string;
    };
    Weight: string;
  };
}

// ─── Error Response ──────────────────────────────────────────────────

export interface UpsErrorResponse {
  response: {
    errors: Array<{
      code: string;
      message: string;
    }>;
  };
}
