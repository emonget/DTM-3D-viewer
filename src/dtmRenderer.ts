// dtmRenderer.ts - DTM data rendering and visualization logic

import type { ColorRGB, ColorScheme, DTMData, RenderOptions } from './types';

export class DTMRenderer {
  private static readonly MAX_CANVAS_WIDTH = 1200;
  private static readonly MAX_CANVAS_HEIGHT = 900;
  private static readonly RENDER_CHUNK_SIZE = 50;

  /**
   * Renders DTM data to a canvas element
   */
  public static async renderToCanvas(
    canvas: HTMLCanvasElement,
    dtmData: DTMData,
    options: RenderOptions
  ): Promise<void> {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to get 2D context from canvas');
    }

    const { elevationData, dimensions, minElevation, maxElevation } = dtmData;
    const { colorScheme, contrast, brightness } = options;

    // Calculate render dimensions
    const renderDimensions = this.calculateRenderDimensions(dimensions);
    
    // Set canvas size
    canvas.width = renderDimensions.width;
    canvas.height = renderDimensions.height;

    const imageData = ctx.createImageData(renderDimensions.width, renderDimensions.height);
    const elevRange = maxElevation - minElevation;

    if (elevRange === 0) {
      console.warn('Elevation range is zero, cannot render');
      return;
    }

    // Render in chunks to avoid blocking UI
    await this.renderInChunks(
      imageData,
      elevationData,
      dimensions,
      renderDimensions,
      minElevation,
      elevRange,
      colorScheme,
      contrast,
      brightness
    );

    // Draw the final image
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Calculates optimal render dimensions based on original size
   */
  private static calculateRenderDimensions(originalDimensions: { width: number; height: number }): {
    width: number;
    height: number;
  } {
    let { width, height } = originalDimensions;

    if (width > this.MAX_CANVAS_WIDTH || height > this.MAX_CANVAS_HEIGHT) {
      const aspectRatio = width / height;
      
      if (aspectRatio > this.MAX_CANVAS_WIDTH / this.MAX_CANVAS_HEIGHT) {
        width = this.MAX_CANVAS_WIDTH;
        height = Math.floor(this.MAX_CANVAS_WIDTH / aspectRatio);
      } else {
        height = this.MAX_CANVAS_HEIGHT;
        width = Math.floor(this.MAX_CANVAS_HEIGHT * aspectRatio);
      }
      
      console.log(`Downsampling from ${originalDimensions.width}x${originalDimensions.height} to ${width}x${height}`);
    }

    return { width, height };
  }

  /**
   * Renders image data in chunks to prevent UI blocking
   */
  private static async renderInChunks(
    imageData: ImageData,
    elevationData: Float32Array,
    originalDimensions: { width: number; height: number },
    renderDimensions: { width: number; height: number },
    minElevation: number,
    elevRange: number,
    colorScheme: ColorScheme,
    contrast: number,
    brightness: number
  ): Promise<void> {
    const scaleX = originalDimensions.width / renderDimensions.width;
    const scaleY = originalDimensions.height / renderDimensions.height;
    const data = imageData.data;

    let currentY = 0;

    const processChunk = (startY: number, endY: number): void => {
      for (let y = startY; y < endY; y++) {
        for (let x = 0; x < renderDimensions.width; x++) {
          const sourceX = Math.floor(x * scaleX);
          const sourceY = Math.floor(y * scaleY);
          const sourceIndex = sourceY * originalDimensions.width + sourceX;
          
          const elevation = elevationData[sourceIndex];
          const pixelIndex = (y * renderDimensions.width + x) * 4;

          if (!this.isValidElevation(elevation)) {
            // Transparent for nodata
            data[pixelIndex] = 0;
            data[pixelIndex + 1] = 0;
            data[pixelIndex + 2] = 0;
            data[pixelIndex + 3] = 0;
          } else {
            const normalizedElevation = (elevation - minElevation) / elevRange;
            const color = this.getColorForElevation(normalizedElevation, colorScheme);
            
            // Apply contrast and brightness
            data[pixelIndex] = this.applyContrastBrightness(color.r, contrast, brightness);
            data[pixelIndex + 1] = this.applyContrastBrightness(color.g, contrast, brightness);
            data[pixelIndex + 2] = this.applyContrastBrightness(color.b, contrast, brightness);
            data[pixelIndex + 3] = 255; // Full opacity
          }
        }
      }
    };

    // Process in chunks
    return new Promise((resolve) => {
      const renderNextChunk = (): void => {
        const endY = Math.min(currentY + this.RENDER_CHUNK_SIZE, renderDimensions.height);
        processChunk(currentY, endY);
        currentY = endY;
        
        if (currentY < renderDimensions.height) {
          setTimeout(renderNextChunk, 1);
        } else {
          resolve();
        }
      };
      
      renderNextChunk();
    });
  }

