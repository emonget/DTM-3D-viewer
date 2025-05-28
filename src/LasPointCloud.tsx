import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid as DreiGrid } from '@react-three/drei';
import * as THREE from 'three';
import type { LasPoint } from './LasFileParser';
import { PointCloudControls, type PointCloudSettings } from './PointCloudControls';

interface LasPointCloudProps {
  points: LasPoint[];
  onLoaded?: () => void;
}

function PointCloud({ points, settings }: { points: LasPoint[]; settings: PointCloudSettings }) {
  const pointsRef = useRef<THREE.Points>(null);
  const { camera } = useThree();
  const [isProcessing, setIsProcessing] = useState(true);

  const [positions, colors, bounds] = useMemo(() => {
    // Filter points based on visible classifications
    const visiblePoints = points.filter(p => settings.visibleClassifications.has(p.classification));
    const pointCount = settings.maxPoints === null ? visiblePoints.length : Math.min(visiblePoints.length, settings.maxPoints);
    console.log('Processing points for visualization:', pointCount);
    setIsProcessing(true);
    
    const positions = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);
    
    // Calculate bounds for normalization
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let minIntensity = Infinity, maxIntensity = -Infinity;

    // First pass: calculate bounds
    for (let i = 0; i < visiblePoints.length; i++) {
      const point = visiblePoints[i];
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
      minIntensity = Math.min(minIntensity, point.intensity);
      maxIntensity = Math.max(maxIntensity, point.intensity);
    }

    // Calculate center and scale
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    
    const maxDimension = Math.max(
      maxX - minX,
      maxY - minY,
      maxZ - minZ
    );
    const scale = 100 / maxDimension;

    // Second pass: process points in batches
    const batchSize = 1000000;
    const processBatch = (startIdx: number) => {
      const endIdx = Math.min(startIdx + batchSize, pointCount);
      
      for (let i = startIdx; i < endIdx; i++) {
        // If we're not showing all points, use a sampling strategy
        const sourceIndex = settings.maxPoints === null ? i : Math.floor(i * (visiblePoints.length / pointCount));
        const point = visiblePoints[sourceIndex];
        const i3 = i * 3;
        
        // Store normalized positions
        positions[i3] = (point.y - centerY) * scale;     // Y becomes X (East-West)
        positions[i3 + 1] = (point.z - centerZ) * scale; // Z becomes Y (height)
        positions[i3 + 2] = (point.x - centerX) * scale; // X becomes Z (North-South)

        // Color based on selected mode
        let color: THREE.Color;
        switch (settings.colorMode) {
          case 'classification':
            const hue = (point.classification * 30) % 360;
            color = new THREE.Color().setHSL(hue / 360, 1, 0.5);
            break;
          case 'elevation':
            const normalizedZ = (point.z - minZ) / (maxZ - minZ);
            color = new THREE.Color().setHSL(normalizedZ * 0.3 + 0.6, 1, 0.5);
            break;
          case 'intensity':
            const normalizedIntensity = (point.intensity - minIntensity) / (maxIntensity - minIntensity);
            color = new THREE.Color().setHSL(0, 0, normalizedIntensity);
            break;
        }

        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
      }
    };

    // Process all points in batches
    for (let i = 0; i < pointCount; i += batchSize) {
      processBatch(i);
      // Allow UI to update every 5 batches
      if (i % (batchSize * 5) === 0) {
        console.log(`Processed ${i.toLocaleString()} points...`);
      }
    }

    console.log('Point cloud bounds:', {
      x: [minX, maxX],
      y: [minY, maxY],
      z: [minZ, maxZ],
      scale,
      normalizedSize: maxDimension * scale,
      pointCount
    });

    setIsProcessing(false);
    return [positions, colors, { centerX, centerY, centerZ, scale }];
  }, [points, settings.maxPoints, settings.colorMode, settings.visibleClassifications]);

  useEffect(() => {
    if (pointsRef.current && bounds) {
      const distance = 150;
      camera.position.set(distance, distance, distance);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }
  }, [camera, bounds]);

  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  }, [positions, colors]);

  if (isProcessing) {
    return null;
  }

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry {...geometry} />
        <pointsMaterial
          size={settings.pointSize}
          vertexColors
          sizeAttenuation
          transparent
          opacity={settings.opacity}
        />
      </points>
      {settings.showGrid && (
        <DreiGrid
          infiniteGrid
          cellSize={10}
          cellThickness={0.5}
          cellColor="#6f6f6f"
          sectionSize={50}
          sectionThickness={1}
          sectionColor="#9d4b4b"
          fadeDistance={400}
          fadeStrength={1}
          followCamera={false}
        />
      )}
    </>
  );
}

export const LasPointCloud: React.FC<LasPointCloudProps> = ({ points, onLoaded }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<PointCloudSettings>({
    pointSize: 0.05,
    opacity: 1,
    colorMode: 'classification',
    maxPoints: null,
    showGrid: true,
    visibleClassifications: new Set(Array.from({ length: 256 }, (_, i) => i))
  });

  const classificationCounts = points.reduce((acc, point) => {
    acc[point.classification] = (acc[point.classification] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  useEffect(() => {
    setIsLoading(false);
    onLoaded?.();
  }, [points, onLoaded]);

  return (
    <div className="relative w-full h-full">
      <Canvas style={{ background: '#1c1c1c' }}>
        <PerspectiveCamera
          makeDefault
          position={[150, 150, 150]}
          near={0.1}
          far={1000}
          fov={45}
        />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
        />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <PointCloud points={points} settings={settings} />
        {settings.showGrid && (
          <gridHelper args={[500, 50]} position={[0, 0, 0]} />
        )}
      </Canvas>
      <PointCloudControls
        settings={settings}
        onSettingsChange={setSettings}
        totalPoints={points.length}
        classificationCounts={classificationCounts}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="text-white text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
            <p>Loading point cloud...</p>
          </div>
        </div>
      )}
    </div>
  );
}; 