// TypeScript interfaces
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

// Add GeoTIFF types to window
declare global {
  interface Window {
    GeoTIFF?: any;
  }
}

// Color utility functions
export const hslToRgb = (h: number, s: number, l: number): ColorRGB => {
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
};

export const getColorForElevation = (normalized: number, scheme: ColorScheme): ColorRGB => {
  normalized = Math.max(0, Math.min(1, normalized));

  switch (scheme) {
    case 'terrain':
      if (normalized < 0.3) {
        const t = normalized / 0.3;
        return {
          r: Math.floor(0 * (1-t) + 34 * t),
          g: Math.floor(100 * (1-t) + 139 * t),
          b: Math.floor(200 * (1-t) + 34 * t)
        };
      } else if (normalized < 0.7) {
        const t = (normalized - 0.3) / 0.4;
        return {
          r: Math.floor(34 * (1-t) + 139 * t),
          g: Math.floor(139 * (1-t) + 69 * t),
          b: Math.floor(34 * (1-t) + 19 * t)
        };
      } else {
        const t = (normalized - 0.7) / 0.3;
        return {
          r: Math.floor(139 * (1-t) + 255 * t),
          g: Math.floor(69 * (1-t) + 255 * t),
          b: Math.floor(19 * (1-t) + 255 * t)
        };
      }

    case 'elevation':
      return {
        r: Math.floor(0 * (1-normalized) + 255 * normalized),
        g: Math.floor(66 * (1-normalized) + 255 * normalized),
        b: Math.floor(146 * (1-normalized) + 0 * normalized)
      };

    case 'grayscale':
      const gray = Math.floor(normalized * 255);
      return { r: gray, g: gray, b: gray };

    case 'rainbow':
      const hue = normalized * 300;
      return hslToRgb(hue / 360, 1, 0.5);

    default:
      return { r: 128, g: 128, b: 128 };
  }
};

