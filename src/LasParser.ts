// LasParser.ts
import proj4 from 'proj4';

export interface LasHeader {
    fileSignature: string;
    fileSourceId: number;
    globalEncoding: number;
    projectIdGuid: string;
    versionMajor: number;
    versionMinor: number;
    systemIdentifier: string;
    generatingSoftware: string;
    creationDayOfYear: number;
    creationYear: number;
    headerSize: number;
    offsetToPointData: number;
    numberOfVariableLengthRecords: number;
    pointDataRecordFormat: number;
    pointDataRecordLength: number;
    numberOfPointRecords: number;
    numberOfPointsByReturn: number[];
    xScaleFactor: number;
    yScaleFactor: number;
    zScaleFactor: number;
    xOffset: number;
    yOffset: number;
    zOffset: number;
    maxX: number;
    minX: number;
    maxY: number;
    minY: number;
    maxZ: number;
    minZ: number;
  }
  
  export interface LasPoint {
    x: number;
    y: number;
    z: number;
    intensity: number;
    returnNumber: number;
    numberOfReturns: number;
    scanDirectionFlag: number;
    edgeOfFlightLine: number;
    classification: number;
    scanAngleRank: number;
    userData: number;
    pointSourceId: number;
    gpsTime?: number;
    red?: number;
    green?: number;
    blue?: number;
  }
  
  export interface CoordinateInfo {
    utmZone: number;
    hemisphere: 'N' | 'S';
    centerLatLon: {
      latitude: number;
      longitude: number;
    };
    bounds: {
      minLat: number;
      maxLat: number;
      minLon: number;
      maxLon: number;
    };
  }
  
  export interface LasData {
    header: LasHeader;
    points: LasPoint[];
    statistics: {
      totalPoints: number;
      boundingBox: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        minZ: number;
        maxZ: number;
      };
      intensityRange: {
        min: number;
        max: number;
      };
      classificationCounts: Record<number, number>;
      coordinateInfo?: CoordinateInfo;
    };
  }
  
  export class LasParser {
    private dataView: DataView;
    private littleEndian: boolean = true;
    private coordinateInfo?: CoordinateInfo;
    private statistics: {
      totalPoints: number;
      boundingBox: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        minZ: number;
        maxZ: number;
      };
      intensityRange: {
        min: number;
        max: number;
      };
      classificationCounts: Record<number, number>;
    };
  
    constructor(arrayBuffer: ArrayBuffer) {
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Invalid or empty array buffer provided');
      }
      console.log('Received buffer of size:', arrayBuffer.byteLength, 'bytes');
      this.dataView = new DataView(arrayBuffer);
      this.statistics = {
        totalPoints: 0,
        boundingBox: {
          minX: 0,
          maxX: 0,
          minY: 0,
          maxY: 0,
          minZ: 0,
          maxZ: 0
        },
        intensityRange: {
          min: 0,
          max: 0
        },
        classificationCounts: {}
      };
    }
  
    public parse(): LasData {
      try {
        console.log('Starting to parse LAS file...');
        const header = this.parseHeader();
        console.log('Header parsed:', header);
        
        const points = this.parsePoints(header);
        
        const coordinateInfo = this.detectUTMZone(
          (header.maxX + header.minX) / 2,
          (header.maxY + header.minY) / 2
        );

        return {
          header,
          points,
          statistics: {
            ...this.statistics,
            coordinateInfo
          }
        };
      } catch (error) {
        console.error('Error parsing LAS file:', error);
        throw error;
      }
    }
  
    private parseHeader(): LasHeader {
      // Read file signature (4 bytes)
      const fileSignature = this.getString(0, 4);
      if (fileSignature !== 'LASF') {
        throw new Error('Invalid LAS file: File signature must be "LASF"');
      }

      const versionMajor = this.dataView.getUint8(24);
      const versionMinor = this.dataView.getUint8(25);
      const isLAS14 = versionMajor >= 1 && versionMinor >= 4;

      console.log('LAS Version:', versionMajor + '.' + versionMinor);

      // For LAS 1.4+, use the new extended fields
      const numberOfPointRecords = isLAS14 
        ? Number(this.dataView.getBigUint64(247, this.littleEndian))
        : this.dataView.getUint32(107, this.littleEndian);

      console.log('Is LAS 1.4+:', isLAS14);
      console.log('Number of point records:', numberOfPointRecords);

      return {
        fileSignature,
        fileSourceId: this.dataView.getUint16(4, this.littleEndian),
        globalEncoding: this.dataView.getUint16(6, this.littleEndian),
        projectIdGuid: this.getGuid(8),
        versionMajor,
        versionMinor,
        systemIdentifier: this.getString(26, 32).trim(),
        generatingSoftware: this.getString(58, 32).trim(),
        creationDayOfYear: this.dataView.getUint16(90, this.littleEndian),
        creationYear: this.dataView.getUint16(92, this.littleEndian),
        headerSize: this.dataView.getUint16(94, this.littleEndian),
        offsetToPointData: this.dataView.getUint32(96, this.littleEndian),
        numberOfVariableLengthRecords: this.dataView.getUint32(100, this.littleEndian),
        pointDataRecordFormat: this.dataView.getUint8(104),
        pointDataRecordLength: this.dataView.getUint16(105, this.littleEndian),
        numberOfPointRecords,
        numberOfPointsByReturn: isLAS14 ? [
          Number(this.dataView.getBigUint64(255, this.littleEndian)),
          Number(this.dataView.getBigUint64(263, this.littleEndian)),
          Number(this.dataView.getBigUint64(271, this.littleEndian)),
          Number(this.dataView.getBigUint64(279, this.littleEndian)),
          Number(this.dataView.getBigUint64(287, this.littleEndian))
        ] : [
          this.dataView.getUint32(111, this.littleEndian),
          this.dataView.getUint32(115, this.littleEndian),
          this.dataView.getUint32(119, this.littleEndian),
          this.dataView.getUint32(123, this.littleEndian),
          this.dataView.getUint32(127, this.littleEndian)
        ],
        xScaleFactor: this.dataView.getFloat64(131, this.littleEndian),
        yScaleFactor: this.dataView.getFloat64(139, this.littleEndian),
        zScaleFactor: this.dataView.getFloat64(147, this.littleEndian),
        xOffset: this.dataView.getFloat64(155, this.littleEndian),
        yOffset: this.dataView.getFloat64(163, this.littleEndian),
        zOffset: this.dataView.getFloat64(171, this.littleEndian),
        maxX: this.dataView.getFloat64(179, this.littleEndian),
        minX: this.dataView.getFloat64(187, this.littleEndian),
        maxY: this.dataView.getFloat64(195, this.littleEndian),
        minY: this.dataView.getFloat64(203, this.littleEndian),
        maxZ: this.dataView.getFloat64(211, this.littleEndian),
        minZ: this.dataView.getFloat64(219, this.littleEndian)
      };
    }
  
    private parsePoints(header: LasHeader): LasPoint[] {
      const points: LasPoint[] = [];
      const pointSize = header.pointDataRecordLength;
      
      // First pass: gather statistics from all points
      console.log('First pass: gathering statistics from all points...');
      for (let i = 0; i < header.numberOfPointRecords; i++) {
        const offset = header.offsetToPointData + (i * pointSize);
        if (offset + pointSize > this.dataView.byteLength) {
          console.error('Buffer overflow at point', i, 'offset:', offset);
          break;
        }

        // Just read classification and update stats
        const classification = this.dataView.getUint8(offset + 16);
        this.statistics.classificationCounts[classification] = (this.statistics.classificationCounts[classification] || 0) + 1;

        // Log progress every 5 million points
        if (i % 5000000 === 0) {
          console.log(`Processed statistics for ${i.toLocaleString()} points...`);
        }
      }
      
      // Second pass: read all points (with optional sampling)
      console.log('Second pass: reading points...');
      const totalPoints = header.numberOfPointRecords;

      try {
        const batchSize = 1000000; // Process in batches of 1M points
        for (let i = 0; i < header.numberOfPointRecords; i++) {
          const offset = header.offsetToPointData + (i * pointSize);
          if (offset + pointSize > this.dataView.byteLength) {
            console.error('Buffer overflow at point', i, 'offset:', offset);
            break;
          }

          const point = this.parsePoint(offset, header);
          points.push(point);

          // Log progress every million points
          if (i % batchSize === 0) {
            console.log(`Read ${i.toLocaleString()} points...`);
          }
        }
      } catch (error) {
        console.error('Error processing points:', error);
        throw error;
      }

      this.statistics.totalPoints = header.numberOfPointRecords;
      console.log(`Parsed ${points.length.toLocaleString()} points out of ${totalPoints.toLocaleString()} total`);
      console.log('Classification counts:', this.statistics.classificationCounts);
      return points;
    }
  
    private parsePoint(offset: number, header: LasHeader): LasPoint {
      // Parse basic point data (format 0)
      const rawX = this.dataView.getUint32(offset, this.littleEndian);
      const rawY = this.dataView.getUint32(offset + 4, this.littleEndian);
      const rawZ = this.dataView.getUint32(offset + 8, this.littleEndian);
  
      const x = rawX * header.xScaleFactor + header.xOffset;
      const y = rawY * header.yScaleFactor + header.yOffset;
      const z = rawZ * header.zScaleFactor + header.zOffset;
  
      const intensity = this.dataView.getUint16(offset + 12, this.littleEndian);
      const returnInfo = this.dataView.getUint8(offset + 14);
      const flags = this.dataView.getUint8(offset + 15);
      const classification = this.dataView.getUint8(offset + 16);
      const scanAngleRank = this.dataView.getInt8(offset + 17);
      const userData = this.dataView.getUint8(offset + 18);
      const pointSourceId = this.dataView.getUint16(offset + 19, this.littleEndian);
  
      const point: LasPoint = {
        x,
        y,
        z,
        intensity,
        returnNumber: returnInfo & 0x07,
        numberOfReturns: (returnInfo >> 3) & 0x07,
        scanDirectionFlag: flags & 0x01,
        edgeOfFlightLine: (flags >> 1) & 0x01,
        classification,
        scanAngleRank,
        userData,
        pointSourceId
      };
  
      // Add additional fields based on point data format
      if (header.pointDataRecordFormat >= 1) {
        point.gpsTime = this.dataView.getFloat64(offset + 20, this.littleEndian);
      }
  
      if (header.pointDataRecordFormat >= 2) {
        const colorOffset = header.pointDataRecordFormat === 2 ? 20 : 28;
        point.red = this.dataView.getUint16(offset + colorOffset, this.littleEndian);
        point.green = this.dataView.getUint16(offset + colorOffset + 2, this.littleEndian);
        point.blue = this.dataView.getUint16(offset + colorOffset + 4, this.littleEndian);
      }
  
      return point;
    }
  
    private detectUTMZone(centerX: number, centerY: number): CoordinateInfo {
      // Lambert 93 projection string (French national grid)
      const lambert93 = '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
      const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';

      // Convert center coordinates to lat/lon
      const [centerLon, centerLat] = proj4(lambert93, wgs84, [centerX, centerY]);

      // Convert bounds
      const [minLon, minLat] = proj4(lambert93, wgs84, [
        this.dataView.getFloat64(187, this.littleEndian),
        this.dataView.getFloat64(203, this.littleEndian)
      ]);
      const [maxLon, maxLat] = proj4(lambert93, wgs84, [
        this.dataView.getFloat64(179, this.littleEndian),
        this.dataView.getFloat64(195, this.littleEndian)
      ]);

      console.log('Lambert 93 Coordinates:', {
        centerX,
        centerY,
        converted: { lat: centerLat, lon: centerLon }
      });

      return {
        utmZone: 0, // Not applicable for Lambert 93
        hemisphere: 'N',
        centerLatLon: {
          latitude: centerLat,
          longitude: centerLon
        },
        bounds: {
          minLat,
          maxLat,
          minLon,
          maxLon
        }
      };
    }
  
    private getString(offset: number, length: number): string {
      const bytes = new Uint8Array(this.dataView.buffer, offset, length);
      return new TextDecoder('ascii').decode(bytes).replace(/\0/g, '');
    }
  
    private getGuid(offset: number): string {
      const bytes = new Uint8Array(this.dataView.buffer, offset, 16);
      const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        hex.substring(12, 16),
        hex.substring(16, 20),
        hex.substring(20, 32)
      ].join('-');
    }
  
    public static getClassificationName(classification: number): string {
      const classifications: Record<number, string> = {
        0: 'Created, never classified',
        1: 'Unclassified',
        2: 'Ground',
        3: 'Low Vegetation',
        4: 'Medium Vegetation',
        5: 'High Vegetation',
        6: 'Building',
        7: 'Low Point (noise)',
        8: 'Model Key-point',
        9: 'Water',
        10: 'Reserved',
        11: 'Reserved',
        12: 'Overlap Points'
      };
      
      return classifications[classification] || `User Defined (${classification})`;
    }
  
    // Utility method to convert UTM to Lat/Lon
    public convertToLatLon(x: number, y: number): { latitude: number; longitude: number } {
      if (!this.coordinateInfo) {
        throw new Error('Coordinate system information not available');
      }

      const { utmZone, hemisphere } = this.coordinateInfo;
      const utmProj = `+proj=utm +zone=${utmZone} ${hemisphere === 'N' ? '+north' : '+south'} +datum=WGS84 +units=m +no_defs`;
      const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';

      const [lon, lat] = proj4(utmProj, wgs84, [x, y]);
      return { latitude: lat, longitude: lon };
    }
  }