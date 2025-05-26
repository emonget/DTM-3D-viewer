import React, { useState, useRef, useCallback, useEffect } from 'react';
import type {
  ElevationMetadata,
  ColorScheme
} from './types';
import { loadGeoTIFF, loadGeoTIFFLibrary } from './geoTiffLoader';
import { renderDTMToCanvas, getElevationAtPoint } from './dtmRenderer';
import {
  Header,
  FileUpload,
  ControlPanel,
  DTMCanvas,
  InfoPanel,
  SliderStyles
} from './UIComponents';

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

  // Load GeoTIFF library on component mount
  useEffect(() => {
    loadGeoTIFFLibrary().catch((err) => {
      setError(err.message);
    });
  }, []);

  // File loading handler
  const handleFileLoad = useCallback(async (file: File) => {
    try {
      setLoading(true);
      setError('');

      const result = await loadGeoTIFF(file);
      
      setElevationData(result.elevationData);
      setMinElevation(result.minElevation);
      setMaxElevation(result.maxElevation);
      setDimensions(result.dimensions);
      setMetadata(result.metadata);
      setLoading(false);

    } catch (err) {
      console.error('Error loading GeoTIFF:', err);
      setError(`Failed to load GeoTIFF file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  }, []);

  // Rendering function
  const renderDTM = useCallback(async () => {
    if (!elevationData || !canvasRef.current) return;

    await renderDTMToCanvas(
      canvasRef.current,
      elevationData,
      dimensions,
      minElevation,
      maxElevation,
      colorScheme,
      contrast,
      brightness
    );
  }, [elevationData, dimensions, minElevation, maxElevation, colorScheme, contrast, brightness]);

  // Effect to re-render when parameters change
  useEffect(() => {
    if (elevationData) {
      renderDTM();
    }
  }, [elevationData, colorScheme, contrast, brightness, renderDTM]);

  // Mouse move handler for elevation display
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!elevationData || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const elevation = getElevationAtPoint(
      x,
      y,
      canvasRef.current.width,
      canvasRef.current.height,
      elevationData,
      dimensions
    );
    
    if (elevation !== null) {
      setMouseElevation(`Elevation: ${elevation.toFixed(1)} m`);
    } else {
      setMouseElevation('No data');
    }
  }, [elevationData, dimensions]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-500 to-purple-700 p-5">
      <div className="max-w-7xl mx-auto">
        <Header />

        <FileUpload
          onFileSelect={handleFileLoad}
          loading={loading}
          error={error}
        />

        {!loading && !error && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-xl border border-white/20">
            <ControlPanel
              colorScheme={colorScheme}
              onColorSchemeChange={setColorScheme}
              contrast={contrast}
              onContrastChange={setContrast}
              brightness={brightness}
              onBrightnessChange={setBrightness}
            />
          </div>
        )}

        {elevationData && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
            <DTMCanvas
              canvasRef={canvasRef}
              onMouseMove={handleMouseMove}
              mouseElevation={mouseElevation}
              colorScheme={colorScheme}
              minElevation={minElevation}
              maxElevation={maxElevation}
              showLegend={true}
            />

            <InfoPanel
              dimensions={dimensions}
              minElevation={minElevation}
              maxElevation={maxElevation}
              metadata={metadata}
            />
          </div>
        )}
      </div>

      <SliderStyles />
    </div>
  );
};