  /**
   * Applies contrast and brightness to a color component
   */
  private static applyContrastBrightness(value: number, contrast: number, brightness: number): number {
    return Math.max(0, Math.min(255, (value - 128) * contrast + 128 + brightness));
  }

  /**
   * Checks if elevation value is valid
   */
  private static isValidElevation(elevation: number): boolean {
    return elevation !== null && 
           elevation !== undefined && 
           !isNaN(elevation) && 
           elevation > -9999 && 
           elevation < 9999;
  }

  /**
   * Gets color for normalized elevation value based on color scheme
   */
  private static getColorForElevation(normalized: number, scheme: ColorScheme): ColorRGB {
    normalized = Math.max(0, Math.min(1, normalized));

    switch (scheme) {
      case 'terrain':
        return this.getTerrainColor(normalized);
      case 'elevation':
        return this.getElevationColor(normalized);
      case 'grayscale':
        return this.getGrayscaleColor(normalized);
      case 'rainbow':
        return this.getRainbowColor(normalized);
      default:
        return { r: 128, g: 128, b: 128 };
    }
  }

  /**
   * Terrain color scheme: blue (water) -> green (lowlands) -> brown (highlands) -> white (peaks)
   */
  private static getTerrainColor(normalized: number): ColorRGB {
    if (normalized < 0.3) {
      // Water to lowlands: blue to green
      const t = normalized / 0.3;
      return {
        r: Math.floor(0 * (1-t) + 34 * t),
        g: Math.floor(100 * (1-t) + 139 * t),
        b: Math.floor(200 * (1-t) + 34 * t)
      };
    } else if (normalized < 0.7) {
      // Lowlands to highlands: green to brown
      const t = (normalized - 0.3) / 0.4;
      return {
        r: Math.floor(34 * (1-t) + 139 * t),
        g: Math.floor(139 * (1-t) + 69 * t),
        b: Math.floor(34 * (1-t) + 19 * t)
      };
    } else {
      // Highlands to peaks: brown to white
      const t = (normalized - 0.7) / 0.3;
      return {
        r: Math.floor(139 * (1-t) + 255 * t),
        g: Math.floor(69 * (1-t) + 255 * t),
        b: Math.floor(19 * (1-t) + 255 * t)
      };
    }
  }

  /**
   * Elevation color scheme: blue to yellow
   */
  private static getElevationColor(normalized: number): ColorRGB {
    return {
      r: Math.floor(0 * (1-normalized) + 255 * normalized),
      g: Math.floor(66 * (1-normalized) + 255 * normalized),
      b: Math.floor(146 * (1-normalized) + 0 * normalized)
    };
  }

  /**
   * Grayscale color scheme
   */
  private static getGrayscaleColor(normalized: number): ColorRGB {
    const gray = Math.floor(normalized * 255);
    return { r: gray, g: gray, b: gray };
  }

  /**
   * Rainbow color scheme using HSL conversion
   */
  private static getRainbowColor(normalized: number): ColorRGB {
    const hue = normalized * 300; // 0 to 300 degrees
    return this.hslToRgb(hue / 360, 1, 0.5);
  }

  /**
   * Converts HSL to RGB
   */
  private static hslToRgb(h: number, s: number, l: number): ColorRGB {
    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  /**
   * Gets the CSS class for color scale legend based on color scheme
   */
  public static getLegendGradientClass(colorScheme: ColorScheme): string {
    const gradients = {
      terrain: 'bg-gradient-to-t from-blue-600 via-green-600 via-amber-700 to-white',
      elevation: 'bg-gradient-to-t from-blue-900 via-blue-300 to-yellow-400',
      grayscale: 'bg-gradient-to-t from-black to-white',
      rainbow: 'bg-gradient-to-t from-purple-500 via-blue-500 via-cyan-500 via-green-500 via-yellow-500 to-red-500'
    };

    return gradients[colorScheme] || gradients.terrain;
  }
}