// dtm3DRenderer.ts - DTM 3D mesh rendering using Three.js (Fixed Shading)

import * as THREE from 'three';
import CameraControls from 'camera-controls';
import type { ColorRGB, ColorScheme, DTMData, RenderOptions } from './types';

export interface Render3DOptions extends RenderOptions {
  wireframe?: boolean;
  verticalScale?: number;
  meshResolution?: number;
  showWater?: boolean;
  waterLevel?: number;
}

export class DTM3DRenderer {
  private static readonly MAX_MESH_RESOLUTION = 512;
  private static readonly DEFAULT_VERTICAL_SCALE = 0.1;
  private static readonly DEFAULT_WATER_LEVEL = 0.1;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: CameraControls;
  private terrainMesh: THREE.Mesh | null = null;
  private waterMesh: THREE.Mesh | null = null;
  private container: HTMLElement;
  private animationId: number | null = null;
  private clock: THREE.Clock;

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();

    // Install camera-controls
    CameraControls.install({ THREE });

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x87CEEB, 1); // Sky blue background
    
    // Enhanced shadow settings
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
    this.renderer.shadowMap.autoUpdate = true;
    
    // Enable tone mapping for better lighting
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    
    // Enable physically correct lighting
    this.renderer.physicallyCorrectLights = true;

    container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.setupCamera();
    this.setupControls();
    this.startRenderLoop();

    console.log('DTM3DRenderer initialized with camera-controls');
  }

  /**
   * Sets up enhanced lighting with dramatic shadows for the 3D scene
   */
  private setupLighting(): void {
    // Ambient light for overall illumination (reduced to make shadows more dramatic)
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    // Main sun light - creates primary shadows
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2); // Warm sunlight
    sunLight.position.set(100, 150, 50);
    sunLight.castShadow = true;
    
    // Enhanced shadow settings for better quality
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 800;
    sunLight.shadow.camera.left = -200;
    sunLight.shadow.camera.right = 200;
    sunLight.shadow.camera.top = 200;
    sunLight.shadow.camera.bottom = -200;
    sunLight.shadow.bias = -0.0001; // Reduces shadow acne
    sunLight.shadow.normalBias = 0.02; // Additional shadow improvement
    
    this.scene.add(sunLight);

    // Secondary rim light for dramatic effect
    const rimLight = new THREE.DirectionalLight(0xe6f3ff, 0.6); // Cool blue rim light
    rimLight.position.set(-80, 120, -60);
    rimLight.castShadow = true;
    
    // Softer shadows for rim light
    rimLight.shadow.mapSize.width = 2048;
    rimLight.shadow.mapSize.height = 2048;
    rimLight.shadow.camera.near = 0.1;
    rimLight.shadow.camera.far = 600;
    rimLight.shadow.camera.left = -150;
    rimLight.shadow.camera.right = 150;
    rimLight.shadow.camera.top = 150;
    rimLight.shadow.camera.bottom = -150;
    rimLight.shadow.bias = -0.0001;
    rimLight.shadow.normalBias = 0.02;
    
    this.scene.add(rimLight);

    // Fill light from below (subtle) - simulates bounced light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
    fillLight.position.set(0, -50, 0);
    // No shadows for fill light to keep it subtle
    this.scene.add(fillLight);

    // Add hemisphere light for more realistic sky lighting
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x8B4513, 0.3); // Sky blue to brown
    this.scene.add(hemisphereLight);

    console.log('Enhanced lighting setup with dramatic shadows completed');
  }

  /**
   * Sets up the camera position
   */
  private setupCamera(): void {
    this.camera.position.set(50, 50, 50);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Sets up camera-controls for advanced camera interaction
   */
  private setupControls(): void {
    this.controls = new CameraControls(this.camera, this.renderer.domElement);

    // Configure camera controls
    this.controls.dampingFactor = 0.05; // Smooth movement
    this.controls.draggingDampingFactor = 0.25; // Smooth dragging
    this.controls.enableTransition = true; // Enable smooth transitions

    // Set boundaries to prevent camera from going underground
    this.controls.minDistance = 5;
    this.controls.maxDistance = 500;
    this.controls.maxPolarAngle = Math.PI * 0.8; // Prevent going too low

    // Configure mouse buttons
    this.controls.mouseButtons = {
      left: CameraControls.ACTION.ROTATE,
      middle: CameraControls.ACTION.DOLLY,
      right: CameraControls.ACTION.TRUCK, // Panning
      wheel: CameraControls.ACTION.DOLLY,  // Zoom
    };

    // Configure touch gestures
    this.controls.touches = {
      one: CameraControls.ACTION.TOUCH_ROTATE,
      two: CameraControls.ACTION.TOUCH_DOLLY_TRUCK,
      three: CameraControls.ACTION.TOUCH_TRUCK
    };

    console.log('Camera controls configured with smooth damping and boundaries');
  }

  /**
   * Starts the render loop with camera-controls updates
   */
  private startRenderLoop(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);

      // Update camera controls (required for smooth damping)
      const delta = this.clock.getDelta();
      const updated = this.controls.update(delta);

      // Only render if camera moved or first frame
      if (updated || !this.animationId) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    animate();
  }

  /**
   * Renders DTM data as a 3D mesh
   */
  public async render3DMesh(dtmData: DTMData, options: Render3DOptions): Promise<void> {
    const {
      elevationData,
      dimensions,
      minElevation,
      maxElevation
    } = dtmData;

    const {
      colorScheme = 'terrain',
      wireframe = false,
      verticalScale = DTM3DRenderer.DEFAULT_VERTICAL_SCALE,
      meshResolution = Math.min(Math.max(dimensions.width, dimensions.height), DTM3DRenderer.MAX_MESH_RESOLUTION),
      showWater = false,
      waterLevel = DTM3DRenderer.DEFAULT_WATER_LEVEL
    } = options;

    console.log('Starting 3D terrain generation with params:', {
      dimensions,
      minElevation,
      maxElevation,
      verticalScale,
      meshResolution,
      wireframe
    });

    // Clear existing terrain
    this.clearTerrain();

    // Create terrain geometry
    const geometry = this.createTerrainGeometry(
      elevationData,
      dimensions,
      minElevation,
      maxElevation,
      verticalScale,
      meshResolution
    );

    // Create terrain material with vertex colors and enhanced shading for shadows
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      wireframe,
      side: THREE.DoubleSide,
      flatShading: false, // Ensure smooth shading
    });

    // Apply colors to vertices
    this.applyVertexColors(geometry, elevationData, dimensions, minElevation, maxElevation, colorScheme, meshResolution);

    // Create and add terrain mesh
    this.terrainMesh = new THREE.Mesh(geometry, material);
    this.terrainMesh.receiveShadow = true; // Receive shadows from lights
    this.terrainMesh.castShadow = true;    // Cast shadows onto other objects

    // Position the terrain
    this.terrainMesh.rotation.x = -Math.PI / 2; // Rotate to make it horizontal
    this.terrainMesh.position.set(0, 0, 0);

    this.scene.add(this.terrainMesh);

    // Add water plane if requested
    if (showWater) {
      this.addWaterPlane(dimensions, waterLevel * (maxElevation - minElevation) * verticalScale);
    }

    // Adjust camera to view the terrain
    this.adjustCameraForTerrain(dimensions, maxElevation, minElevation, verticalScale);

    console.log(`3D terrain rendered with ${meshResolution} resolution, bounds:`, this.terrainMesh.geometry.boundingBox);
  }

  /**
   * Adjusts camera position to properly view the terrain
   */
  private adjustCameraForTerrain(
    dimensions: { width: number; height: number },
    maxElevation: number,
    minElevation: number,
    verticalScale: number
  ): void {
    const terrainWidth = dimensions.width * 0.1;
    const terrainHeight = dimensions.height * 0.1;
    const terrainMaxHeight = (maxElevation - minElevation) * verticalScale;

    const maxDimension = Math.max(terrainWidth, terrainHeight, terrainMaxHeight);
    const distance = maxDimension * 1.5;

    // Use camera-controls to smoothly move to optimal position
    const targetPosition = new THREE.Vector3(0, terrainMaxHeight * 0.3, 0);
    const cameraPosition = new THREE.Vector3(distance * 0.7, distance * 0.5, distance * 0.7);

    // Set the target (what camera looks at)
    this.controls.setLookAt(
      cameraPosition.x, cameraPosition.y, cameraPosition.z, // Camera position
      targetPosition.x, targetPosition.y, targetPosition.z, // Target position
      true // Enable transition animation
    );

    console.log('Camera positioned with smooth transition to view terrain');
  }

  /**
   * Creates terrain geometry from elevation data with proper normal calculation
   */
  private createTerrainGeometry(
    elevationData: Float32Array,
    dimensions: { width: number; height: number },
    minElevation: number,
    maxElevation: number,
    verticalScale: number,
    meshResolution: number
  ): THREE.PlaneGeometry {
    // Scale down the terrain for better viewing
    const scaleFactor = 0.1;
    const terrainWidth = dimensions.width * scaleFactor;
    const terrainHeight = dimensions.height * scaleFactor;

    // Create geometry with appropriate resolution
    const widthSegments = Math.min(meshResolution, dimensions.width) - 1;
    const heightSegments = Math.floor(widthSegments * dimensions.height / dimensions.width) - 1;

    const geometry = new THREE.PlaneGeometry(
      terrainWidth,
      terrainHeight,
      widthSegments,
      heightSegments
    );

    console.log(`Creating terrain geometry: ${terrainWidth}x${terrainHeight} with ${widthSegments}x${heightSegments} segments`);

    // Modify vertices based on elevation data
    const vertices = geometry.attributes.position;
    const elevRange = maxElevation - minElevation;

    if (elevRange <= 0) {
      console.warn('Invalid elevation range:', elevRange);
      return geometry;
    }

    // Store elevation data for proper normal calculation
    const elevationGrid: number[][] = [];
    for (let y = 0; y <= heightSegments; y++) {
      elevationGrid[y] = [];
      for (let x = 0; x <= widthSegments; x++) {
        const normalizedX = x / widthSegments;
        const normalizedY = y / heightSegments;

        const dataX = Math.floor(normalizedX * (dimensions.width - 1));
        const dataY = Math.floor((1 - normalizedY) * (dimensions.height - 1));

        const clampedX = Math.max(0, Math.min(dimensions.width - 1, dataX));
        const clampedY = Math.max(0, Math.min(dimensions.height - 1, dataY));

        const elevationIndex = clampedY * dimensions.width + clampedX;
        const elevation = elevationData[elevationIndex];

        if (this.isValidElevation(elevation)) {
          const normalizedElevation = (elevation - minElevation) / elevRange;
          elevationGrid[y][x] = normalizedElevation * elevRange * verticalScale;
        } else {
          elevationGrid[y][x] = 0;
        }
      }
    }

    // Apply elevations to vertices
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      const y = vertices.getY(i);

      // Convert geometry coordinates to grid indices
      const normalizedX = (x / terrainWidth) + 0.5;
      const normalizedY = (y / terrainHeight) + 0.5;

      const gridX = Math.round(normalizedX * widthSegments);
      const gridY = Math.round(normalizedY * heightSegments);

      const clampedGridX = Math.max(0, Math.min(widthSegments, gridX));
      const clampedGridY = Math.max(0, Math.min(heightSegments, gridY));

      vertices.setZ(i, elevationGrid[clampedGridY][clampedGridX]);
    }

    vertices.needsUpdate = true;

    // Calculate proper normals using the elevation grid
    this.calculateCustomNormals(geometry, elevationGrid, widthSegments, heightSegments, terrainWidth, terrainHeight);

    geometry.computeBoundingBox();

    console.log('Terrain geometry created with custom normals, bounding box:', geometry.boundingBox);

    return geometry;
  }

  /**
   * Calculate custom normals for better shading consistency
   */
  private calculateCustomNormals(
    geometry: THREE.PlaneGeometry,
    elevationGrid: number[][],
    widthSegments: number,
    heightSegments: number,
    terrainWidth: number,
    terrainHeight: number
  ): void {
    const vertices = geometry.attributes.position;
    const normals = new Float32Array(vertices.count * 3);

    const stepX = terrainWidth / widthSegments;
    const stepY = terrainHeight / heightSegments;

    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      const y = vertices.getY(i);

      // Convert to grid coordinates
      const normalizedX = (x / terrainWidth) + 0.5;
      const normalizedY = (y / terrainHeight) + 0.5;

      const gridX = Math.round(normalizedX * widthSegments);
      const gridY = Math.round(normalizedY * heightSegments);

      // Calculate normal using neighboring heights
      const leftHeight = this.getGridHeight(elevationGrid, gridX - 1, gridY, widthSegments, heightSegments);
      const rightHeight = this.getGridHeight(elevationGrid, gridX + 1, gridY, widthSegments, heightSegments);
      const topHeight = this.getGridHeight(elevationGrid, gridX, gridY - 1, widthSegments, heightSegments);
      const bottomHeight = this.getGridHeight(elevationGrid, gridX, gridY + 1, widthSegments, heightSegments);

      // Calculate tangent vectors
      const tangentX = new THREE.Vector3(stepX * 2, 0, rightHeight - leftHeight);
      const tangentY = new THREE.Vector3(0, stepY * 2, bottomHeight - topHeight);

      // Cross product for normal
      const normal = new THREE.Vector3().crossVectors(tangentX, tangentY).normalize();

      // Transform normal for the rotated plane
      normal.applyAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

      normals[i * 3] = normal.x;
      normals[i * 3 + 1] = normal.y;
      normals[i * 3 + 2] = normal.z;
    }

    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    console.log('Applied custom normals to', vertices.count, 'vertices');
  }

  /**
   * Get height from elevation grid with bounds checking
   */
  private getGridHeight(
    elevationGrid: number[][],
    x: number,
    y: number,
    widthSegments: number,
    heightSegments: number
  ): number {
    const clampedX = Math.max(0, Math.min(widthSegments, x));
    const clampedY = Math.max(0, Math.min(heightSegments, y));
    return elevationGrid[clampedY] ? elevationGrid[clampedY][clampedX] || 0 : 0;
  }

  /**
   * Applies vertex colors based on elevation and color scheme
   */
  private applyVertexColors(
    geometry: THREE.PlaneGeometry,
    elevationData: Float32Array,
    dimensions: { width: number; height: number },
    minElevation: number,
    maxElevation: number,
    colorScheme: ColorScheme,
    meshResolution: number
  ): void {
    const vertices = geometry.attributes.position;
    const colors = new Float32Array(vertices.count * 3);
    const elevRange = maxElevation - minElevation;

    const terrainWidth = dimensions.width * 0.1;
    const terrainHeight = dimensions.height * 0.1;

    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      const y = vertices.getY(i);

      // Convert geometry coordinates to data array indices
      const normalizedX = (x / terrainWidth) + 0.5;
      const normalizedY = (y / terrainHeight) + 0.5;

      const dataX = Math.floor(normalizedX * (dimensions.width - 1));
      // FIX: Flip Y-coordinate to match 2D renderer orientation
      const dataY = Math.floor((1 - normalizedY) * (dimensions.height - 1));

      const clampedX = Math.max(0, Math.min(dimensions.width - 1, dataX));
      const clampedY = Math.max(0, Math.min(dimensions.height - 1, dataY));

      const elevationIndex = clampedY * dimensions.width + clampedX;
      const elevation = elevationData[elevationIndex];

      let color: ColorRGB;
      if (this.isValidElevation(elevation) && elevRange > 0) {
        const normalizedElevation = (elevation - minElevation) / elevRange;
        color = this.getColorForElevation(normalizedElevation, colorScheme);
      } else {
        color = { r: 128, g: 128, b: 128 }; // Gray for invalid data
      }

      colors[i * 3] = color.r / 255;
      colors[i * 3 + 1] = color.g / 255;
      colors[i * 3 + 2] = color.b / 255;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    console.log('Applied vertex colors to', vertices.count, 'vertices');
  }

  /**
   * Adds a water plane at the specified level with proper shadow interaction
   */
  private addWaterPlane(dimensions: { width: number; height: number }, waterHeight: number): void {
    const waterGeometry = new THREE.PlaneGeometry(
      dimensions.width * 0.12,
      dimensions.height * 0.12
    );

    const waterMaterial = new THREE.MeshLambertMaterial({
      color: 0x006994,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });

    this.waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    this.waterMesh.position.y = waterHeight;
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.receiveShadow = true; // Water receives shadows from terrain
    // Water doesn't cast shadows (looks more realistic)
    this.scene.add(this.waterMesh);
  }

  /**
   * Clears existing terrain from the scene
   */
  private clearTerrain(): void {
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      if (Array.isArray(this.terrainMesh.material)) {
        this.terrainMesh.material.forEach(mat => mat.dispose());
      } else {
        this.terrainMesh.material.dispose();
      }
      this.terrainMesh = null;
    }

    if (this.waterMesh) {
      this.scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      if (Array.isArray(this.waterMesh.material)) {
        this.waterMesh.material.forEach(mat => mat.dispose());
      } else {
        this.waterMesh.material.dispose();
      }
      this.waterMesh = null;
    }
  }

  /**
   * Handles window resize
   */
  public handleResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    console.log('3D renderer resized to:', width, 'x', height);
  }

  /**
   * Disposes of all resources
   */
  public dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Dispose camera controls
    if (this.controls) {
      this.controls.dispose();
    }

    this.clearTerrain();
    this.renderer.dispose();

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }

    console.log('3D renderer and camera controls disposed');
  }

  /**
   * Checks if elevation value is valid (reused from 2D renderer)
   */
  private isValidElevation(elevation: number): boolean {
    return elevation !== null &&
      elevation !== undefined &&
      !isNaN(elevation) &&
      elevation > -9999 &&
      elevation < 9999;
  }

  /**
   * Gets color for normalized elevation value (reused from 2D renderer)
   */
  private getColorForElevation(normalized: number, scheme: ColorScheme): ColorRGB {
    normalized = Math.max(0, Math.min(1, normalized));

    switch (scheme) {
      case 'terrain':
        return this.getTerrainColor(normalized);
      case 'elevation':
        return this.getElevationColor(normalized);
      case 'grayscale':
        return this.getGrayscaleColor(normalized);
      case 'rainbow':
        return this.getRainbowColor(normalized);
      default:
        return { r: 128, g: 128, b: 128 };
    }
  }

  // Color scheme methods (reused from 2D renderer)
  private getTerrainColor(normalized: number): ColorRGB {
    if (normalized < 0.3) {
      const t = normalized / 0.3;
      return {
        r: Math.floor(0 * (1 - t) + 34 * t),
        g: Math.floor(100 * (1 - t) + 139 * t),
        b: Math.floor(200 * (1 - t) + 34 * t)
      };
    } else if (normalized < 0.7) {
      const t = (normalized - 0.3) / 0.4;
      return {
        r: Math.floor(34 * (1 - t) + 139 * t),
        g: Math.floor(139 * (1 - t) + 69 * t),
        b: Math.floor(34 * (1 - t) + 19 * t)
      };
    } else {
      const t = (normalized - 0.7) / 0.3;
      return {
        r: Math.floor(139 * (1 - t) + 255 * t),
        g: Math.floor(69 * (1 - t) + 255 * t),
        b: Math.floor(19 * (1 - t) + 255 * t)
      };
    }
  }

  private getElevationColor(normalized: number): ColorRGB {
    return {
      r: Math.floor(0 * (1 - normalized) + 255 * normalized),
      g: Math.floor(66 * (1 - normalized) + 255 * normalized),
      b: Math.floor(146 * (1 - normalized) + 0 * normalized)
    };
  }

  private getGrayscaleColor(normalized: number): ColorRGB {
    const gray = Math.floor(normalized * 255);
    return { r: gray, g: gray, b: gray };
  }

  private getRainbowColor(normalized: number): ColorRGB {
    const hue = (1 - normalized) * 240;
    return this.hslToRgb(hue / 360, 1, 0.5);
  }

  private hslToRgb(h: number, s: number, l: number): ColorRGB {
    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }
}