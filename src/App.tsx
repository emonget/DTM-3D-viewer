import './App.css'
import { useState, useRef } from 'react'
import { Menu, Upload, Layers } from 'lucide-react'
import { LasPointCloud } from './LasPointCloud'
import { LasMap } from './LasMap'
import { SidePanels } from './SidePanels'
import { LasFileParser } from './LasFileParser'
import { LazFileParser } from './LazFileParser'
import type { LasData } from './LasFileParser'

function App() {
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(true)
  const [lasData, setLasData] = useState<LasData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="fixed inset-0 flex bg-zinc-900">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-zinc-800/80 backdrop-blur-sm shadow-md border-b border-zinc-700 flex items-center px-4 z-50">
        <div className="flex-1 flex items-center gap-4">
          <button
            onClick={() => setIsInfoPanelOpen(!isInfoPanelOpen)}
            className="text-zinc-400 hover:text-zinc-200 p-2 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Layers className="text-zinc-400" />
            LIDAR LAS/LAZ Viewer
          </h1>
          <input
            ref={fileInputRef}
            type="file"
            accept=".las,.laz"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 pt-16 relative">
        {/* Collapsible Info Panel */}
        <div className={`h-full bg-zinc-800/80 backdrop-blur-sm border-r border-zinc-700 transition-all duration-300 flex flex-col ${isInfoPanelOpen ? 'w-[480px]' : 'w-0'}`}>
          <div className={`w-full h-full overflow-hidden flex flex-col ${isInfoPanelOpen ? 'opacity-100' : 'opacity-0'}`}>
            {/* Map Section */}
            {lasData?.statistics.coordinateInfo && (
              <div className="h-96 p-4 border-b border-zinc-700">
                <div className="w-full h-full rounded-lg overflow-hidden bg-zinc-800/50">
                  <LasMap
                    bounds={lasData.statistics.coordinateInfo.bounds}
                    center={lasData.statistics.coordinateInfo.centerLatLon}
                  />
                </div>
              </div>
            )}
            {/* Info Panels Section */}
            <div className="flex-1 overflow-y-auto">
              <SidePanels lasData={lasData} error={error} />
            </div>
          </div>
        </div>

        {/* Main 3D View */}
        <main className="flex-1 relative">
          <div className="absolute inset-0">
            {lasData ? (
              <LasPointCloud points={lasData.points} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-zinc-400">
                <p className="text-lg">Load a LAS/LAZ file to view the 3D point cloud</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-100 px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 text-base"
                >
                  <Upload className="w-5 h-5" />
                  {loading ? 'Processing...' : 'Load LAS/LAZ File'}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