// GeoTIFF loading logic
export const loadGeoTIFF = async (file: File) => {
  if (!window.GeoTIFF) {
    throw new Error('GeoTIFF library not loaded');
  }

  console.log('Loading file:', file.name, 'Size:', file.size, 'Type:', file.type);

  const arrayBuffer = await file.arrayBuffer();
  console.log('ArrayBuffer created, size:', arrayBuffer.byteLength);

  const tiff = await window.GeoTIFF.fromArrayBuffer(arrayBuffer);
  console.log('GeoTIFF object created');

  const image = await tiff.getImage();
  console.log('Image obtained');

  const rasters = await image.readRasters();
  console.log('Rasters read, bands:', rasters.length);

  const width = image.getWidth();
  const height = image.getHeight();
  console.log('Dimensions:', width, 'x', height);

  const elevData = rasters[0] as Float32Array;
  console.log('Elevation data extracted, length:', elevData.length);

  // Calculate min/max elevations
  let minElev = Infinity;
  let maxElev = -Infinity;
  let validCount = 0;
  
  const chunkSize = 100000;
  for (let start = 0; start < elevData.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, elevData.length);
    
    for (let i = start; i < end; i++) {
      const val = elevData[i];
      if (val !== null && val !== undefined && !isNaN(val) && val > -9999 && val < 9999) {
        if (val < minElev) minElev = val;
        if (val > maxElev) maxElev = val;
        validCount++;
      }
    }
    
    if (start % (chunkSize * 10) === 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  if (validCount === 0) {
    throw new Error('No valid elevation data found in the file');
  }

  const metadata: ElevationMetadata = {
    width,
    height,
    bbox: image.getBoundingBox(),
    resolution: image.getResolution(),
    origin: image.getOrigin(),
    geoKeys: image.getGeoKeys()
  };

  console.log('Elevation range:', minElev, 'to', maxElev);

  return {
    elevationData: elevData,
    minElevation: minElev,
    maxElevation: maxElev,
    dimensions: { width, height },
    metadata
  };
};

// Canvas rendering logic
export const renderDTMToCanvas = async (
  canvas: HTMLCanvasElement,
  elevationData: Float32Array,
  dimensions: { width: number; height: number },
  minElevation: number,
  maxElevation: number,
  colorScheme: ColorScheme,
  contrast: number,
  brightness: number
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const maxWidth = 1200;
  const maxHeight = 900;
  
  let renderWidth = dimensions.width;
  let renderHeight = dimensions.height;
  
  if (dimensions.width > maxWidth || dimensions.height > maxHeight) {
    const aspectRatio = dimensions.width / dimensions.height;
    if (aspectRatio > maxWidth / maxHeight) {
      renderWidth = maxWidth;
      renderHeight = Math.floor(maxWidth / aspectRatio);
    } else {
      renderHeight = maxHeight;
      renderWidth = Math.floor(maxHeight * aspectRatio);
    }
    console.log(`Downsampling from ${dimensions.width}x${dimensions.height} to ${renderWidth}x${renderHeight}`);
  }

  canvas.width = renderWidth;
  canvas.height = renderHeight;

  const imageData = ctx.createImageData(renderWidth, renderHeight);
  const data = imageData.data;

  const scaleX = dimensions.width / renderWidth;
  const scaleY = dimensions.height / renderHeight;
  const elevRange = maxElevation - minElevation;

  if (elevRange === 0) {
    console.warn('Elevation range is zero');
    return;
  }

  const processChunk = (startY: number, endY: number) => {
    for (let y = startY; y < endY; y++) {
      for (let x = 0; x < renderWidth; x++) {
        const sourceX = Math.floor(x * scaleX);
        const sourceY = Math.floor(y * scaleY);
        const sourceIndex = sourceY * dimensions.width + sourceX;
        
        const elevation = elevationData[sourceIndex];
        const pixelIndex = (y * renderWidth + x) * 4;

        if (elevation === null || elevation === undefined || isNaN(elevation) || elevation <= -9999 || elevation >= 9999) {
          data[pixelIndex] = 0;
          data[pixelIndex + 1] = 0;
          data[pixelIndex + 2] = 0;
          data[pixelIndex + 3] = 0;
        } else {
          const normalizedElevation = (elevation - minElevation) / elevRange;
          const color = getColorForElevation(normalizedElevation, colorScheme);
          
          data[pixelIndex] = Math.max(0, Math.min(255, (color.r - 128) * contrast + 128 + brightness));
          data[pixelIndex + 1] = Math.max(0, Math.min(255, (color.g - 128) * contrast + 128 + brightness));
          data[pixelIndex + 2] = Math.max(0, Math.min(255, (color.b - 128) * contrast + 128 + brightness));
          data[pixelIndex + 3] = 255;
        }
      }
    }
  };

  const chunkSize = 50;
  let currentY = 0;
  
  const renderNextChunk = () => {
    const endY = Math.min(currentY + chunkSize, renderHeight);
    processChunk(currentY, endY);
    currentY = endY;
    
    if (currentY < renderHeight) {
      setTimeout(renderNextChunk, 1);
    } else {
      ctx.putImageData(imageData, 0, 0);
    }
  };
  
  renderNextChunk();
};

// Mouse elevation calculation
export const getElevationAtPoint = (
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  elevationData: Float32Array,
  dimensions: { width: number; height: number }
): number | null => {
  const scaleX = dimensions.width / canvasWidth;
  const scaleY = dimensions.height / canvasHeight;
  
  const sourceX = Math.floor(x * scaleX);
  const sourceY = Math.floor(y * scaleY);
  
  if (sourceX >= 0 && sourceX < dimensions.width && sourceY >= 0 && sourceY < dimensions.height) {
    const index = sourceY * dimensions.width + sourceX;
    const elevation = elevationData[index];
    
    if (elevation !== null && elevation !== undefined && !isNaN(elevation) && elevation > -9999) {
      return elevation;
    }
  }
  
  return null;
};

// GeoTIFF library loader
export const loadGeoTIFFLibrary = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.GeoTIFF) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/geotiff';
    script.onload = () => {
      console.log('GeoTIFF library loaded successfully');
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load GeoTIFF library. Please check your internet connection.'));
    };
    document.head.appendChild(script);
  });
};