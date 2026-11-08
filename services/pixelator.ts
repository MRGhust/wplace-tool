import type { PixelatorSettings, WplaceColor, ColorSpaceMode } from '../types';

export type RgbColor = [number, number, number];

// Helper to convert HEX to RGB
export const hexToRgb = (hex: string): RgbColor => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
};

const wplacePaletteRgb = (palette: WplaceColor[]) =>
  palette.map((color) => ({
    hex: color.hex,
    rgb: hexToRgb(color.hex),
  }));

// Euclidean vs Perceptual (Redmean) color distance
const colorDistance = (c1: RgbColor, c2: RgbColor, mode: ColorSpaceMode): number => {
  const rDiff = c1[0] - c2[0];
  const gDiff = c1[1] - c2[1];
  const bDiff = c1[2] - c2[2];

  if (mode === 'euclidean') {
    return rDiff * rDiff + gDiff * gDiff + bDiff * bDiff;
  }

  // Redmean perceptual color distance formula (human eye sensitivity weighted)
  const rMean = (c1[0] + c2[0]) * 0.5;
  const rWeight = 2 + rMean / 256;
  const gWeight = 4.0;
  const bWeight = 2 + (255 - rMean) / 256;
  return rWeight * rDiff * rDiff + gWeight * gDiff * gDiff + bWeight * bDiff * bDiff;
};

const findClosestWplaceColorRgb = (
  r: number,
  g: number,
  b: number,
  palette: { hex: string; rgb: RgbColor }[],
  mode: ColorSpaceMode
): { hex: string; rgb: RgbColor } => {
  let closestColor = palette[0];
  let minDistance = Infinity;

  for (const color of palette) {
    const distance = colorDistance([r, g, b], color.rgb, mode);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }
  return closestColor;
};

// Apply accurate brightness, contrast, and saturation adjustments
const applyColorAdjustments = (
  r: number,
  g: number,
  b: number,
  brightness: number,
  contrast: number,
  saturation: number
): RgbColor => {
  // 1. Brightness (-100 to 100)
  const bOffset = (brightness / 100) * 255;
  r += bOffset;
  g += bOffset;
  b += bOffset;

  // 2. Standard Contrast formula (-100 to 100)
  const cVal = Math.max(-100, Math.min(100, contrast)) * 2.55;
  const contrastFactor = (259 * (cVal + 255)) / (255 * (259 - cVal));
  r = (r - 128) * contrastFactor + 128;
  g = (g - 128) * contrastFactor + 128;
  b = (b - 128) * contrastFactor + 128;

  // 3. Saturation (-100 to 100)
  const satFactor = (saturation + 100) / 100;
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  r = luma + (r - luma) * satFactor;
  g = luma + (g - luma) * satFactor;
  b = luma + (b - luma) * satFactor;

  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
  ];
};

// Bayer matrices for ordered dithering
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

export interface PixelationResult {
  dataUrl: string;
  pixelMatrix: (string | null)[][];
  colorUsage: Map<string, number>;
  totalPixels: number;
}

export const renderMatrixToDataUrl = (
  matrix: (string | null)[][],
  highlightHex?: string | null,
  completedHexes?: Set<string>
): string => {
  const height = matrix.length;
  const width = height > 0 ? matrix[0].length : 1;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const hex = matrix[y][x];
      if (!hex) continue;

      if (highlightHex) {
        if (hex.toUpperCase() === highlightHex.toUpperCase()) {
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = hex;
        } else {
          ctx.globalAlpha = 0.14;
          ctx.fillStyle = hex;
        }
      } else if (completedHexes && completedHexes.has(hex)) {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = hex;
      } else {
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = hex;
      }

      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.globalAlpha = 1.0;
  return canvas.toDataURL('image/png');
};

export const calculateMatrixColorUsage = (
  matrix: (string | null)[][]
): { colorUsage: Map<string, number>; totalPixels: number } => {
  const colorUsage = new Map<string, number>();
  let totalPixels = 0;
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      const hex = matrix[y][x];
      if (hex) {
        colorUsage.set(hex, (colorUsage.get(hex) || 0) + 1);
        totalPixels++;
      }
    }
  }
  return { colorUsage, totalPixels: Math.max(1, totalPixels) };
};

export const flipMatrixHorizontal = (matrix: (string | null)[][]): (string | null)[][] =>
  matrix.map((row) => [...row].reverse());

export const flipMatrixVertical = (matrix: (string | null)[][]): (string | null)[][] =>
  [...matrix].reverse().map((row) => [...row]);

