import React, { useState, useRef, useCallback, useEffect } from 'react';
import type {
  ElevationMetadata,
  ColorScheme,
  DTMData,
  RenderOptions
} from './types';
import { GeoTIFFLoader } from './geoTiffLoader';
import { DTMRenderer } from './dtmRenderer';
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
  const [dtmData, setDtmData] = useState<DTMData | null>(null);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('terrain');
  const [contrast, setContrast] = useState<number>(1);
  const [brightness, setBrightness] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [mouseElevation, setMouseElevation] = useState<string>('');

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoTiffLoader = GeoTIFFLoader.getInstance();

  // Load GeoTIFF library on component mount
  useEffect(() => {
    geoTiffLoader.ensureLibraryLoaded().catch((err) => {
      setError(err.message);
    });
  }, [geoTiffLoader]);

  // File loading handler
  const handleFileLoad = useCallback(async (file: File) => {
    try {
      setLoading(true);
      setError('');

      const result = await geoTiffLoader.loadGeoTIFF(file);
      setDtmData(result);
      setLoading(false);

    } catch (err) {
      console.error('Error loading GeoTIFF:', err);
      setError(`Failed to load GeoTIFF file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  }, [geoTiffLoader]);

  // Rendering function
  const renderDTM = useCallback(async () => {
    if (!dtmData || !canvasRef.current) return;

    const renderOptions: RenderOptions = {
      colorScheme,
      contrast,
      brightness
    };

    await DTMRenderer.renderToCanvas(canvasRef.current, dtmData, renderOptions);
  }, [dtmData, colorScheme, contrast, brightness]);

  // Effect to re-render when parameters change
  useEffect(() => {
    if (dtmData) {
      renderDTM();
    }
  }, [dtmData, colorScheme, contrast, brightness, renderDTM]);

  // Mouse move handler for elevation display
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dtmData || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    // Convert canvas coordinates to data coordinates
    const scaleX = dtmData.dimensions.width / canvasRef.current.width;
    const scaleY = dtmData.dimensions.height / canvasRef.current.height;
    
    const dataX = Math.floor(canvasX * scaleX);
    const dataY = Math.floor(canvasY * scaleY);
    
    const elevation = geoTiffLoader.getElevationAt(
      dtmData.elevationData,
      dataX,
      dataY,
      dtmData.dimensions.width,
      dtmData.dimensions.height
    );
    
    if (elevation !== null) {
      setMouseElevation(`Elevation: ${elevation.toFixed(1)} m`);
    } else {
      setMouseElevation('No data');
    }
  }, [dtmData, geoTiffLoader]);

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

        {dtmData && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
            <DTMCanvas
              canvasRef={canvasRef}
              onMouseMove={handleMouseMove}
              mouseElevation={mouseElevation}
              colorScheme={colorScheme}
              minElevation={dtmData.minElevation}
              maxElevation={dtmData.maxElevation}
              showLegend={true}
            />

            <InfoPanel
              dimensions={dtmData.dimensions}
              minElevation={dtmData.minElevation}
              maxElevation={dtmData.maxElevation}
              metadata={dtmData.metadata}
            />
          </div>
        )}
      </div>

      <SliderStyles />
    </div>
  );
};