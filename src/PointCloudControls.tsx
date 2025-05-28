import React, { useState } from 'react';
import { Settings, Eye, Droplet, Grid, Palette, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { LasFileParser } from './LasFileParser';

export interface PointCloudSettings {
  pointSize: number;
  opacity: number;
  colorMode: 'classification' | 'elevation' | 'intensity';
  maxPoints: number | null;  // null means show all points
  showGrid: boolean;
  visibleClassifications: Set<number>;
}

interface PointCloudControlsProps {
  settings: PointCloudSettings;
  onSettingsChange: (settings: PointCloudSettings) => void;
  totalPoints: number;
  classificationCounts: Record<number, number>;
}

export const PointCloudControls: React.FC<PointCloudControlsProps> = ({
  settings,
  onSettingsChange,
  totalPoints,
  classificationCounts
}) => {
  const [showClassifications, setShowClassifications] = useState(false);

  const updateSetting = <K extends keyof PointCloudSettings>(
    key: K,
    value: PointCloudSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const toggleClassification = (classification: number) => {
    const newVisibleClassifications = new Set(settings.visibleClassifications);
    if (newVisibleClassifications.has(classification)) {
      newVisibleClassifications.delete(classification);
    } else {
      newVisibleClassifications.add(classification);
    }
    updateSetting('visibleClassifications', newVisibleClassifications);
  };

  const formatPointCount = (count: number): string => {
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <div className="absolute top-4 right-4 bg-zinc-800/90 rounded-lg p-4 text-zinc-100 w-72 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto border border-zinc-700">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-4 h-4 text-zinc-300" />
        <h3 className="font-medium">Visualization Settings</h3>
      </div>

      {/* Classifications */}
      <div className="space-y-2 bg-zinc-700/50 rounded-lg p-3">
        <button
          onClick={() => setShowClassifications(!showClassifications)}
          className="flex items-center justify-between w-full text-sm font-medium text-zinc-100"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-300" />
            <span>Classifications</span>
          </div>
          {showClassifications ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </button>
        {showClassifications && (
          <div className="space-y-2 mt-2">
            {Object.entries(classificationCounts)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .filter(([_, count]) => count > 0)
              .map(([classification, count]) => (
                <div key={classification} className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm flex-1">
                    <input
                      type="checkbox"
                      checked={settings.visibleClassifications.has(parseInt(classification))}
                      onChange={() => toggleClassification(parseInt(classification))}
                      className="rounded bg-zinc-600 border-zinc-500 text-zinc-300 focus:ring-zinc-500"
                    />
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ 
                        backgroundColor: `hsl(${(parseInt(classification) * 30) % 360}deg 100% 50%)` 
                      }} 
                    />
                    <span className="flex-1 text-zinc-300">{LasFileParser.getClassificationName(parseInt(classification))}</span>
                    <span className="text-zinc-400 text-xs">
                      {formatPointCount(count)}
                    </span>
                  </label>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Point Size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-zinc-300" />
            <span className="text-sm">Point Size</span>
          </label>
          <span className="text-sm text-zinc-400">{settings.pointSize.toFixed(3)}</span>
        </div>
        <input
          type="range"
          min="0.01"
          max="1"
          step="0.01"
          value={settings.pointSize}
          onChange={(e) => updateSetting('pointSize', parseFloat(e.target.value))}
          className="w-full bg-zinc-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Opacity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <Droplet className="w-4 h-4 text-zinc-300" />
            <span className="text-sm">Opacity</span>
          </label>
          <span className="text-sm text-zinc-400">{(settings.opacity * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          value={settings.opacity}
          onChange={(e) => updateSetting('opacity', parseFloat(e.target.value))}
          className="w-full bg-zinc-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Color Mode */}
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-zinc-300" />
          <span className="text-sm">Color Mode</span>
        </label>
        <select
          value={settings.colorMode}
          onChange={(e) => updateSetting('colorMode', e.target.value as PointCloudSettings['colorMode'])}
          className="w-full bg-zinc-700 text-zinc-100 rounded px-2 py-1 text-sm border border-zinc-600 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
        >
          <option value="classification">Classification</option>
          <option value="elevation">Elevation</option>
          <option value="intensity">Intensity</option>
        </select>
      </div>

      {/* Point Limit */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm">Point Limit</label>
          <span className="text-sm text-zinc-400">
            {formatPointCount(settings.maxPoints ?? totalPoints)} / {formatPointCount(totalPoints)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={10000}
            max={totalPoints}
            step={10000}
            value={settings.maxPoints ?? totalPoints}
            onChange={(e) => updateSetting('maxPoints', parseInt(e.target.value))}
            className="flex-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
          />
          <button
            onClick={() => updateSetting('maxPoints', settings.maxPoints === null ? 1000000 : null)}
            className={`px-2 py-1 text-xs rounded ${
              settings.maxPoints === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-zinc-300" />
          <span className="text-sm">Show Grid</span>
        </label>
        <input
          type="checkbox"
          checked={settings.showGrid}
          onChange={(e) => updateSetting('showGrid', e.target.checked)}
          className="rounded bg-zinc-600 border-zinc-500 text-zinc-300 focus:ring-zinc-500"
        />
      </div>
    </div>
  );
}; 