export const rotateMatrix90CW = (matrix: (string | null)[][]): (string | null)[][] => {
  const h = matrix.length;
  const w = h > 0 ? matrix[0].length : 0;
  if (h === 0 || w === 0) return matrix;
  const rotated: (string | null)[][] = Array.from({ length: w }, () => Array(h).fill(null));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      rotated[x][h - 1 - y] = matrix[y][x];
    }
  }
  return rotated;
};

export const replaceMatrixColor = (
  matrix: (string | null)[][],
  fromHex: string,
  toHex: string | null
): (string | null)[][] => {
  const target = fromHex.toUpperCase();
  return matrix.map((row) =>
    row.map((cell) => (cell && cell.toUpperCase() === target ? toHex : cell))
  );
};

export const createThumbnailDataUrl = (imageSrc: string, maxDim = 96): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      } else {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = imageSrc;
  });
};

export const pixelate = (
  imageSrc: string,
  settings: PixelatorSettings,
  activeColors: WplaceColor[]
): Promise<PixelationResult> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSrc;

    img.onload = () => {
      const {
        width,
        height,
        dithering,
        ditherAlgorithm,
        ditherStrength,
        colorSpace,
        brightness,
        contrast,
        saturation,
        sharpness,
        preserveTransparency,
        backgroundColor,
      } = settings;

      const safeColors = activeColors.length > 0 ? activeColors : [{ id: 1, name: 'Pure White', hex: '#FFFFFF', category: 'neutral' as const }];
      const palette = wplacePaletteRgb(safeColors);
      const bgRgb = hexToRgb(backgroundColor || '#FFFFFF');

      // 1. Source canvas
      const sourceCanvas = document.createElement('canvas');
      const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
      if (!sourceCtx) return reject(new Error('Could not get 2D context for source.'));
      sourceCanvas.width = img.width;
      sourceCanvas.height = img.height;
      sourceCtx.drawImage(img, 0, 0);
      const sourceImageData = sourceCtx.getImageData(0, 0, img.width, img.height).data;

      // 2. Downsample into averaged RGB buffer + alpha mask
      const averagedRgbData: RgbColor[] = [];
      const transparentMask: boolean[] = [];
      const tileWidth = img.width / width;
      const tileHeight = img.height / height;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const startX = Math.floor(x * tileWidth);
          const endX = Math.max(startX + 1, Math.floor((x + 1) * tileWidth));
          const startY = Math.floor(y * tileHeight);
          const endY = Math.max(startY + 1, Math.floor((y + 1) * tileHeight));

          let r = 0,
            g = 0,
            b = 0;
          let pixelCount = 0;

          for (let sy = startY; sy < endY && sy < img.height; sy++) {
            for (let sx = startX; sx < endX && sx < img.width; sx++) {
              const index = (sy * img.width + sx) * 4;
              const alpha = sourceImageData[index + 3];
              if (alpha > 120) {
                r += sourceImageData[index];
                g += sourceImageData[index + 1];
                b += sourceImageData[index + 2];
                pixelCount++;
              }
            }
          }

          if (pixelCount > 0) {
            const adjusted = applyColorAdjustments(
              r / pixelCount,
              g / pixelCount,
              b / pixelCount,
              brightness,
              contrast,
              saturation
            );
            averagedRgbData.push(adjusted);
            transparentMask.push(false);
          } else {
            averagedRgbData.push([...bgRgb] as RgbColor);
            transparentMask.push(preserveTransparency);
          }
        }
      }

      // 2.5 Optional Sharpness / Edge Enhancement pass on downsampled grid
      const workingRgbData: RgbColor[] = averagedRgbData.map((c) => [...c] as RgbColor);
      if (sharpness > 0) {
        const amount = (sharpness / 100) * 0.85;
        const clamp = (v: number) => Math.max(0, Math.min(255, v));
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (transparentMask[idx]) continue;
            const center = averagedRgbData[idx];
            const top = averagedRgbData[(y - 1) * width + x];
            const bottom = averagedRgbData[(y + 1) * width + x];
            const left = averagedRgbData[y * width + (x - 1)];
            const right = averagedRgbData[y * width + (x + 1)];

            for (let c = 0; c < 3; c++) {
              const laplacian = 4 * center[c] - top[c] - bottom[c] - left[c] - right[c];
              workingRgbData[idx][c] = clamp(center[c] + laplacian * amount);
            }
          }
        }
      }

      // 3. Setup output canvas & matrix
      const outputCanvas = document.createElement('canvas');
      const outputCtx = outputCanvas.getContext('2d');
      if (!outputCtx) return reject(new Error('Could not get 2D context for output.'));

      outputCanvas.width = width;
      outputCanvas.height = height;

      const colorUsage = new Map<string, number>();
      let activeTotalPixels = 0;
      const pixelMatrix: (string | null)[][] = Array.from({ length: height }, () =>
        Array(width).fill(null)
      );

      const effectiveAlgo = dithering ? ditherAlgorithm : 'none';
      const strength = Math.max(0, Math.min(100, ditherStrength)) / 100;
      const clamp = (num: number) => Math.max(0, Math.min(255, num));

      // 4. Quantization & Dithering
      if (effectiveAlgo === 'none' || strength === 0) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const index = y * width + x;
            if (transparentMask[index]) {
              pixelMatrix[y][x] = null;
              continue;
            }
            const [r, g, b] = workingRgbData[index];
            const closestColor = findClosestWplaceColorRgb(r, g, b, palette, colorSpace);
            outputCtx.fillStyle = closestColor.hex;
            outputCtx.fillRect(x, y, 1, 1);
            pixelMatrix[y][x] = closestColor.hex;
            colorUsage.set(closestColor.hex, (colorUsage.get(closestColor.hex) || 0) + 1);
            activeTotalPixels++;
          }
        }
      } else if (effectiveAlgo === 'bayer-4x4' || effectiveAlgo === 'bayer-8x8') {
        const is8x8 = effectiveAlgo === 'bayer-8x8';
        const matrixSize = is8x8 ? 8 : 4;
        const bayerMax = is8x8 ? 64 : 16;
        const spread = 48 * strength;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const index = y * width + x;
            if (transparentMask[index]) {
              pixelMatrix[y][x] = null;
              continue;
            }
            const [r, g, b] = workingRgbData[index];
            const bayerVal = is8x8
              ? BAYER_8X8[y % matrixSize][x % matrixSize]
              : BAYER_4X4[y % matrixSize][x % matrixSize];
            const threshold = (bayerVal / bayerMax - 0.5) * spread;

            const closestColor = findClosestWplaceColorRgb(
              clamp(r + threshold),
              clamp(g + threshold),
              clamp(b + threshold),
              palette,
              colorSpace
            );
            outputCtx.fillStyle = closestColor.hex;
            outputCtx.fillRect(x, y, 1, 1);
            pixelMatrix[y][x] = closestColor.hex;
            colorUsage.set(closestColor.hex, (colorUsage.get(closestColor.hex) || 0) + 1);
            activeTotalPixels++;
          }
        }
      } else {
        // Error diffusion: Floyd-Steinberg or Atkinson
        const ditherRgbData: RgbColor[] = workingRgbData.map((c) => [...c] as RgbColor);
        const isAtkinson = effectiveAlgo === 'atkinson';

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const index = y * width + x;
            if (transparentMask[index]) {
              pixelMatrix[y][x] = null;
              continue;
            }
            const oldPixel = ditherRgbData[index];
            const newPixelInfo = findClosestWplaceColorRgb(
              oldPixel[0],
              oldPixel[1],
              oldPixel[2],
              palette,
              colorSpace
            );
            const newPixelRgb = newPixelInfo.rgb;

            outputCtx.fillStyle = newPixelInfo.hex;
            outputCtx.fillRect(x, y, 1, 1);
            pixelMatrix[y][x] = newPixelInfo.hex;

            colorUsage.set(newPixelInfo.hex, (colorUsage.get(newPixelInfo.hex) || 0) + 1);
            activeTotalPixels++;

            const errR = (oldPixel[0] - newPixelRgb[0]) * strength;
            const errG = (oldPixel[1] - newPixelRgb[1]) * strength;
            const errB = (oldPixel[2] - newPixelRgb[2]) * strength;

            const distribute = (dx: number, dy: number, factor: number) => {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const i = ny * width + nx;
                if (!transparentMask[i]) {
                  ditherRgbData[i][0] = clamp(ditherRgbData[i][0] + errR * factor);
                  ditherRgbData[i][1] = clamp(ditherRgbData[i][1] + errG * factor);
                  ditherRgbData[i][2] = clamp(ditherRgbData[i][2] + errB * factor);
                }
              }
            };

            if (isAtkinson) {
              // Atkinson distributes 6/8 of error for higher local contrast
              const f = 1 / 8;
              distribute(1, 0, f);
              distribute(2, 0, f);
              distribute(-1, 1, f);
              distribute(0, 1, f);
              distribute(1, 1, f);
              distribute(0, 2, f);
            } else {
              // Floyd-Steinberg
              distribute(1, 0, 7 / 16);
              distribute(-1, 1, 3 / 16);
              distribute(0, 1, 5 / 16);
              distribute(1, 1, 1 / 16);
            }
          }
        }
      }

      resolve({
        dataUrl: outputCanvas.toDataURL('image/png'),
        pixelMatrix,
        colorUsage,
        totalPixels: Math.max(1, activeTotalPixels),
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load the image. Please verify the file is a valid image.'));
    };
  });
};