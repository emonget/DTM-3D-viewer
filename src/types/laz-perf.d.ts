declare module 'laz-perf' {
  interface LASZip {
    open(filePtr: number, fileLength: number): void;
    getPoint(dataPtr: number): void;
    delete(): void;
  }

  interface LazPerf {
    LASZip: new () => LASZip;
    _malloc(size: number): number;
    _free(ptr: number): void;
    HEAPU8: {
      buffer: ArrayBuffer;
      set(array: Uint8Array, offset: number): void;
    };
  }

  export function createLazPerf(): Promise<LazPerf>;
} 