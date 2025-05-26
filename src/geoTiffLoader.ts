// geotiffLoader.ts - GeoTIFF loading and processing logic

import * as GeoTIFF from 'geotiff';
import type { DTMData, ElevationMetadata, GeoTIFFFile, GeoTIFFImage } from './types';

export class GeoTIFFLoader {
  private static instance: GeoTIFFLoader;

  private constructor() {}

  public static getInstance(): GeoTIFFLoader {
    if (!GeoTIFFLoader.instance) {
      GeoTIFFLoader.instance = new GeoTIFFLoader();
    }
    return GeoTIFFLoader.instance;
  }

  /**
   * Ensures the GeoTIFF library is loaded (no-op for npm package)
   */
  public async ensureLibraryLoaded(): Promise<void> {
    // No need to load library dynamically when using npm package
    return Promise.resolve();
  }

  /**
   * Loads and processes a GeoTIFF file
   */
  public async loadGeoTIFF(file: File): Promise<DTMData> {
    try {
      console.log('Loading file:', file.name, 'Size:', file.size, 'Type:', file.type);

      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      console.log('ArrayBuffer created, size:', arrayBuffer.byteLength);

      // Parse GeoTIFF using npm package
      const tiff: GeoTIFFFile = await GeoTIFF.fromArrayBuffer(arrayBuffer);
      console.log('GeoTIFF object created');

      const image: GeoTIFFImage = await tiff.getImage();
      console.log('Image obtained');

      const rasters = await image.readRasters();
      console.log('Rasters read, bands:', rasters.length);

      // Extract basic info
      const width = image.getWidth();
      const height = image.getHeight();
      console.log('Dimensions:', width, 'x', height);

      // Extract elevation data (assuming single band DTM)
      const elevationData = rasters[0] as Float32Array;
      console.log('Elevation data extracted, length:', elevationData.length);

      // Calculate elevation statistics
      const { minElevation, maxElevation } = await this.calculateElevationStats(elevationData);
      console.log('Elevation range:', minElevation, 'to', maxElevation);

      // Extract metadata
      const metadata: ElevationMetadata = {
        width,
        height,
        bbox: this.safeGetBoundingBox(image),
        resolution: this.safeGetResolution(image),
        origin: this.safeGetOrigin(image),
        geoKeys: this.safeGetGeoKeys(image)
      };

      return {
        elevationData,
        minElevation,
        maxElevation,
        dimensions: { width, height },
        metadata
      };

    } catch (error) {
      console.error('Error loading GeoTIFF:', error);
      throw new Error(`Failed to load GeoTIFF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculates min/max elevation statistics efficiently for large datasets
   */
  private async calculateElevationStats(elevationData: Float32Array): Promise<{
    minElevation: number;
    maxElevation: number;
  }> {
    let minElev = Infinity;
    let maxElev = -Infinity;
    let validCount = 0;
    
    // Process in chunks to avoid blocking the UI
    const chunkSize = 100000;
    for (let start = 0; start < elevationData.length; start += chunkSize) {
      const end = Math.min(start + chunkSize, elevationData.length);
      
      for (let i = start; i < end; i++) {
        const val = elevationData[i];
        if (this.isValidElevation(val)) {
          if (val < minElev) minElev = val;
          if (val > maxElev) maxElev = val;
          validCount++;
        }
      }
      
      // Allow browser to breathe between chunks
      if (start % (chunkSize * 10) === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    if (validCount === 0) {
      throw new Error('No valid elevation data found in the file');
    }

    return { minElevation: minElev, maxElevation: maxElev };
  }

  /**
   * Checks if an elevation value is valid
   */
  private isValidElevation(value: number): boolean {
    return value !== null && 
           value !== undefined && 
           !isNaN(value) && 
           value > -9999 && 
           value < 9999;
  }

  /**
   * Safely extracts bounding box from image
   */
  private safeGetBoundingBox(image: GeoTIFFImage): number[] | undefined {
    try {
      return image.getBoundingBox();
    } catch (error) {
      console.warn('Failed to get bounding box:', error);
      return undefined;
    }
  }

  /**
   * Safely extracts resolution from image
   */
  private safeGetResolution(image: GeoTIFFImage): number[] | undefined {
    try {
      return image.getResolution();
    } catch (error) {
      console.warn('Failed to get resolution:', error);
      return undefined;
    }
  }

  /**
   * Safely extracts origin from image
   */
  private safeGetOrigin(image: GeoTIFFImage): number[] | undefined {
    try {
      return image.getOrigin();
    } catch (error) {
      console.warn('Failed to get origin:', error);
      return undefined;
    }
  }

  /**
   * Safely extracts geo keys from image
   */
  private safeGetGeoKeys(image: GeoTIFFImage): Record<string, any> | undefined {
    try {
      return image.getGeoKeys();
    } catch (error) {
      console.warn('Failed to get geo keys:', error);
      return undefined;
    }
  }

  /**
   * Validates if elevation data is available at a specific point
   */
  public isValidElevationAt(elevationData: Float32Array, index: number): boolean {
    if (index < 0 || index >= elevationData.length) {
      return false;
    }
    return this.isValidElevation(elevationData[index]);
  }

  /**
   * Gets elevation value at specific coordinates
   */
  public getElevationAt(
    elevationData: Float32Array, 
    x: number, 
    y: number, 
    width: number, 
    height: number
  ): number | null {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return null;
    }

    const index = y * width + x;
    const elevation = elevationData[index];
    
    return this.isValidElevation(elevation) ? elevation : null;
  }
}