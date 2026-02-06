
export interface Address {
  /** Full name or company name */
  name: string;
  /** Street address lines */
  addressLines: string[];
  /** City name */
  city: string;
  /** State or province code (e.g., "CA", "ON") */
  stateCode: string;
  /** Postal / ZIP code */
  postalCode: string;
  /** ISO 3166-1 alpha-2 country code (e.g., "US", "CA") */
  countryCode: string;
  /** Whether this is a residential address */
  isResidential?: boolean;
}
