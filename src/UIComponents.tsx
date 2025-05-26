import React from 'react';
import type { ElevationMetadata, ColorScheme } from './logic';

interface HeaderProps {}

export const Header: React.FC<HeaderProps> = () => (
  <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-xl border border-white/20">
    <h1 className="text-gray-700 text-3xl font-semibold mb-2">🏔️ DTM GeoTIFF Viewer</h1>
    <p className="text-gray-600 text-lg">Upload and visualize Digital Terrain Models from GeoTIFF files with interactive elevation mapping</p>
  </div>
);

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  loading: boolean;
  error: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, loading, error }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  return (
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

      {loading && (
        <div className="text-center py-10 text-blue-600 text-lg">
          🔄 Processing GeoTIFF file...
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
};

interface ControlPanelProps {
  colorScheme: ColorScheme;
  onColorSchemeChange: (scheme: ColorScheme) => void;
  contrast: number;
  onContrastChange: (contrast: number) => void;
  brightness: number;
  onBrightnessChange: (brightness: number) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  colorScheme,
  onColorSchemeChange,
  contrast,
  onContrastChange,
  brightness,
  onBrightnessChange
}) => (
  <div className="flex flex-wrap gap-4 mt-5 items-center">
    <div className="flex items-center gap-2">
      <label className="font-medium text-gray-700">Color Scheme:</label>
      <select
        value={colorScheme}
        onChange={(e) => onColorSchemeChange(e.target.value as ColorScheme)}
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
        onChange={(e) => onContrastChange(parseFloat(e.target.value))}
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
        onChange={(e) => onBrightnessChange(parseInt(e.target.value))}
        className="w-30 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
      />
      <span className="text-gray-600 min-w-[3rem]">{brightness}</span>
    </div>
  </div>
);

interface ElevationLegendProps {
  colorScheme: ColorScheme;
  minElevation: number;
  maxElevation: number;
}

export const ElevationLegend: React.FC<ElevationLegendProps> = ({
  colorScheme,
  minElevation,
  maxElevation
}) => (
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
);

interface InfoPanelProps {
  dimensions: { width: number; height: number };
  minElevation: number;
  maxElevation: number;
  metadata: ElevationMetadata;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
  dimensions,
  minElevation,
  maxElevation,
  metadata
}) => (
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
);

interface DTMCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  mouseElevation: string;
  colorScheme: ColorScheme;
  minElevation: number;
  maxElevation: number;
  showLegend: boolean;
}

export const DTMCanvas: React.FC<DTMCanvasProps> = ({
  canvasRef,
  onMouseMove,
  mouseElevation,
  colorScheme,
  minElevation,
  maxElevation,
  showLegend
}) => (
  <div className="relative rounded-xl overflow-hidden shadow-lg">
    <canvas
      ref={canvasRef}
      onMouseMove={onMouseMove}
      className="block w-full h-auto max-h-[70vh] object-contain cursor-crosshair"
      title={mouseElevation}
    />
    
    {showLegend && (
      <ElevationLegend
        colorScheme={colorScheme}
        minElevation={minElevation}
        maxElevation={maxElevation}
      />
    )}
  </div>
);

export const SliderStyles: React.FC = () => (
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
);