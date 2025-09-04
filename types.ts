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
}

export interface WplaceColor {
    hex: string;
    name: string;
}