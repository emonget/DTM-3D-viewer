import React from 'react';
import { FileText, Info, BarChart3, Globe2, MapPin, Layers } from 'lucide-react';
import type { LasData } from './LasFileParser';
import { LasFileParser } from './LasFileParser';
import { formatNumber } from './utils';

interface SidePanelsProps {
  lasData: LasData | null;
  error: string | null;
}

export const SidePanels: React.FC<SidePanelsProps> = ({ lasData, error }) => {
  const formatPointCount = (count: number): string => {
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}K`;
    }
    return count.toString();
  };

  if (!lasData && !error) {
    return null;
  }

  return (
    <div className="h-full p-4 overflow-y-auto">
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
        <div className="space-y-4">
          {/* File Info and Point Stats Row */}
          <div className="grid grid-cols-1 gap-4">
            {/* File Information */}
            <div className="bg-zinc-700/50 rounded-lg p-4">
              <h3 className="font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-300" />
                File Information
              </h3>
              <div className="space-y-1.5 text-sm">
                <p><span className="font-medium text-zinc-200">Version:</span> <span className="text-zinc-300">{lasData.header.versionMajor}.{lasData.header.versionMinor}</span></p>
                <p><span className="font-medium text-zinc-200">System ID:</span> <span className="text-zinc-300">{lasData.header.systemIdentifier || 'Not specified'}</span></p>
                <p><span className="font-medium text-zinc-200">Software:</span> <span className="text-zinc-300">{lasData.header.generatingSoftware || 'Not specified'}</span></p>
                <p><span className="font-medium text-zinc-200">Creation Date:</span> <span className="text-zinc-300">{lasData.header.creationYear}-{lasData.header.creationDayOfYear}</span></p>
                <p><span className="font-medium text-zinc-200">Point Format:</span> <span className="text-zinc-300">{lasData.header.pointDataRecordFormat}</span></p>
                <p><span className="font-medium text-zinc-200">Point Length:</span> <span className="text-zinc-300">{lasData.header.pointDataRecordLength} bytes</span></p>
              </div>
            </div>

            {/* Point Statistics */}
            <div className="bg-zinc-700/50 rounded-lg p-4">
              <h3 className="font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-zinc-300" />
                Point Statistics
              </h3>
              <div className="space-y-1.5 text-sm">
                <p><span className="font-medium text-zinc-200">Total Points:</span> <span className="text-zinc-300">{formatNumber(lasData.statistics.totalPoints, 0)}</span></p>
                <p><span className="font-medium text-zinc-200">Point Density:</span> <span className="text-zinc-300">{formatNumber(lasData.statistics.totalPoints / ((lasData.header.maxX - lasData.header.minX) * (lasData.header.maxY - lasData.header.minY)), 2)} points/m²</span></p>
                <p><span className="font-medium text-zinc-200">Area:</span> <span className="text-zinc-300">{formatNumber((lasData.header.maxX - lasData.header.minX) * (lasData.header.maxY - lasData.header.minY) / 1000000, 2)} km²</span></p>
              </div>
            </div>

            {/* Point Classification */}
            <div className="bg-zinc-700/50 rounded-lg p-4">
              <h3 className="font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-zinc-300" />
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
                        <span className="text-zinc-300">{LasFileParser.getClassificationName(parseInt(classification))}</span>
                      </div>
                      <span className="font-medium text-zinc-200">{formatPointCount(count)}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Coordinate System */}
            <div className="bg-zinc-700/50 rounded-lg p-4">
              <h3 className="font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-zinc-300" />
                Coordinate System
              </h3>
              <div className="space-y-1.5 text-sm">
                <p><span className="font-medium text-zinc-200">System:</span> <span className="text-zinc-300">Lambert 93</span></p>
                <p><span className="font-medium text-zinc-200">X Range:</span> <span className="text-zinc-300">{formatNumber(lasData.header.minX)}m to {formatNumber(lasData.header.maxX)}m</span></p>
                <p><span className="font-medium text-zinc-200">Y Range:</span> <span className="text-zinc-300">{formatNumber(lasData.header.minY)}m to {formatNumber(lasData.header.maxY)}m</span></p>
                <p><span className="font-medium text-zinc-200">Z Range:</span> <span className="text-zinc-300">{formatNumber(lasData.header.minZ)}m to {formatNumber(lasData.header.maxZ)}m</span></p>
              </div>
            </div>

            {/* Geographic Location */}
            {lasData.statistics.coordinateInfo && (
              <div className="bg-zinc-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-zinc-300" />
                  Geographic Location
                </h3>
                <div className="space-y-1.5 text-sm">
                  <p><span className="font-medium text-zinc-200">Center:</span></p>
                  <p className="ml-2 text-zinc-300">Lat: {formatNumber(lasData.statistics.coordinateInfo.centerLatLon.latitude, 6)}°</p>
                  <p className="ml-2 text-zinc-300">Lon: {formatNumber(lasData.statistics.coordinateInfo.centerLatLon.longitude, 6)}°</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 