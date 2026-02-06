import { z } from 'zod';

export const AddressSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  addressLines: z
    .array(z.string().min(1))
    .min(1, 'At least one address line is required')
    .max(3, 'Maximum 3 address lines'),
  city: z.string().min(1, 'City is required'),
  stateCode: z
    .string()
    .min(2, 'State code must be at least 2 characters')
    .max(5),
  postalCode: z.string().min(1, 'Postal code is required'),
  countryCode: z
    .string()
    .length(2, 'Country code must be ISO 3166-1 alpha-2 (2 characters)')
    .toUpperCase(),
  isResidential: z.boolean().optional(),
});

export const PackageDimensionsSchema = z.object({
  length: z.number().positive('Length must be positive'),
  width: z.number().positive('Width must be positive'),
  height: z.number().positive('Height must be positive'),
  unit: z.enum(['IN', 'CM']),
});

export const PackageWeightSchema = z.object({
  value: z.number().positive('Weight must be positive'),
  unit: z.enum(['LBS', 'KGS']),
});

export const PackagingTypeSchema = z.enum([
  'CUSTOM',
  'LETTER',
  'TUBE',
  'PAK',
  'SMALL_BOX',
  'MEDIUM_BOX',
  'LARGE_BOX',
]);

export const DeclaredValueSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3, 'Currency must be ISO 4217 (3 characters)'),
});

export const PackageSchema = z.object({
  dimensions: PackageDimensionsSchema,
  weight: PackageWeightSchema,
  packagingType: PackagingTypeSchema.optional(),
  declaredValue: DeclaredValueSchema.optional(),
});

export const ServiceLevelSchema = z.enum([
  'GROUND',
  'EXPRESS',
  'EXPRESS_PLUS',
  'EXPEDITED',
  'STANDARD',
  'NEXT_DAY_AIR',
  'NEXT_DAY_AIR_EARLY',
  'NEXT_DAY_AIR_SAVER',
  'SECOND_DAY_AIR',
  'SECOND_DAY_AIR_AM',
  'THREE_DAY_SELECT',
  'SAVER',
]);

export const CarrierIdSchema = z.enum(['UPS', 'FEDEX', 'USPS', 'DHL']);

export const RateRequestSchema = z.object({
  origin: AddressSchema,
  destination: AddressSchema,
  packages: z
    .array(PackageSchema)
    .min(1, 'At least one package is required')
    .max(50, 'Maximum 50 packages per shipment'),
  serviceLevel: ServiceLevelSchema.optional(),
  carriers: z.array(CarrierIdSchema).optional(),
  shipperAccountNumber: z.string().optional(),
});
