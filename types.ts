export type DitherAlgorithm = 'none' | 'floyd-steinberg' | 'atkinson' | 'bayer-4x4' | 'bayer-8x8';
export type ColorSpaceMode = 'perceptual' | 'euclidean';
export type CanvasTool = 'pan' | 'inspect' | 'pencil' | 'eyedropper' | 'bucket' | 'eraser';
export type ViewComparisonMode = 'pixel' | 'split' | 'overlay' | 'side-by-side';
export type ExportFormat = 'png' | 'jpeg' | 'webp';

export interface PixelatorSettings {
  width: number;
  height: number;
  previewX: number;
  previewY: number;
  opacity: number;
  showGrid: boolean;
  showMajorGrid: boolean;
  majorGridInterval: number;
  previewSize: number;
  outputResolution: number;
  dithering: boolean;
  ditherAlgorithm: DitherAlgorithm;
  ditherStrength: number; // 0 to 100
  colorSpace: ColorSpaceMode;
  lockAspectRatio: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number; // 0 to 100
  preserveTransparency: boolean;
  backgroundColor: string;
  originX: number; // Wplace starting X coordinate
  originY: number; // Wplace starting Y coordinate
  autoUpdate: boolean;
  zoom: number;
  darkMode: boolean;
}

export interface WplaceColor {
  id: number;
  hex: string;
  name: string;
  category: 'neutral' | 'warm' | 'yellow-green' | 'cyan-blue' | 'purple-pink' | 'earth';
}

export interface ImageHistoryItem {
  id: string;
  name: string;
  thumbnail: string;
  pixelatedImage: string;
  pixelMatrix?: (string | null)[][];
  settings: PixelatorSettings;
  colorUsageSummary: { hex: string; count: number }[];
  timestamp: number;
}

export interface ColorUsage {
  color: WplaceColor;
  count: number;
  percentage: number;
}

export interface InspectedPixel {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  color: WplaceColor | null;
}

export interface SamplePreset {
  id: string;
  name: string;
  subtitle: string;
  width: number;
  height: number;
  generateDataUrl: () => string;
}