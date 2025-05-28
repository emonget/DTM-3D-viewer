// LazFileParser.ts 
import { createLazPerf } from 'laz-perf';
import { LasFileParser, type LasHeader, type LasPoint } from './LasFileParser';

export type { LasPoint };  // Re-export the type

export class LazFileParser extends LasFileParser {
  constructor(file: File) {
    super(file);
  }

  protected parsePoint(offset: number, header: LasHeader, pointBuffer?: Uint8Array): LasPoint {
    const view = pointBuffer ? 
      new DataView(pointBuffer.buffer, pointBuffer.byteOffset, pointBuffer.byteLength) :
      this.dataView;
    
    const offsetToUse = pointBuffer ? 0 : offset;

    const x = view.getInt32(offsetToUse + 0, this.littleEndian) * header.xScaleFactor + header.xOffset;
    const y = view.getInt32(offsetToUse + 4, this.littleEndian) * header.yScaleFactor + header.yOffset;
    const z = view.getInt32(offsetToUse + 8, this.littleEndian) * header.zScaleFactor + header.zOffset;
    const intensity = view.getUint16(offsetToUse + 12, this.littleEndian);
    
    const returnByte = view.getUint8(offsetToUse + 14);
    const returnNumber = returnByte & 0x07;
    const numberOfReturns = (returnByte >> 3) & 0x07;
    const scanDirectionFlag = (returnByte >> 6) & 0x01;
    const edgeOfFlightLine = (returnByte >> 7) & 0x01;
    
    const classification = view.getUint8(offsetToUse + 16);
    const scanAngleRank = view.getInt8(offsetToUse + 17);
    const userData = view.getUint8(offsetToUse + 18);
    const pointSourceId = view.getUint16(offsetToUse + 19, this.littleEndian);
    
    let gpsTime: number | undefined;
    let rgb: { red?: number; green?: number; blue?: number } = {};
    
    // Handle different point formats
    if (header.pointDataRecordFormat === 1 || header.pointDataRecordFormat === 3) {
      gpsTime = view.getFloat64(offsetToUse + 20, this.littleEndian);
    }
    
    if (header.pointDataRecordFormat === 2 || header.pointDataRecordFormat === 3) {
      rgb.red = view.getUint16(offsetToUse + (header.pointDataRecordFormat === 3 ? 28 : 20), this.littleEndian);
      rgb.green = view.getUint16(offsetToUse + (header.pointDataRecordFormat === 3 ? 30 : 22), this.littleEndian);
      rgb.blue = view.getUint16(offsetToUse + (header.pointDataRecordFormat === 3 ? 32 : 24), this.littleEndian);
    }
    
    return {
      x,
      y,
      z,
      intensity,
      returnNumber,
      numberOfReturns,
      scanDirectionFlag,
      edgeOfFlightLine,
      classification,
      scanAngleRank,
      userData,
      pointSourceId,
      gpsTime,
      ...rgb
    };
  }

  public async parseLazFile(): Promise<LasPoint[]> {
    try {
      await this.initializeDataView();
      const header = this.parseHeader();
      
      // Create our Emscripten module
      const LazPerf = await createLazPerf();
      const laszip = new LazPerf.LASZip();
      
      // Allocate memory in the Emscripten heap
      const dataPtr = LazPerf._malloc(header.pointDataRecordLength);
      const filePtr = LazPerf._malloc(this.dataView.buffer.byteLength);
      
      // Copy our data into the Emscripten heap
      LazPerf.HEAPU8.set(new Uint8Array(this.dataView.buffer), filePtr);
      
      const points: LasPoint[] = [];
      
      try {
        laszip.open(filePtr, this.dataView.buffer.byteLength);
        
        for (let i = 0; i < header.numberOfPointRecords; ++i) {
          laszip.getPoint(dataPtr);
          
          // Copy point data from Emscripten heap
          const pointBuffer = new Uint8Array(
            LazPerf.HEAPU8.buffer.slice(dataPtr, dataPtr + header.pointDataRecordLength)
          );
          
          const point = this.parsePoint(0, header, pointBuffer);
          points.push(point);
          
          // Update statistics
          this.updateStatistics(point);
          
          // Log progress every 5 million points
          if (i % 5000000 === 0) {
            console.log(`Processed ${i.toLocaleString()} points...`);
          }
        }
        
        console.log(`Successfully processed ${header.numberOfPointRecords} points`);
        
      } finally {
        // Clean up allocated memory
        LazPerf._free(filePtr);
        LazPerf._free(dataPtr);
        laszip.delete();
      }
      
      return points;
      
    } catch (error) {
      console.error('Error processing LAZ file:', error);
      throw error;
    }
  }

  protected async parsePoints(header: LasHeader): Promise<LasPoint[]> {
    const points: LasPoint[] = [];
    const LazPerf = await createLazPerf();
    const laszip = new LazPerf.LASZip();
    
    // Allocate memory in the Emscripten heap
    const dataPtr = LazPerf._malloc(header.pointDataRecordLength);
    const filePtr = LazPerf._malloc(this.dataView.buffer.byteLength);
    
    // Copy our data into the Emscripten heap
    LazPerf.HEAPU8.set(new Uint8Array(this.dataView.buffer), filePtr);
    
    try {
      laszip.open(filePtr, this.dataView.buffer.byteLength);
      
      for (let i = 0; i < header.numberOfPointRecords; i++) {
        laszip.getPoint(dataPtr);
        
        // Copy point data from Emscripten heap
        const pointBuffer = new Uint8Array(
          LazPerf.HEAPU8.buffer.slice(dataPtr, dataPtr + header.pointDataRecordLength)
        );
        
        const point = this.parsePoint(0, header, pointBuffer);
        points.push(point);
        
        // Update statistics
        this.updateStatistics(point);
        
        // Log progress every 5 million points
        if (i % 5000000 === 0) {
          console.log(`Processed ${i.toLocaleString()} points...`);
        }
      }
    } finally {
      // Clean up allocated memory
      LazPerf._free(filePtr);
      LazPerf._free(dataPtr);
      laszip.delete();
    }
    
    return points;
  }

  private updateStatistics(point: LasPoint): void {
    // Update classification counts
    this.statistics.classificationCounts[point.classification] = 
      (this.statistics.classificationCounts[point.classification] || 0) + 1;

    // Update intensity range
    if (point.intensity < this.statistics.intensityRange.min) {
      this.statistics.intensityRange.min = point.intensity;
    }
    if (point.intensity > this.statistics.intensityRange.max) {
      this.statistics.intensityRange.max = point.intensity;
    }

    // Update bounding box
    this.statistics.boundingBox.minX = Math.min(this.statistics.boundingBox.minX, point.x);
    this.statistics.boundingBox.maxX = Math.max(this.statistics.boundingBox.maxX, point.x);
    this.statistics.boundingBox.minY = Math.min(this.statistics.boundingBox.minY, point.y);
    this.statistics.boundingBox.maxY = Math.max(this.statistics.boundingBox.maxY, point.y);
    this.statistics.boundingBox.minZ = Math.min(this.statistics.boundingBox.minZ, point.z);
    this.statistics.boundingBox.maxZ = Math.max(this.statistics.boundingBox.maxZ, point.z);
  }
}