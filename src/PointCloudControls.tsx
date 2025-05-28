import React from 'react';
import { Settings, Eye, Droplet, Grid, Palette } from 'lucide-react';

export interface PointCloudSettings {
  pointSize: number;
  opacity: number;
  colorMode: 'classification' | 'elevation' | 'intensity';
  maxPoints: number | null;  // null means show all points
  showGrid: boolean;
}

interface PointCloudControlsProps {
  settings: PointCloudSettings;
  onSettingsChange: (settings: PointCloudSettings) => void;
  totalPoints: number;
}

export const PointCloudControls: React.FC<PointCloudControlsProps> = ({
  settings,
  onSettingsChange,
  totalPoints,
}) => {
  const updateSetting = <K extends keyof PointCloudSettings>(
    key: K,
    value: PointCloudSettings[K]
  ) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  const formatPointCount = (count: number | null) => {
    if (count === null) return 'All';
    return count >= 1000000 
      ? `${(count / 1000000).toFixed(1)}M` 
      : `${(count / 1000).toFixed(0)}K`;
  };

  return (
    <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-90 rounded-lg p-4 text-white w-64 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-4 h-4" />
        <h3 className="font-medium">Visualization Settings</h3>
      </div>

      {/* Point Size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span className="text-sm">Point Size</span>
          </label>
          <span className="text-sm text-gray-400">{settings.pointSize.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={settings.pointSize}
          onChange={(e) => updateSetting('pointSize', parseFloat(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Opacity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <Droplet className="w-4 h-4" />
            <span className="text-sm">Opacity</span>
          </label>
          <span className="text-sm text-gray-400">{(settings.opacity * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          value={settings.opacity}
          onChange={(e) => updateSetting('opacity', parseFloat(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Color Mode */}
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          <span className="text-sm">Color Mode</span>
        </label>
        <select
          value={settings.colorMode}
          onChange={(e) => updateSetting('colorMode', e.target.value as PointCloudSettings['colorMode'])}
          className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm"
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
          <span className="text-sm text-gray-400">
            {formatPointCount(settings.maxPoints)} / {formatPointCount(totalPoints)}
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
            className="flex-1"
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
          <Grid className="w-4 h-4" />
          <span className="text-sm">Show Grid</span>
        </label>
        <input
          type="checkbox"
          checked={settings.showGrid}
          onChange={(e) => updateSetting('showGrid', e.target.checked)}
          className="rounded"
        />
      </div>
    </div>
  );
}; 