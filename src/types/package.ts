
export interface PackageDimensions {
  /** Length in inches */
  length: number;
  /** Width in inches */
  width: number;
  /** Height in inches */
  height: number;
  /** Unit of measurement for dimensions */
  unit: 'IN' | 'CM';
}

export interface PackageWeight {
  /** Weight value */
  value: number;
  /** Unit of measurement */
  unit: 'LBS' | 'KGS';
}

export interface Package {
  /** Package dimensions */
  dimensions: PackageDimensions;
  /** Package weight */
  weight: PackageWeight;
  /** Packaging type (carrier-agnostic) */
  packagingType?: PackagingType;
  /** Declared value for insurance */
  declaredValue?: {
    amount: number;
    currency: string;
  };
}

export type PackagingType =
  | 'CUSTOM'
  | 'LETTER'
  | 'TUBE'
  | 'PAK'
  | 'SMALL_BOX'
  | 'MEDIUM_BOX'
  | 'LARGE_BOX';
