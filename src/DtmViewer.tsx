import React, { useState, useRef, useCallback, useEffect } from 'react';

// TypeScript interfaces
interface ElevationMetadata {
  width: number;
  height: number;
  bbox?: number[];
  resolution?: number[];
  origin?: number[];
  geoKeys?: Record<string, any>;
}

interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

type ColorScheme = 'terrain' | 'elevation' | 'grayscale' | 'rainbow';

// Add GeoTIFF types to window
declare global {
  interface Window {
    GeoTIFF?: any;
  }
}

export const DTMGeoTIFFViewer: React.FC = () => {
  // State management
  const [elevationData, setElevationData] = useState<Float32Array | null>(null);
  const [minElevation, setMinElevation] = useState<number>(0);
  const [maxElevation, setMaxElevation] = useState<number>(0);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [metadata, setMetadata] = useState<ElevationMetadata>({ width: 0, height: 0 });
  const [colorScheme, setColorScheme] = useState<ColorScheme>('terrain');
  const [contrast, setContrast] = useState<number>(1);
  const [brightness, setBrightness] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [mouseElevation, setMouseElevation] = useState<string>('');

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load GeoTIFF library dynamically
  useEffect(() => {
    const loadGeoTIFF = async () => {
      if (!window.GeoTIFF) {
        try {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/geotiff';
          script.onload = () => {
            console.log('GeoTIFF library loaded successfully');
          };
          script.onerror = () => {
            setError('Failed to load GeoTIFF library. Please check your internet connection.');
          };
          document.head.appendChild(script);
        } catch (err) {
          setError('Failed to load GeoTIFF library');
        }
      }
    };

    loadGeoTIFF();
  }, []);

  // Color functions
  const hslToRgb = useCallback((h: number, s: number, l: number): ColorRGB => {
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
  }, []);

  const getColorForElevation = useCallback((normalized: number, scheme: ColorScheme): ColorRGB => {
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
  }, [hslToRgb]);

  // File loading
  const loadGeoTIFF = useCallback(async (file: File) => {
    if (!window.GeoTIFF) {
      setError('GeoTIFF library not loaded');
      return;
    }

    try {
      setLoading(true);
      setError('');

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

      // Update state
      setElevationData(elevData);
      setMinElevation(minElev);
      setMaxElevation(maxElev);
      setDimensions({ width, height });
      setMetadata({
        width,
        height,
        bbox: image.getBoundingBox(),
        resolution: image.getResolution(),
        origin: image.getOrigin(),
        geoKeys: image.getGeoKeys()
      });

      console.log('Elevation range:', minElev, 'to', maxElev);
      setLoading(false);

    } catch (err) {
      console.error('Error loading GeoTIFF:', err);
      setError(`Failed to load GeoTIFF file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  }, []);

  // Rendering
  const renderDTM = useCallback(async () => {
    if (!elevationData || !canvasRef.current) return;

    const canvas = canvasRef.current;
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
  }, [elevationData, dimensions, minElevation, maxElevation, colorScheme, contrast, brightness, getColorForElevation]);

  // Effect to re-render when parameters change
  useEffect(() => {
    if (elevationData) {
      renderDTM();
    }
  }, [elevationData, colorScheme, contrast, brightness, renderDTM]);

  // Mouse move handler
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!elevationData || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const scaleX = dimensions.width / canvasRef.current.width;
    const scaleY = dimensions.height / canvasRef.current.height;
    
    const sourceX = Math.floor(x * scaleX);
    const sourceY = Math.floor(y * scaleY);
    
    if (sourceX >= 0 && sourceX < dimensions.width && sourceY >= 0 && sourceY < dimensions.height) {
      const index = sourceY * dimensions.width + sourceX;
      const elevation = elevationData[index];
      
      if (elevation !== null && elevation !== undefined && !isNaN(elevation) && elevation > -9999) {
        setMouseElevation(`Elevation: ${elevation.toFixed(1)} m`);
      } else {
        setMouseElevation('No data');
      }
    }
  }, [elevationData, dimensions]);

  // File input handler
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      loadGeoTIFF(files[0]);
    }
  }, [loadGeoTIFF]);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-500 to-purple-700 p-5">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-xl border border-white/20">
          <h1 className="text-gray-700 text-3xl font-semibold mb-2">🏔️ DTM GeoTIFF Viewer</h1>
          <p className="text-gray-600 text-lg">Upload and visualize Digital Terrain Models from GeoTIFF files with interactive elevation mapping</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-xl border border-white/20">
          <button
            onClick={handleFileClick}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:from-blue-600 hover:to-purple-700"
          >
            📁 Select GeoTIFF File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".tif,.tiff,.geotiff"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Controls */}
          <div className="flex flex-wrap gap-4 mt-5 items-center">
            <div className="flex items-center gap-2">
              <label className="font-medium text-gray-700">Color Scheme:</label>
              <select
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value as ColorScheme)}
                className="px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-gray-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="terrain">Terrain</option>
                <option value="elevation">Elevation</option>
                <option value="grayscale">Grayscale</option>
                <option value="rainbow">Rainbow</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="font-medium text-gray-700">Contrast:</label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={contrast}
                onChange={(e) => setContrast(parseFloat(e.target.value))}
                className="w-30 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className="text-gray-600 min-w-[3rem]">{contrast.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="font-medium text-gray-700">Brightness:</label>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value))}
                className="w-30 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className="text-gray-600 min-w-[3rem]">{brightness}</span>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-10 text-blue-600 text-lg">
              🔄 Processing GeoTIFF file...
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Viewer Section */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
          <div className="relative rounded-xl overflow-hidden shadow-lg">
            <canvas
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              className="block w-full h-auto max-h-[70vh] object-contain cursor-crosshair"
              title={mouseElevation}
            />
            
            {/* Legend */}
            {elevationData && (
              <div className="absolute top-5 right-5 bg-white/95 p-4 rounded-xl shadow-lg min-w-[140px]">
                <h4 className="mb-3 text-gray-700 text-sm font-medium">Elevation (m)</h4>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-36 rounded ${
                    colorScheme === 'terrain' ? 'bg-gradient-to-t from-blue-600 via-green-600 via-amber-700 to-white' :
                    colorScheme === 'elevation' ? 'bg-gradient-to-t from-blue-900 via-blue-300 to-yellow-400' :
                    colorScheme === 'grayscale' ? 'bg-gradient-to-t from-black to-white' :
                    'bg-gradient-to-t from-purple-500 via-blue-500 via-cyan-500 via-green-500 via-yellow-500 to-red-500'
                  }`} />
                  <div className="flex flex-col justify-between h-36 text-xs text-gray-600">
                    <span>{Math.round(maxElevation)}</span>
                    <span>{Math.round((minElevation + maxElevation) / 2)}</span>
                    <span>{Math.round(minElevation)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info Panel */}
          {elevationData && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mt-5 p-5 bg-gray-50/80 rounded-xl">
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">Dimensions</div>
                <div className="text-lg font-semibold text-gray-800">{dimensions.width} × {dimensions.height}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">Min Elevation</div>
                <div className="text-lg font-semibold text-gray-800">{minElevation.toFixed(1)} m</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">Max Elevation</div>
                <div className="text-lg font-semibold text-gray-800">{maxElevation.toFixed(1)} m</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">Resolution</div>
                <div className="text-lg font-semibold text-gray-800">
                  {metadata.resolution ? `${metadata.resolution[0].toFixed(2)} m/px` : '--'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">Coordinate System</div>
                <div className="text-lg font-semibold text-gray-800">
                  {metadata.geoKeys?.GeographicTypeGeoKey ? `EPSG:${metadata.geoKeys.GeographicTypeGeoKey}` : '--'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">Bounds</div>
                <div className="text-lg font-semibold text-gray-800">
                  {metadata.bbox ? 
                    `${metadata.bbox[0].toFixed(3)}, ${metadata.bbox[1].toFixed(3)} to ${metadata.bbox[2].toFixed(3)}, ${metadata.bbox[3].toFixed(3)}`
                    : '--'
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #667eea;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #667eea;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};