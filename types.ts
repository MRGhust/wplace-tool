export interface PixelatorSettings {
  width: number;
  height: number;
  previewX: number;
  previewY: number;
  opacity: number;
  showGrid: boolean;
  previewSize: number;
  outputResolution: number;
  dithering: boolean;
  lockAspectRatio: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  zoom: number;
  darkMode: boolean;
}

export interface WplaceColor {
    hex: string;
    name: string;
}

export interface ImageHistoryItem {
  id: string;
  sourceImage: string;
  pixelatedImage: string;
  settings: PixelatorSettings;
  timestamp: number;
}

export interface ColorUsage {
  color: WplaceColor;
  count: number;
  percentage: number;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ExportFormat = 'png' | 'jpeg' | 'webp';