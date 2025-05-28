import React, { useState, useRef } from 'react';
import { Upload, FileText, Info, MapPin, Layers, BarChart3, Globe2, ChevronLeft, ChevronRight, ClipboardList, Box } from 'lucide-react';
import { LasFileParser } from './LasFileParser';
import type { LasData } from './LasFileParser';
import { LasMap } from './LasMap';
import { LasPointCloud } from './LasPointCloud';
import { LazFileParser } from './LazFileParser';

export const LasViewer: React.FC = () => {
  const [lasData, setLasData] = useState<LasData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'info' | '3d'>('info');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.toLowerCase();
    if (!fileExt.endsWith('.las') && !fileExt.endsWith('.laz')) {
      setError('Please select a valid LAS/LAZ file (.las or .laz extension)');
      return;
    }

    setLoading(true);
    setError(null);
    setLasData(null);

    try {
      const isLaz = fileExt.endsWith('.laz');
      const parser = isLaz ? new LazFileParser(file) : new LasFileParser(file);
      const data = await parser.parse();
      setLasData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse LAS/LAZ file');
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
    <div className="h-screen w-screen flex flex-col bg-gray-900">
      {/* Top Bar */}
      <div className="h-16 bg-gray-800 shadow-md border-b border-gray-700 flex items-center px-4 z-10">
        <div className="flex-1 flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Layers className="text-blue-400" />
            LIDAR LAS/LAZ Viewer
          </h1>
          <input
            ref={fileInputRef}
            type="file"
            accept=".las,.laz"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            {loading ? 'Processing...' : 'Load LAS/LAZ File'}
          </button>
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-16 bg-gray-800 border-r border-gray-700 shadow-md flex flex-col items-center py-4 gap-2">
          <button
            onClick={() => setActiveTab('info')}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === 'info'
                ? 'bg-blue-900/50 text-blue-400'
                : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
            title="Information Panel"
          >
            <Info className="w-6 h-6" />
          </button>
          <button
            onClick={() => setActiveTab('3d')}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === '3d'
                ? 'bg-blue-900/50 text-blue-400'
                : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
            title="3D Point Cloud View"
          >
            <Box className="w-6 h-6" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'info' ? (
            <div className="h-full p-4">
              {error && (
                <div className="mb-4 bg-red-900/30 border border-red-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <Info className="h-5 w-5" />
                    <span className="font-medium">Error:</span>
                  </div>
                  <p className="text-red-300 mt-1">{error}</p>
                </div>
              )}

              {lasData && (
                <div className="grid grid-cols-2 gap-4 h-[calc(100%-2rem)]">
                  {/* Left Column - All Info Panels */}
                  <div className="space-y-4 overflow-y-auto">
                    {/* File Info and Point Stats Row */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* File Information */}
                      <div className="bg-gray-800 shadow-md border border-gray-700 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-400" />
                          File Information
                        </h3>
                        <div className="space-y-1.5 text-sm">
                          <p><span className="font-medium text-gray-300">Version:</span> <span className="text-gray-400">{lasData.header.versionMajor}.{lasData.header.versionMinor}</span></p>
                          <p><span className="font-medium text-gray-300">System ID:</span> <span className="text-gray-400">{lasData.header.systemIdentifier || 'Not specified'}</span></p>
                          <p><span className="font-medium text-gray-300">Software:</span> <span className="text-gray-400">{lasData.header.generatingSoftware || 'Not specified'}</span></p>
                          <p><span className="font-medium text-gray-300">Creation Date:</span> <span className="text-gray-400">{lasData.header.creationYear}-{lasData.header.creationDayOfYear}</span></p>
                          <p><span className="font-medium text-gray-300">Point Format:</span> <span className="text-gray-400">{lasData.header.pointDataRecordFormat}</span></p>
                          <p><span className="font-medium text-gray-300">Point Length:</span> <span className="text-gray-400">{lasData.header.pointDataRecordLength} bytes</span></p>
                        </div>
                      </div>

                      {/* Point Statistics */}
                      <div className="bg-gray-800 shadow-md border border-gray-700 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-blue-400" />
                          Point Statistics
                        </h3>
                        <div className="space-y-1.5 text-sm">
                          <p><span className="font-medium text-gray-300">Total Points:</span> <span className="text-gray-400">{formatNumber(lasData.statistics.totalPoints, 0)}</span></p>
                          <p><span className="font-medium text-gray-300">Point Density:</span> <span className="text-gray-400">{formatNumber(lasData.statistics.totalPoints / ((lasData.header.maxX - lasData.header.minX) * (lasData.header.maxY - lasData.header.minY)), 2)} points/m²</span></p>
                          <p><span className="font-medium text-gray-300">Area:</span> <span className="text-gray-400">{formatNumber((lasData.header.maxX - lasData.header.minX) * (lasData.header.maxY - lasData.header.minY) / 1000000, 2)} km²</span></p>
                        </div>
                      </div>
                    </div>

                    {/* Classification and Return Distribution Row */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Point Classification */}
                      <div className="bg-gray-800 shadow-md border border-gray-700 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
                          <Layers className="h-4 w-4 text-blue-400" />
                          Point Classification
                        </h3>
                        <div className="space-y-1">
                          {Object.entries(lasData.statistics.classificationCounts || {})
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([classification, count]) => (
                              <div key={classification} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: `hsl(${(parseInt(classification) * 30) % 360}deg 100% 50%)` }} 
                                  />
                                  <span className="text-gray-400">{LasFileParser.getClassificationName(parseInt(classification))}</span>
                                </div>
                                <span className="font-medium text-gray-300">{formatNumber(count, 0)}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Return Distribution */}
                      <div className="bg-gray-800 shadow-md border border-gray-700 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 rotate-90 text-blue-400" />
                          Return Distribution
                        </h3>
                        <div className="space-y-1">
                          {lasData.header.numberOfPointsByReturn.map((count, index) => (
                            count > 0 && (
                              <div key={index} className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">
                                  {index === 0 ? "First Return" : 
                                   index === lasData.header.numberOfPointsByReturn.length - 1 ? "Last Return" :
                                   `Return ${index + 1}`}:
                                </span>
                                <span className="font-medium text-gray-300">{formatNumber(count, 0)}</span>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Coordinate and Geographic Info Row */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Coordinate System */}
                      <div className="bg-gray-800 shadow-md border border-gray-700 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
                          <Globe2 className="h-4 w-4 text-blue-400" />
                          Coordinate System
                        </h3>
                        <div className="space-y-1.5 text-sm">
                          <p><span className="font-medium text-gray-300">System:</span> <span className="text-gray-400">Lambert 93</span></p>
                          <p><span className="font-medium text-gray-300">X Range:</span> <span className="text-gray-400">{formatNumber(lasData.header.minX)}m to {formatNumber(lasData.header.maxX)}m</span></p>
                          <p><span className="font-medium text-gray-300">Y Range:</span> <span className="text-gray-400">{formatNumber(lasData.header.minY)}m to {formatNumber(lasData.header.maxY)}m</span></p>
                          <p><span className="font-medium text-gray-300">Z Range:</span> <span className="text-gray-400">{formatNumber(lasData.header.minZ)}m to {formatNumber(lasData.header.maxZ)}m</span></p>
                        </div>
                      </div>

                      {/* Geographic Location */}
                      {lasData.statistics.coordinateInfo && (
                        <div className="bg-gray-800 shadow-md border border-gray-700 rounded-lg p-4">
                          <h3 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-blue-400" />
                            Geographic Location
                          </h3>
                          <div className="space-y-1.5 text-sm">
                            <p><span className="font-medium text-gray-300">Center:</span></p>
                            <p className="ml-2 text-gray-400">Lat: {formatNumber(lasData.statistics.coordinateInfo.centerLatLon.latitude, 6)}°</p>
                            <p className="ml-2 text-gray-400">Lon: {formatNumber(lasData.statistics.coordinateInfo.centerLatLon.longitude, 6)}°</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - Map Only */}
                  {lasData.statistics.coordinateInfo && (
                    <div className="bg-gray-800 shadow-md border border-gray-700 rounded-lg overflow-hidden h-full">
                      <LasMap
                        bounds={lasData.statistics.coordinateInfo.bounds}
                        center={lasData.statistics.coordinateInfo.centerLatLon}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full bg-gray-900">
              {lasData ? (
                <LasPointCloud points={lasData.points} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <p>Load a LAS file to view the 3D point cloud</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};