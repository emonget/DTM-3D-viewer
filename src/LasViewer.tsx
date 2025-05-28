import React, { useState, useRef } from 'react';
import { Upload, FileText, Info, MapPin, Layers, BarChart3, Globe2, ChevronLeft, ChevronRight } from 'lucide-react';
import { LasParser } from './LasParser';
import type { LasData } from './LasParser';
import { LasMap } from './LasMap';
import { LasPointCloud } from './LasPointCloud';

export const LasViewer: React.FC = () => {
  const [lasData, setLasData] = useState<LasData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'info' | '3d'>('info');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.las')) {
      setError('Please select a valid LAS file (.las extension)');
      return;
    }

    setLoading(true);
    setError(null);
    setLasData(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const parser = new LasParser(arrayBuffer);
      const data = parser.parse();
      setLasData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse LAS file');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <div className="h-16 bg-white shadow-sm flex items-center px-4 z-10">
        <div className="flex-1 flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="text-blue-600" />
            LAS LIDAR Viewer
          </h1>
          <input
            ref={fileInputRef}
            type="file"
            accept=".las"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            {loading ? 'Processing...' : 'Load LAS File'}
          </button>

          {/* Tab Buttons */}
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === 'info'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Information
            </button>
            <button
              onClick={() => setActiveTab('3d')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === '3d'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              3D View
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'info' ? (
          <div className="h-full flex">
            {/* Left Panel - Statistics */}
            <div className="w-1/2 bg-white shadow-lg overflow-y-auto p-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-red-800">
                    <Info className="h-5 w-5" />
                    <span className="font-medium">Error:</span>
                  </div>
                  <p className="text-red-700 mt-1">{error}</p>
                </div>
              )}

              {lasData && (
                <div className="space-y-6">
                  {/* File Info */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      File Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Version:</span> {lasData.header.versionMajor}.{lasData.header.versionMinor}</p>
                      <p><span className="font-medium">System ID:</span> {lasData.header.systemIdentifier || 'Not specified'}</p>
                      <p><span className="font-medium">Software:</span> {lasData.header.generatingSoftware || 'Not specified'}</p>
                      <p><span className="font-medium">Creation Date:</span> {lasData.header.creationYear}-{lasData.header.creationDayOfYear}</p>
                      <p><span className="font-medium">Point Format:</span> {lasData.header.pointDataRecordFormat}</p>
                      <p><span className="font-medium">Point Length:</span> {lasData.header.pointDataRecordLength} bytes</p>
                    </div>
                  </div>

                  {/* Point Statistics */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Point Statistics
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Total Points:</span> {formatNumber(lasData.statistics.totalPoints, 0)}</p>
                      <p><span className="font-medium">Point Density:</span> {formatNumber(lasData.statistics.totalPoints / ((lasData.header.maxX - lasData.header.minX) * (lasData.header.maxY - lasData.header.minY)), 2)} points/m²</p>
                      <div className="mt-4">
                        <p className="font-medium mb-2">Return Distribution:</p>
                        <div className="ml-4 space-y-1">
                          {lasData.header.numberOfPointsByReturn.map((count, index) => (
                            count > 0 && (
                              <div key={index} className="flex justify-between items-center">
                                <span className="text-gray-600">
                                  {index === 0 ? "First Return" : 
                                   index === lasData.header.numberOfPointsByReturn.length - 1 ? "Last Return" :
                                   `Return ${index + 1}`}
                                  {index === 0 && " (top surface)"}
                                  {index === lasData.header.numberOfPointsByReturn.length - 1 && " (often ground)"}:
                                </span>
                                <span className="font-medium">{formatNumber(count, 0)}</span>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coordinate Info */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Globe2 className="h-4 w-4" />
                      Coordinate Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">System:</span> Lambert 93 (French national grid)</p>
                      <p><span className="font-medium">X Range:</span> {formatNumber(lasData.header.minX)}m to {formatNumber(lasData.header.maxX)}m</p>
                      <p><span className="font-medium">Y Range:</span> {formatNumber(lasData.header.minY)}m to {formatNumber(lasData.header.maxY)}m</p>
                      <p><span className="font-medium">Z Range:</span> {formatNumber(lasData.header.minZ)}m to {formatNumber(lasData.header.maxZ)}m</p>
                      <p><span className="font-medium">Area:</span> {formatNumber((lasData.header.maxX - lasData.header.minX) * (lasData.header.maxY - lasData.header.minY) / 1000000, 2)} km²</p>
                    </div>
                  </div>

                  {/* Classification */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Point Classification
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(lasData.statistics.classificationCounts || {})
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([classification, count]) => (
                          <div key={classification} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ 
                                  backgroundColor: `hsl(${(parseInt(classification) * 30) % 360}deg 100% 50%)` 
                                }} 
                              />
                              <span className="text-gray-600">{LasParser.getClassificationName(parseInt(classification))}</span>
                            </div>
                            <span className="font-medium">{formatNumber(count, 0)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Map & Location */}
            <div className="w-1/2 bg-white shadow-lg overflow-y-auto p-6">
              {lasData?.statistics.coordinateInfo && (
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Center Coordinates:</span></p>
                      <p className="ml-4">Latitude: {formatNumber(lasData.statistics.coordinateInfo.centerLatLon.latitude, 6)}°</p>
                      <p className="ml-4">Longitude: {formatNumber(lasData.statistics.coordinateInfo.centerLatLon.longitude, 6)}°</p>
                      <p><span className="font-medium">Bounds:</span></p>
                      <p className="ml-4">North: {formatNumber(lasData.statistics.coordinateInfo.bounds.maxLat, 6)}°</p>
                      <p className="ml-4">South: {formatNumber(lasData.statistics.coordinateInfo.bounds.minLat, 6)}°</p>
                      <p className="ml-4">East: {formatNumber(lasData.statistics.coordinateInfo.bounds.maxLon, 6)}°</p>
                      <p className="ml-4">West: {formatNumber(lasData.statistics.coordinateInfo.bounds.minLon, 6)}°</p>
                    </div>
                  </div>
                  <div className="h-96 bg-gray-50 rounded-lg overflow-hidden">
                    <LasMap
                      bounds={lasData.statistics.coordinateInfo.bounds}
                      center={lasData.statistics.coordinateInfo.centerLatLon}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full bg-gray-900">
            {lasData ? (
              <LasPointCloud points={lasData.points} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <p>Load a LAS file to view the 3D point cloud</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};