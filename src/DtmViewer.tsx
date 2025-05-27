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
  
  // UI visibility state
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showInfo, setShowInfo] = useState<boolean>(true);

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
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-black">
      {/* Full-screen canvas/render area */}
      <div className="absolute inset-0 w-full h-full">
        {viewMode === '2d' ? (
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            className="w-full h-full object-cover cursor-crosshair"
            style={{ width: '100vw', height: '100vh' }}
          />
        ) : (
          <div
            ref={container3DRef}
            className="w-full h-full"
            style={{ width: '100vw', height: '100vh' }}
          />
        )}
      </div>

      {/* Top Header Overlay */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-black/80 backdrop-blur-md rounded-lg px-6 py-3 text-white shadow-2xl">
          <div className="flex items-center space-x-2">
            <span className="text-lg">🏔️</span>
            <div>
              <h1 className="text-lg font-bold">DTM GeoTIFF Viewer</h1>
              <p className="text-xs text-gray-300">Upload and visualize Digital Terrain Models</p>
            </div>
          </div>
        </div>
      </div>

      {/* File Upload Overlay (when no data loaded) */}
      {!dtmData && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4">
            <FileUpload
              onFileSelect={handleFileLoad}
              loading={loading}
              error={error}
            />
          </div>
        </div>
      )}

      {/* Controls Panel Overlay (Left Side) */}
      <div className="fixed left-4 top-20 z-40">
        <div className={`transition-transform duration-300 ${showControls ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="bg-black/80 backdrop-blur-md rounded-lg p-4 text-white w-80 shadow-2xl">
            {/* Toggle Controls Button */}
            <button
              onClick={() => setShowControls(!showControls)}
              className="absolute -right-10 top-4 bg-black/80 text-white p-2 rounded-r-lg hover:bg-black/90 transition-colors shadow-lg"
            >
              {showControls ? '←' : '→'}
            </button>

            {/* View Mode Toggle */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-white mb-3">
                View Mode
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewModeChange('2d')}
                  className={`px-3 py-2 rounded-lg font-medium transition-all text-xs ${
                    viewMode === '2d'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  2D View
                </button>
                <button
                  onClick={() => handleViewModeChange('3d')}
                  className={`px-3 py-2 rounded-lg font-medium transition-all text-xs ${
                    viewMode === '3d'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  3D View
                </button>
              </div>
            </div>

            {/* Color Scheme */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">
                Color Scheme
              </label>
              <select
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value as ColorScheme)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="terrain">Terrain</option>
                <option value="elevation">Elevation</option>
                <option value="grayscale">Grayscale</option>
                <option value="rainbow">Rainbow</option>
              </select>
            </div>

            {/* Contrast */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">
                Contrast: {contrast.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={contrast}
                onChange={(e) => setContrast(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Brightness */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">
                Brightness: {brightness.toFixed(1)}
              </label>
              <input
                type="range"
                min="-0.5"
                max="0.5"
                step="0.1"
                value={brightness}
                onChange={(e) => setBrightness(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* 3D-specific controls */}
            {viewMode === '3d' && (
              <div className="border-t border-gray-600 pt-4">
                <h3 className="text-sm font-semibold text-white mb-3">3D Settings</h3>
                
                {/* Wireframe Toggle */}
                <div className="mb-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={wireframe}
                      onChange={(e) => setWireframe(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-white">Wireframe</span>
                  </label>
                </div>

                {/* Vertical Scale */}
                <div className="mb-3">
                  <label className="block text-sm text-white mb-1">
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
                <div className="mb-3">
                  <label className="block text-sm text-white mb-1">
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
                <div className="mb-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={showWater}
                      onChange={(e) => setShowWater(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-white">Show Water</span>
                  </label>
                </div>

                {/* Water Level */}
                {showWater && (
                  <div className="mb-3">
                    <label className="block text-sm text-white mb-1">
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
            )}
          </div>
        </div>
      </div>

      {/* Info Panel Overlay (Right Side) */}
      {dtmData && (
        <div className="fixed right-4 top-20 z-40">
          <div className={`transition-transform duration-300 ${showInfo ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="bg-black/80 backdrop-blur-md rounded-lg p-4 text-white w-64 shadow-2xl">
              {/* Toggle Info Button */}
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="absolute -left-10 top-4 bg-black/80 text-white p-2 rounded-l-lg hover:bg-black/90 transition-colors shadow-lg"
              >
                {showInfo ? '→' : '←'}
              </button>

              <h3 className="text-sm font-semibold text-white mb-3">Dataset Info</h3>
              
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-400">Dimensions:</span>
                  <div className="text-white">
                    {dtmData.dimensions.width} × {dtmData.dimensions.height}
                  </div>
                </div>
                
                <div>
                  <span className="text-gray-400">Elevation Range:</span>
                  <div className="text-white">
                    {dtmData.minElevation.toFixed(1)}m - {dtmData.maxElevation.toFixed(1)}m
                  </div>
                </div>

                {dtmData.metadata && Object.keys(dtmData.metadata).length > 0 && (
                  <div>
                    <span className="text-gray-400">Metadata:</span>
                    <div className="text-white text-xs">
                      {Object.entries(dtmData.metadata).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-gray-400">{key}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Color Legend Overlay (Bottom Right) */}
      {dtmData && (
        <div className="fixed bottom-4 right-4 z-40">
          <div className="bg-black/80 backdrop-blur-md rounded-lg p-3 text-white shadow-2xl">
            <div className="text-xs font-semibold text-white mb-2">Elevation</div>
            <div className="flex items-center space-x-2">
              <div className="text-xs text-gray-300">{dtmData.minElevation.toFixed(0)}m</div>
              <div 
                className={`w-4 h-16 rounded ${DTMRenderer.getLegendGradientClass(colorScheme)}`}
              />
              <div className="text-xs text-gray-300">{dtmData.maxElevation.toFixed(0)}m</div>
            </div>
          </div>
        </div>
      )}

      {/* Mouse Elevation Overlay (2D only) */}
      {viewMode === '2d' && mouseElevation && (
        <div className="fixed bottom-4 left-4 z-40">
          <div className="bg-black/80 backdrop-blur-md rounded-lg px-3 py-2 text-white text-sm shadow-2xl">
            {mouseElevation}
          </div>
        </div>
      )}

      {/* 3D Controls Info Overlay */}
      {viewMode === '3d' && (
        <div className="fixed bottom-4 left-4 z-40">
          <div className="bg-black/80 backdrop-blur-md rounded-lg p-3 text-white text-sm shadow-2xl">
            <div className="font-semibold mb-1">3D Controls:</div>
            <div>• Mouse drag: Rotate view</div>
            <div>• Mouse wheel: Zoom in/out</div>
          </div>
        </div>
      )}

      <SliderStyles />
    </div>
  );
};