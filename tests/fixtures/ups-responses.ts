

import { UpsRateResponse } from '../../src/carriers/ups/rating/types';

export const upsShopSuccessResponse: UpsRateResponse = {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: '1',
        Description: 'Success',
      },
      TransactionReference: {
        CustomerContext: 'CybershipCIS Rating',
      },
    },
    RatedShipment: [
      {
        Service: {
          Code: '03',
          Description: 'UPS Ground',
        },
        BillingWeight: {
          UnitOfMeasurement: {
            Code: 'LBS',
            Description: 'Pounds',
          },
          Weight: '6.0',
        },
        TransportationCharges: {
          CurrencyCode: 'USD',
          MonetaryValue: '15.50',
        },
        ServiceOptionsCharges: {
          CurrencyCode: 'USD',
          MonetaryValue: '0.00',
        },
        TotalCharges: {
          CurrencyCode: 'USD',
          MonetaryValue: '15.50',
        },
        GuaranteedDelivery: {
          BusinessDaysInTransit: '5',
        },
        ItemizedCharges: [
          {
            Code: '375',
            Description: 'Fuel Surcharge',
            CurrencyCode: 'USD',
            MonetaryValue: '1.50',
          },
        ],
      },
      {
        Service: {
          Code: '02',
          Description: 'UPS 2nd Day Air',
        },
        BillingWeight: {
          UnitOfMeasurement: {
            Code: 'LBS',
            Description: 'Pounds',
          },
          Weight: '6.0',
        },
        TransportationCharges: {
          CurrencyCode: 'USD',
          MonetaryValue: '28.75',
        },
        ServiceOptionsCharges: {
          CurrencyCode: 'USD',
          MonetaryValue: '0.00',
        },
        TotalCharges: {
          CurrencyCode: 'USD',
          MonetaryValue: '28.75',
        },
        GuaranteedDelivery: {
          BusinessDaysInTransit: '2',
        },
      },
      {
        Service: {
          Code: '01',
          Description: 'UPS Next Day Air',
        },
        BillingWeight: {
          UnitOfMeasurement: {
            Code: 'LBS',
            Description: 'Pounds',
          },
          Weight: '6.0',
        },
        TransportationCharges: {
          CurrencyCode: 'USD',
          MonetaryValue: '45.00',
        },
        ServiceOptionsCharges: {
          CurrencyCode: 'USD',
          MonetaryValue: '0.00',
        },
        TotalCharges: {
          CurrencyCode: 'USD',
          MonetaryValue: '45.00',
        },
        GuaranteedDelivery: {
          BusinessDaysInTransit: '1',
        },
      },
    ],
  },
};

export const upsSingleRateResponse: UpsRateResponse = {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: '1',
        Description: 'Success',
      },
    },
    RatedShipment: {
      Service: {
        Code: '03',
        Description: 'UPS Ground',
      },
      BillingWeight: {
        UnitOfMeasurement: {
          Code: 'LBS',
        },
        Weight: '5.5',
      },
      TransportationCharges: {
        CurrencyCode: 'USD',
        MonetaryValue: '14.25',
      },
      ServiceOptionsCharges: {
        CurrencyCode: 'USD',
        MonetaryValue: '0.00',
      },
      TotalCharges: {
        CurrencyCode: 'USD',
        MonetaryValue: '14.25',
      },
    },
  },
};

export const upsTokenResponse = {
  access_token: 'test_access_token_12345',
  token_type: 'Bearer',
  expires_in: '14399', // UPS returns string
  issued_at: String(Date.now()),
  status: 'approved',
};

export const upsError400Response = {
  response: {
    errors: [
      {
        code: '111210',
        message: 'The requested service is invalid for the selected shipper and consignee locations.',
      },
    ],
  },
};

export const upsError401Response = {
  response: {
    errors: [
      {
        code: '250003',
        message: 'Invalid Access License number',
      },
    ],
  },
};

export const upsError429Response = {
  response: {
    errors: [
      {
        code: '429',
        message: 'Rate limit exceeded',
      },
    ],
  },
};

export const upsError500Response = {
  response: {
    errors: [
      {
        code: 'XXXXXXX',
        message: 'Internal server error',
      },
    ],
  },
};

export const sampleRateRequest = {
  origin: {
    name: 'Test Shipper',
    addressLines: ['123 Main St'],
    city: 'San Francisco',
    stateCode: 'CA',
    postalCode: '94105',
    countryCode: 'US',
  },
  destination: {
    name: 'Test Customer',
    addressLines: ['456 Oak Ave'],
    city: 'New York',
    stateCode: 'NY',
    postalCode: '10001',
    countryCode: 'US',
    isResidential: true,
  },
  packages: [
    {
      dimensions: {
        length: 12,
        width: 8,
        height: 6,
        unit: 'IN' as const,
      },
      weight: {
        value: 5.5,
        unit: 'LBS' as const,
      },
    },
  ],
};
