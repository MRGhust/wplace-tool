import type { PixelatorSettings, WplaceColor } from '../types';

// Helper to convert HEX to RGB
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
};

// Pre-process palette for faster lookups
const wplacePaletteRgb = (palette: WplaceColor[]) => palette.map(color => ({
    hex: color.hex,
    rgb: hexToRgb(color.hex)
}));

type RgbColor = [number, number, number];

// Calculate color distance (squared Euclidean distance is faster)
const colorDistanceSq = (c1: RgbColor, c2: RgbColor): number => {
  const rDiff = c1[0] - c2[0];
  const gDiff = c1[1] - c2[1];
  const bDiff = c1[2] - c2[2];
  return rDiff * rDiff + gDiff * gDiff + bDiff * bDiff;
};

// Find the closest color in the palette, returning the full color object
const findClosestWplaceColorRgb = (
  r: number, g: number, b: number,
  palette: { hex: string, rgb: RgbColor }[]
): { hex: string, rgb: RgbColor } => {
  let closestColor = palette[0];
  let minDistance = Infinity;

  for (const color of palette) {
    const distance = colorDistanceSq([r, g, b], color.rgb);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }
  return closestColor;
};

export const pixelate = (
    imageSrc: string, 
    settings: PixelatorSettings,
    wplaceColors: WplaceColor[]
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;

    img.onload = () => {
      const { width, height, dithering } = settings;
      const palette = wplacePaletteRgb(wplaceColors);

      // 1. Create a source canvas with original image dimensions to get raw pixel data
      const sourceCanvas = document.createElement('canvas');
      const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
      if (!sourceCtx) return reject(new Error('Could not get 2D context for source.'));
      sourceCanvas.width = img.width;
      sourceCanvas.height = img.height;
      sourceCtx.drawImage(img, 0, 0);
      const sourceImageData = sourceCtx.getImageData(0, 0, img.width, img.height).data;

      // 2. Create an intermediate buffer of averaged colors for higher quality downsampling
      const averagedRgbData: RgbColor[] = [];
      const tileWidth = img.width / width;
      const tileHeight = img.height / height;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const startX = Math.floor(x * tileWidth);
          const endX = Math.floor((x + 1) * tileWidth);
          const startY = Math.floor(y * tileHeight);
          const endY = Math.floor((y + 1) * tileHeight);

          let r = 0, g = 0, b = 0;
          let pixelCount = 0;

          for (let sy = startY; sy < endY; sy++) {
            for (let sx = startX; sx < endX; sx++) {
              const index = (sy * img.width + sx) * 4;
              // Only consider non-transparent pixels in the average
              if (sourceImageData[index + 3] > 128) {
                r += sourceImageData[index];
                g += sourceImageData[index + 1];
                b += sourceImageData[index + 2];
                pixelCount++;
              }
            }
          }
          
          if (pixelCount > 0) {
            averagedRgbData.push([r / pixelCount, g / pixelCount, b / pixelCount]);
          } else {
            // If region is fully transparent, default to white
            averagedRgbData.push([255, 255, 255]); 
          }
        }
      }

      // 3. Setup output canvas
      const outputCanvas = document.createElement('canvas');
      const outputCtx = outputCanvas.getContext('2d');
      if (!outputCtx) return reject(new Error('Could not get 2D context for output.'));

      outputCanvas.width = width;
      outputCanvas.height = height;

      // 4. Draw the pixelated image onto the upscaled canvas, applying palette mapping and dithering
      if (!dithering) {
        // Simple color mapping for each averaged pixel
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const index = (y * width + x);
            const [r, g, b] = averagedRgbData[index];
            
            const closestColor = findClosestWplaceColorRgb(r, g, b, palette);
            outputCtx.fillStyle = closestColor.hex;
            outputCtx.fillRect(x, y, 1, 1);
          }
        }
      } else {
        // Floyd-Steinberg dithering logic on the averaged pixel data
        const ditherRgbData: RgbColor[] = averagedRgbData.map(c => [...c] as RgbColor);
        const clamp = (num: number) => Math.max(0, Math.min(255, num));
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const index = y * width + x;
            const oldPixel = ditherRgbData[index];
            
            const newPixelInfo = findClosestWplaceColorRgb(oldPixel[0], oldPixel[1], oldPixel[2], palette);
            const newPixelRgb = newPixelInfo.rgb;

            outputCtx.fillStyle = newPixelInfo.hex;
            outputCtx.fillRect(x, y, 1, 1);

            const errR = oldPixel[0] - newPixelRgb[0];
            const errG = oldPixel[1] - newPixelRgb[1];
            const errB = oldPixel[2] - newPixelRgb[2];

            const distribute = (dx: number, dy: number, factor: number) => {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const i = ny * width + nx;
                ditherRgbData[i][0] = clamp(ditherRgbData[i][0] + errR * factor);
                ditherRgbData[i][1] = clamp(ditherRgbData[i][1] + errG * factor);
                ditherRgbData[i][2] = clamp(ditherRgbData[i][2] + errB * factor);
              }
            };
            
            distribute(1, 0, 7 / 16);
            distribute(-1, 1, 3 / 16);
            distribute(0, 1, 5 / 16);
            distribute(1, 1, 1 / 16);
          }
        }
      }

      resolve(outputCanvas.toDataURL());
    };

    img.onerror = () => {
      reject(new Error("Failed to load the image. It might be a network issue or a CORS problem."));
    };
  });
};