import React, { useCallback, useState, useEffect } from 'react';
import { createLazPerf } from 'laz-perf';
import { LazFileParser, type LasPoint } from './LazFileParser';

interface LazFileInputProps {
  onPointsLoaded: (points: Float32Array[]) => void;
}

/**
 * Parse out a small subset of the LAS header that we will use to verify point
 * data contents.
 * @param {Uint8Array|ArrayBuffer} file - The file data as Uint8Array or ArrayBuffer
 * @returns {Object} Parsed header information
 */
export function parseHeader(file: ArrayBuffer | Uint8Array) {
    // Convert ArrayBuffer to Uint8Array if needed
    let fileData;
    if (file instanceof ArrayBuffer) {
      fileData = new Uint8Array(file);
    } else if (file instanceof Uint8Array) {
      fileData = file;
    } else {
      throw new Error('File must be ArrayBuffer or Uint8Array');
    }
  
    if (fileData.byteLength < 227) {
      throw new Error('Invalid file length');
    }
  
    // Create DataView for reading multi-byte values with proper endianness
    const dataView = new DataView(fileData.buffer, fileData.byteOffset, fileData.byteLength);
  
    const pointDataRecordFormat = fileData[104] & 0b1111;
    const pointDataRecordLength = dataView.getUint16(105, true); // true = little-endian
    const pointDataOffset = dataView.getUint32(96, true);
    const pointCount = dataView.getUint32(107, true);
  
    const scale = [
      dataView.getFloat64(131, true), // readDoubleLE equivalent
      dataView.getFloat64(139, true),
      dataView.getFloat64(147, true),
    ];
  
    const offset = [
      dataView.getFloat64(155, true),
      dataView.getFloat64(163, true),
      dataView.getFloat64(171, true),
    ];
  
    const min = [
      dataView.getFloat64(187, true),
      dataView.getFloat64(203, true),
      dataView.getFloat64(219, true),
    ];
  
    const max = [
      dataView.getFloat64(179, true),
      dataView.getFloat64(195, true),
      dataView.getFloat64(211, true),
    ];
  
    return {
      pointDataRecordFormat,
      pointDataRecordLength,
      pointDataOffset,
      pointCount,
      scale,
      offset,
      min,
      max,
    };
  }
  
  // Alternative version that accepts File object directly
  export async function parseHeaderFromFile(file: File) {
    if (!(file instanceof File)) {
      throw new Error('Input must be a File object');
    }
    
    // Only read the header portion (first 227+ bytes) for efficiency
    const headerSize = Math.min(file.size, 400); // Read a bit more than minimum
    const headerBlob = file.slice(0, headerSize);
    const headerBuffer = await headerBlob.arrayBuffer();
    
    return parseHeader(new Uint8Array(headerBuffer));
  }
  
  // Utility function for reading from file input
  export function handleLazFileInput(
    event: React.ChangeEvent<HTMLInputElement>, 
    callback: (error: Error | null, header: any | null, file: File | null) => void
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.laz') && !file.name.toLowerCase().endsWith('.las')) {
      throw new Error('Please select a .laz or .las file');
    }
    
    parseHeaderFromFile(file)
      .then(header => callback(null, header, file))
      .catch(error => callback(error, null, file));
  }

export const LazFileInput: React.FC<LazFileInputProps> = ({ onPointsLoaded }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [LazPerf, setLazPerf] = useState<any>(null);

  useEffect(() => {
    const initLazPerf = async () => {
      try {
        const lazPerfModule = await createLazPerf();
        setLazPerf(lazPerfModule);
      } catch (err) {
        console.error('Failed to initialize laz-perf:', err);
        setError('Failed to initialize LAZ processing module. Please try reloading the page.');
      }
    };

    initLazPerf();
  }, []);

  const processLazFile = useCallback(async (file: File) => {
    if (!LazPerf) {
      setError('LAZ processing module not initialized. Please try again.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const parser = new LazFileParser(file);
      const points = await parser.parseLazFile();
      onPointsLoaded(points.map(p => new Float32Array([p.x, p.y, p.z])));
      
    } catch (error) {
      console.error('Error processing LAZ file:', error);
      setError(error instanceof Error ? error.message : 'Failed to process LAZ file');
    } finally {
      setIsLoading(false);
    }
  }, [LazPerf, onPointsLoaded]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processLazFile(file);
    }
  }, [processLazFile]);

  return (
    <div className="laz-file-input">
      <input
        type="file"
        accept=".laz"
        onChange={handleFileChange}
        disabled={isLoading || !LazPerf}
      />
      {!LazPerf && !error && <div>Initializing LAZ processor...</div>}
      {isLoading && <div>Processing LAZ file...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}; 