import './App.css'
import { DTMGeoTIFFViewer } from './DtmViewer'
import { LasViewer } from './LasViewer'


function App() {

  return (
    <>
      {/* <DTMGeoTIFFViewer/> */}
      <LasViewer/>
        <h3 className="text-lg font-semibold mb-2">LAZ File Input</h3>
        {/* <LazFileInput onPointsLoaded={handlePointsLoaded} /> */}
    </>
  )
}

export default App
