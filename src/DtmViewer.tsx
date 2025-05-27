import React, { useState, useRef, useCallback, useEffect } from 'react';
import type {
  ColorScheme,
  DTMData,
  RenderOptions
} from './types';
import { GeoTIFFLoader } from './geoTiffLoader';
import { DTMRenderer } from './dtm2dRenderer';
import { DTM3DRenderer, type Render3DOptions } from './dtm3dRenderer';
import {
  Header,
  FileUpload,
  ControlPanel,
  DTMCanvas,
  InfoPanel,
  SliderStyles
} from './UIComponents';

type ViewMode = '2d' | '3d';

export const DTMGeoTIFFViewer: React.FC = () => {
  // State management
  const [dtmData, setDtmData] = useState<DTMData | null>(null);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('terrain');
  const [contrast, setContrast] = useState<number>(1);
  const [brightness, setBrightness] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [mouseElevation, setMouseElevation] = useState<string>('');
  
  // 3D-specific state
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [verticalScale, setVerticalScale] = useState<number>(0.1);
  const [meshResolution, setMeshResolution] = useState<number>(256);
  const [showWater, setShowWater] = useState<boolean>(false);
  const [waterLevel, setWaterLevel] = useState<number>(0.1);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const container3DRef = useRef<HTMLDivElement>(null);
  const renderer3DRef = useRef<DTM3DRenderer | null>(null);
  const geoTiffLoader = GeoTIFFLoader.getInstance();

  // Load GeoTIFF library on component mount
  useEffect(() => {
    geoTiffLoader.ensureLibraryLoaded().catch((err) => {
      setError(err.message);
    });
  }, [geoTiffLoader]);

  // Initialize 3D renderer when switching to 3D view
  const initialize3DRenderer = useCallback(() => {
    if (container3DRef.current && !renderer3DRef.current) {
      try {
        renderer3DRef.current = new DTM3DRenderer(container3DRef.current);
        console.log('3D renderer initialized successfully');
      } catch (err) {
        console.error('Failed to initialize 3D renderer:', err);
        setError('3D rendering not supported in this browser');
        return false;
      }
    }
    return true;
  }, []);

  // Clean up 3D renderer
  const cleanup3DRenderer = useCallback(() => {
    if (renderer3DRef.current) {
      renderer3DRef.current.dispose();
      renderer3DRef.current = null;
      console.log('3D renderer disposed');
    }
  }, []);

  // Handle component unmount
  useEffect(() => {
    return () => {
      cleanup3DRenderer();
    };
  }, [cleanup3DRenderer]);

  // Handle window resize for 3D renderer
  useEffect(() => {
    const handleResize = () => {
      if (renderer3DRef.current && viewMode === '3d') {
        renderer3DRef.current.handleResize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode]);

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

  // 2D Rendering function
  const render2D = useCallback(async () => {
    if (!dtmData || !canvasRef.current) return;

    const renderOptions: RenderOptions = {
      colorScheme,
      contrast,
      brightness
    };

    await DTMRenderer.renderToCanvas(canvasRef.current, dtmData, renderOptions);
  }, [dtmData, colorScheme, contrast, brightness]);

  // 3D Rendering function
  const render3D = useCallback(async () => {
    if (!dtmData) return;

    // Initialize 3D renderer if needed
    if (!renderer3DRef.current) {
      const success = initialize3DRenderer();
      if (!success) return;
    }

    if (!renderer3DRef.current) {
      console.error('3D renderer is still null after initialization attempt');
      return;
    }

    const render3DOptions: Render3DOptions = {
      colorScheme,
      contrast,
      brightness,
      wireframe,
      verticalScale,
      meshResolution,
      showWater,
      waterLevel
    };

    try {
      await renderer3DRef.current.render3DMesh(dtmData, render3DOptions);
      console.log('3D rendering completed successfully');
    } catch (err) {
      console.error('Error during 3D rendering:', err);
      setError('Failed to render 3D visualization');
    }
  }, [dtmData, colorScheme, contrast, brightness, wireframe, verticalScale, meshResolution, showWater, waterLevel, initialize3DRenderer]);

  // Handle view mode change
  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    if (newMode === '2d') {
      // Clean up 3D renderer when switching to 2D
      cleanup3DRenderer();
    }
    setViewMode(newMode);
  }, [cleanup3DRenderer]);

  // Effect to re-render when parameters change
  useEffect(() => {
    if (dtmData) {
      if (viewMode === '2d') {
        render2D();
      } else if (viewMode === '3d') {
        // Small delay to ensure the container is rendered
        const timeoutId = setTimeout(() => {
          render3D();
        }, 100);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [dtmData, viewMode, colorScheme, contrast, brightness, wireframe, verticalScale, meshResolution, showWater, waterLevel, render2D, render3D]);

  // Mouse move handler for elevation display (2D only)
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dtmData || !canvasRef.current || viewMode !== '2d') return;

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
  }, [dtmData, geoTiffLoader, viewMode]);

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
            {/* View Mode Toggle */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                View Mode
              </label>
              <div className="flex gap-4">
                <button
                  onClick={() => handleViewModeChange('2d')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    viewMode === '2d'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  2D View
                </button>
                <button
                  onClick={() => handleViewModeChange('3d')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    viewMode === '3d'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  3D View
                </button>
              </div>
            </div>

            <ControlPanel
              colorScheme={colorScheme}
              onColorSchemeChange={setColorScheme}
              contrast={contrast}
              onContrastChange={setContrast}
              brightness={brightness}
              onBrightnessChange={setBrightness}
            />

            {/* 3D-specific controls */}
            {viewMode === '3d' && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">3D Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Wireframe Toggle */}
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={wireframe}
                        onChange={(e) => setWireframe(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">Wireframe</span>
                    </label>
                  </div>

                  {/* Vertical Scale */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vertical Scale: {verticalScale.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.01"
                      max="0.5"
                      step="0.01"
                      value={verticalScale}
                      onChange={(e) => setVerticalScale(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  {/* Mesh Resolution */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mesh Resolution: {meshResolution}
                    </label>
                    <input
                      type="range"
                      min="64"
                      max="512"
                      step="32"
                      value={meshResolution}
                      onChange={(e) => setMeshResolution(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  {/* Show Water Toggle */}
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={showWater}
                        onChange={(e) => setShowWater(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">Show Water</span>
                    </label>
                  </div>

                  {/* Water Level */}
                  {showWater && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Water Level: {(waterLevel * 100).toFixed(0)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="0.5"
                        step="0.01"
                        value={waterLevel}
                        onChange={(e) => setWaterLevel(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {dtmData && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
            {/* Render Area */}
            <div className="relative">
              {viewMode === '2d' ? (
                <DTMCanvas
                  canvasRef={canvasRef}
                  onMouseMove={handleMouseMove}
                  mouseElevation={mouseElevation}
                  colorScheme={colorScheme}
                  minElevation={dtmData.minElevation}
                  maxElevation={dtmData.maxElevation}
                  showLegend={true}
                />
              ) : (
                <div className="relative">
                  <div
                    ref={container3DRef}
                    className="w-full h-96 bg-gray-100 rounded-lg overflow-hidden"
                    style={{ minHeight: '600px' }}
                  />
                  
                  {/* 3D Controls Info */}
                  <div className="absolute top-4 left-4 bg-black/70 text-white p-3 rounded-lg text-sm">
                    <div className="font-semibold mb-1">3D Controls:</div>
                    <div>• Mouse drag: Rotate view</div>
                    <div>• Mouse wheel: Zoom in/out</div>
                  </div>

                  {/* Color Legend for 3D */}
                  <div className="absolute top-4 right-4 bg-white/90 p-3 rounded-lg shadow-lg">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Elevation</div>
                    <div className="flex items-center space-x-2">
                      <div className="text-xs text-gray-600">{dtmData.minElevation.toFixed(0)}m</div>
                      <div 
                        className={`w-4 h-16 rounded ${DTMRenderer.getLegendGradientClass(colorScheme)}`}
                      />
                      <div className="text-xs text-gray-600">{dtmData.maxElevation.toFixed(0)}m</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

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