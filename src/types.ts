// types.ts - TypeScript interfaces and types

export interface ElevationMetadata {
  width: number;
  height: number;
  bbox?: number[];
  resolution?: number[];
  origin?: number[];
  geoKeys?: Record<string, any>;
}

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export type ColorScheme = 'terrain' | 'elevation' | 'grayscale' | 'rainbow';

export interface DTMData {
  elevationData: Float32Array;
  minElevation: number;
  maxElevation: number;
  dimensions: { width: number; height: number };
  metadata: ElevationMetadata;
}

export interface RenderOptions {
  colorScheme: ColorScheme;
  contrast: number;
  brightness: number;
}

// Global type extensions
declare global {
  interface Window {
    GeoTIFF?: any;
  }
}

export interface GeoTIFFImage {
  getWidth(): number;
  getHeight(): number;
  readRasters(): Promise<Float32Array[]>;
  getBoundingBox(): number[];
  getResolution(): number[];
  getOrigin(): number[];
  getGeoKeys(): Record<string, any>;
}

export interface GeoTIFFFile {
  getImage(): Promise<GeoTIFFImage>;
}