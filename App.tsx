import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  pixelate,
  renderMatrixToDataUrl,
  calculateMatrixColorUsage,
  createThumbnailDataUrl,
  flipMatrixHorizontal,
  flipMatrixVertical,
  rotateMatrix90CW,
  replaceMatrixColor,
  hexToRgb,
} from './services/pixelator';
import type {
  PixelatorSettings,
  ImageHistoryItem,
  ColorUsage,
  ExportFormat,
  WplaceColor,
  CanvasTool,
  SymmetryMode,
  ViewComparisonMode,
  InspectedPixel,
  DitherAlgorithm,
  ColorSpaceMode,
} from './types';
import { WPLACE_COLORS, PALETTE_PRESETS, SAMPLE_PRESETS } from './constants';
import { WplacePalette } from './components/WplacePalette';

const DEFAULT_SETTINGS: PixelatorSettings = {
  width: 64,
  height: 64,
  previewX: 0,
  previewY: 0,
  opacity: 1,
  showGrid: true,
  showMajorGrid: true,
  showColorIds: false,
  majorGridInterval: 8,
  previewSize: 512,
  outputResolution: 12,
  dithering: true,
  ditherAlgorithm: 'floyd-steinberg',
  ditherStrength: 75,
  colorSpace: 'perceptual',
  lockAspectRatio: true,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 15,
  preserveTransparency: true,
  backgroundColor: '#FFFFFF',
  originX: 1000,
  originY: 1000,
  autoUpdate: true,
  zoom: 1,
  darkMode: true,
};

// Bresenham's line algorithm for pixel-perfect lines
const getLinePixels = (x0: number, y0: number, x1: number, y1: number): [number, number][] => {
  const pts: [number, number][] = [];
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    pts.push([cx, cy]);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
  return pts;
};

// Rectangle outline pixel coordinates
const getRectPixels = (x0: number, y0: number, x1: number, y1: number): [number, number][] => {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const pts: [number, number][] = [];
  for (let x = minX; x <= maxX; x++) {
    pts.push([x, minY]);
    if (maxY !== minY) pts.push([x, maxY]);
  }
  for (let y = minY + 1; y < maxY; y++) {
    pts.push([minX, y]);
    if (maxX !== minX) pts.push([maxX, y]);
  }
  return pts;
};

const isColorDark = (hex: string): boolean => {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
};

const App: React.FC = () => {
  // Core image & matrix state
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceImageName, setSourceImageName] = useState<string>('Alpine Sunset');
  const [sourceImageAspectRatio, setSourceImageAspectRatio] = useState<number | null>(1);
  const [basePixelMatrix, setBasePixelMatrix] = useState<(string | null)[][]>([]);
  const [pixelatedImage, setPixelatedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Undo / Redo stacks for manual pixel edits
  const [undoStack, setUndoStack] = useState<(string | null)[][][]>([]);
  const [redoStack, setRedoStack] = useState<(string | null)[][][]>([]);

  // Palette & Wplace Guide state
  const [activeBrushColor, setActiveBrushColor] = useState<WplaceColor>(WPLACE_COLORS[25]); // Crimson Red
  const [disabledHexes, setDisabledHexes] = useState<Set<string>>(new Set());
  const [highlightedHex, setHighlightedHex] = useState<string | null>(null);
  const [completedHexes, setCompletedHexes] = useState<Set<string>>(new Set());
  const [paletteMode, setPaletteMode] = useState<'brush' | 'filter'>('brush');
  const [colorSearch, setColorSearch] = useState('');
  const [swapSourceHex, setSwapSourceHex] = useState<string | null>(null);

  // Workspace UI & Navigation state
  const [activeNavTab, setActiveNavTab] = useState<'studio' | 'palette' | 'blueprint' | 'history'>('studio');
  const [activeTool, setActiveTool] = useState<CanvasTool>('inspect');
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>('none');
  const [comparisonMode, setComparisonMode] = useState<ViewComparisonMode>('pixel');
  const [splitPosition, setSplitPosition] = useState<number>(50);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportWithGrid, setExportWithGrid] = useState<boolean>(false);
  const [exportWithIds, setExportWithIds] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [history, setHistory] = useState<ImageHistoryItem[]>([]);

  // Blueprint Chunk Inspector state (8x8 chunk coordinates)
  const [selectedChunk, setSelectedChunk] = useState<{ cx: number; cy: number }>({ cx: 0, cy: 0 });

  // Canvas Pan, Zoom, Shape Drag & Inspection state
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isPainting, setIsPainting] = useState<boolean>(false);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const panStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number }>({
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0,
  });
  const [hoveredPixel, setHoveredPixel] = useState<InspectedPixel | null>(null);
  const [pinnedPixel, setPinnedPixel] = useState<InspectedPixel | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const artWrapperRef = useRef<HTMLDivElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);

  const [settings, setSettings] = useState<PixelatorSettings>(DEFAULT_SETTINGS);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2600);
  }, []);

  // Color lookup map by uppercase HEX
  const colorByHex = useMemo(() => {
    const map = new Map<string, WplaceColor>();
    WPLACE_COLORS.forEach((c) => map.set(c.hex.toUpperCase(), c));
    return map;
  }, []);

  // Load saved history and theme on mount, plus load default sample
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('wplacePixelHistory_v2');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }

    try {
      const savedDarkMode = localStorage.getItem('wplaceDarkMode');
      if (savedDarkMode !== null) {
        setDarkMode(JSON.parse(savedDarkMode));
      }
    } catch (e) {
      console.error('Failed to load dark mode:', e);
    }

    const initialPreset = SAMPLE_PRESETS[0];
    if (initialPreset) {
      const url = initialPreset.generateDataUrl();
      setSourceImage(url);
      setSourceImageName(initialPreset.name);
      setSourceImageAspectRatio(1);
    }
  }, []);

  // Save history safely
  useEffect(() => {
    try {
      localStorage.setItem('wplacePixelHistory_v2', JSON.stringify(history.slice(0, 12)));
    } catch (e) {
      console.warn('History storage quota reached:', e);
    }
  }, [history]);

  // Apply dark mode class to <html>
  useEffect(() => {
    try {
      localStorage.setItem('wplaceDarkMode', JSON.stringify(darkMode));
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.error('Failed to save dark mode:', e);
    }
  }, [darkMode]);

  const activePaletteColors = useMemo(() => {
    const filtered = WPLACE_COLORS.filter((c) => !disabledHexes.has(c.hex));
    return filtered.length > 0 ? filtered : [WPLACE_COLORS[0]];
  }, [disabledHexes]);

  const colorUsage = useMemo<ColorUsage[]>(() => {
    if (!basePixelMatrix.length) return [];
    const { colorUsage: usageMap, totalPixels } = calculateMatrixColorUsage(basePixelMatrix);
    const list: ColorUsage[] = [];
    usageMap.forEach((count, hex) => {
      const color = colorByHex.get(hex.toUpperCase());
      if (color) {
        list.push({
          color,
          count,
          percentage: (count / totalPixels) * 100,
        });
      }
    });
    list.sort((a, b) => b.count - a.count);
    return list;
  }, [basePixelMatrix, colorByHex]);

  useEffect(() => {
    if (!basePixelMatrix.length) return;
    const url = renderMatrixToDataUrl(basePixelMatrix, highlightedHex, completedHexes);
    setPixelatedImage(url);
  }, [basePixelMatrix, highlightedHex, completedHexes]);

  const runPixelation = useCallback(
    async (saveToHistory = false) => {
      if (!sourceImage) {
        setError('Please upload an image or choose a preset first.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await pixelate(sourceImage, settings, activePaletteColors);
        setBasePixelMatrix(result.pixelMatrix);
        setUndoStack([]);
        setRedoStack([]);

        if (saveToHistory) {
          const thumb = await createThumbnailDataUrl(sourceImage, 96);
          const summary: { hex: string; count: number }[] = [];
          result.colorUsage.forEach((count, hex) => summary.push({ hex, count }));
          summary.sort((a, b) => b.count - a.count);

          const historyItem: ImageHistoryItem = {
            id: Date.now().toString(),
            name: sourceImageName || 'Untitled Artwork',
            thumbnail: thumb || result.dataUrl,
            pixelatedImage: result.dataUrl,
            pixelMatrix: result.pixelMatrix,
            settings: { ...settings },
            colorUsageSummary: summary.slice(0, 8),
            timestamp: Date.now(),
          };
          setHistory((prev) => [historyItem, ...prev].slice(0, 12));
          showToast('Saved snapshot to history');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred during pixelation.');
      } finally {
        setIsLoading(false);
      }
    },
    [sourceImage, sourceImageName, settings, activePaletteColors, showToast]
  );

  // Auto-update debounce
  useEffect(() => {
    if (!sourceImage || !settings.autoUpdate) return;
    const timer = setTimeout(() => {
      runPixelation(false);
    }, 140);
    return () => clearTimeout(timer);
  }, [
    sourceImage,
    settings.width,
    settings.height,
    settings.dithering,
    settings.ditherAlgorithm,
    settings.ditherStrength,
    settings.colorSpace,
    settings.brightness,
    settings.contrast,
    settings.saturation,
    settings.sharpness,
    settings.preserveTransparency,
    settings.backgroundColor,
    settings.autoUpdate,
    activePaletteColors,
    runPixelation,
  ]);

  const handleImageUpload = useCallback((file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPG, GIF, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        setError('Failed to read the image file.');
        return;
      }

      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      setSourceImageName(cleanName);
      setSourceImage(result);
      setError(null);
      setHighlightedHex(null);
      setCompletedHexes(new Set());
      setSelectedChunk({ cx: 0, cy: 0 });

      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        setSourceImageAspectRatio(aspectRatio);
        setSettings((prev) => ({
          ...prev,
          height: prev.lockAspectRatio
            ? Math.max(1, Math.min(320, Math.round(prev.width / aspectRatio)))
            : prev.height,
        }));
      };
      img.onerror = () => setError('Failed to decode the uploaded image.');
      img.src = result;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleLoadSamplePreset = useCallback(
    (presetId: string) => {
      const preset = SAMPLE_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const dataUrl = preset.generateDataUrl();
      setSourceImageName(preset.name);
      setSourceImage(dataUrl);
      setSourceImageAspectRatio(preset.width / preset.height);
      setHighlightedHex(null);
      setCompletedHexes(new Set());
      setSelectedChunk({ cx: 0, cy: 0 });
      setSettings((prev) => ({
        ...prev,
        width: preset.width,
        height: preset.height,
      }));
      showToast(`Loaded "${preset.name}" template`);
    },
    [showToast]
  );

  const handleSettingsChange = useCallback(
    <K extends keyof PixelatorSettings>(key: K, value: PixelatorSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        if (next.lockAspectRatio && sourceImageAspectRatio && typeof value === 'number') {
          if (key === 'width') {
            next.height = Math.max(1, Math.min(320, Math.round(value / sourceImageAspectRatio)));
          } else if (key === 'height') {
            next.width = Math.max(1, Math.min(320, Math.round(value * sourceImageAspectRatio)));
          }
        }
        if (key === 'lockAspectRatio' && value === true && sourceImageAspectRatio) {
          next.height = Math.max(1, Math.min(320, Math.round(next.width / sourceImageAspectRatio)));
        }
        return next;
      });
    },
    [sourceImageAspectRatio]
  );

  // Matrix Transformations (Flip H, Flip V, Rotate 90, Color Swap)
  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-29), basePixelMatrix.map((r) => [...r])]);
    setRedoStack([]);
  }, [basePixelMatrix]);

  const handleFlipHorizontal = useCallback(() => {
    if (!basePixelMatrix.length) return;
    pushUndoSnapshot();
    setBasePixelMatrix((prev) => flipMatrixHorizontal(prev));
    showToast('Flipped horizontally');
  }, [basePixelMatrix.length, pushUndoSnapshot, showToast]);

  const handleFlipVertical = useCallback(() => {
    if (!basePixelMatrix.length) return;
    pushUndoSnapshot();
    setBasePixelMatrix((prev) => flipMatrixVertical(prev));
    showToast('Flipped vertically');
  }, [basePixelMatrix.length, pushUndoSnapshot, showToast]);

  const handleRotate90 = useCallback(() => {
    if (!basePixelMatrix.length) return;
    pushUndoSnapshot();
    setBasePixelMatrix((prev) => rotateMatrix90CW(prev));
    showToast('Rotated 90° clockwise');
  }, [basePixelMatrix.length, pushUndoSnapshot, showToast]);

  const handleReplaceColorInMatrix = useCallback(
    (fromHex: string, toColor: WplaceColor) => {
      if (!basePixelMatrix.length || fromHex.toUpperCase() === toColor.hex.toUpperCase()) return;
      pushUndoSnapshot();
      setBasePixelMatrix((prev) => replaceMatrixColor(prev, fromHex, toColor.hex));
      setSwapSourceHex(null);
      showToast(`Replaced ${fromHex} with #${toColor.id} ${toColor.name}`);
    },
    [basePixelMatrix.length, pushUndoSnapshot, showToast]
  );

  // Dimensions & Grid Rendering
  const actualMatrixHeight = basePixelMatrix.length || settings.height;
  const actualMatrixWidth = (basePixelMatrix[0] && basePixelMatrix[0].length) || settings.width;
  const displayWidth = settings.previewSize * settings.zoom;
  const displayHeight = displayWidth * (actualMatrixHeight / Math.max(1, actualMatrixWidth));

  // Helper to expand points with active Symmetry Mode
  const expandWithSymmetry = useCallback(
    (pts: [number, number][]): [number, number][] => {
      if (symmetryMode === 'none') return pts;
      const result: [number, number][] = [];
      for (const [x, y] of pts) {
        result.push([x, y]);
        const mx = actualMatrixWidth - 1 - x;
        const my = actualMatrixHeight - 1 - y;
        if (symmetryMode === 'horizontal' || symmetryMode === 'quad') {
          result.push([mx, y]);
        }
        if (symmetryMode === 'vertical' || symmetryMode === 'quad') {
          result.push([x, my]);
        }
        if (symmetryMode === 'quad') {
          result.push([mx, my]);
        }
      }
      return result;
    },
    [symmetryMode, actualMatrixWidth, actualMatrixHeight]
  );

  // Draw crisp pixel grid, major chunk grid, symmetry axes, shape preview, and Paint-by-Numbers IDs
  useEffect(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const cellW = displayWidth / actualMatrixWidth;
    const cellH = displayHeight / actualMatrixHeight;

    // 1. Standard 1px cell grid
    if (settings.showGrid && cellW >= 4) {
      ctx.beginPath();
      ctx.strokeStyle = darkMode ? 'rgba(255, 255, 255, 0.16)' : 'rgba(15, 23, 42, 0.16)';
      ctx.lineWidth = 1;

      for (let x = 1; x < actualMatrixWidth; x++) {
        const px = Math.floor(x * cellW) + 0.5;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, displayHeight);
      }
      for (let y = 1; y < actualMatrixHeight; y++) {
        const py = Math.floor(y * cellH) + 0.5;
        ctx.moveTo(0, py);
        ctx.lineTo(displayWidth, py);
      }
      ctx.stroke();
    }

    // 2. Paint-by-Numbers Color ID Overlay (when toggled ON and cells >= 11px)
    if (settings.showColorIds && cellW >= 11 && basePixelMatrix.length) {
      const fontSize = Math.max(8, Math.min(14, Math.floor(cellW * 0.44)));
      ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let y = 0; y < actualMatrixHeight; y++) {
        for (let x = 0; x < actualMatrixWidth; x++) {
          const hex = basePixelMatrix[y]?.[x];
          if (!hex) continue;
          if (highlightedHex && hex.toUpperCase() !== highlightedHex.toUpperCase()) continue;
          const color = colorByHex.get(hex.toUpperCase());
          if (!color) continue;
          ctx.fillStyle = isColorDark(hex) ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.9)';
          ctx.fillText(String(color.id), (x + 0.5) * cellW, (y + 0.5) * cellH);
        }
      }
    }

    // 3. Major chunk grid (e.g. 8x8 Wplace chunks)
    if (settings.showMajorGrid && settings.majorGridInterval > 1) {
      const step = settings.majorGridInterval;
      ctx.beginPath();
      ctx.strokeStyle = darkMode ? 'rgba(99, 102, 241, 0.55)' : 'rgba(79, 70, 229, 0.55)';
      ctx.lineWidth = 1.25;

      for (let x = step; x < actualMatrixWidth; x += step) {
        const px = Math.floor(x * cellW) + 0.5;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, displayHeight);
      }
      for (let y = step; y < actualMatrixHeight; y += step) {
        const py = Math.floor(y * cellH) + 0.5;
        ctx.moveTo(0, py);
        ctx.lineTo(displayWidth, py);
      }
      ctx.stroke();
    }

    // 4. Symmetry Axis Guides
    if (symmetryMode !== 'none') {
      ctx.save();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      if (symmetryMode === 'horizontal' || symmetryMode === 'quad') {
        const midX = Math.floor(displayWidth / 2) + 0.5;
        ctx.moveTo(midX, 0);
        ctx.lineTo(midX, displayHeight);
      }
      if (symmetryMode === 'vertical' || symmetryMode === 'quad') {
        const midY = Math.floor(displayHeight / 2) + 0.5;
        ctx.moveTo(0, midY);
        ctx.lineTo(displayWidth, midY);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. Live Line / Rect Shape Drag Preview
    if (shapeStart && hoveredPixel && (activeTool === 'line' || activeTool === 'rect')) {
      const rawPts =
        activeTool === 'line'
          ? getLinePixels(shapeStart.x, shapeStart.y, hoveredPixel.x, hoveredPixel.y)
          : getRectPixels(shapeStart.x, shapeStart.y, hoveredPixel.x, hoveredPixel.y);
      const previewPts = expandWithSymmetry(rawPts);
      ctx.fillStyle = activeBrushColor.hex;
      ctx.globalAlpha = 0.78;
      for (const [px, py] of previewPts) {
        if (px >= 0 && px < actualMatrixWidth && py >= 0 && py < actualMatrixHeight) {
          ctx.fillRect(px * cellW, py * cellH, Math.ceil(cellW), Math.ceil(cellH));
        }
      }
      ctx.globalAlpha = 1.0;
    }

    // 6. Highlight hovered or pinned pixel cell
    const activeTarget = hoveredPixel || pinnedPixel;
    if (activeTarget) {
      const rx = activeTarget.x * cellW;
      const ry = activeTarget.y * cellH;
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 1, ry + 1, Math.max(2, cellW - 2), Math.max(2, cellH - 2));
    }
  }, [
    displayWidth,
    displayHeight,
    actualMatrixWidth,
    actualMatrixHeight,
    settings.showGrid,
    settings.showMajorGrid,
    settings.showColorIds,
    settings.majorGridInterval,
    darkMode,
    hoveredPixel,
    pinnedPixel,
    basePixelMatrix,
    highlightedHex,
    colorByHex,
    symmetryMode,
    shapeStart,
    activeTool,
    activeBrushColor.hex,
    expandWithSymmetry,
  ]);

  // Flood fill algorithm for Bucket tool
  const floodFillMatrix = useCallback(
    (matrix: (string | null)[][], startX: number, startY: number, newHex: string | null) => {
      const h = matrix.length;
      const w = h > 0 ? matrix[0].length : 0;
      if (startY < 0 || startY >= h || startX < 0 || startX >= w) return matrix;

      const targetHex = matrix[startY][startX];
      if (targetHex === newHex) return matrix;

      const clone = matrix.map((row) => [...row]);
      const queue: [number, number][] = [[startX, startY]];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
        if (clone[cy][cx] !== targetHex) continue;

        clone[cy][cx] = newHex;
        queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      return clone;
    },
    []
  );

  // Apply tool action at pixel coordinate (x, y)
  const applyToolAtPixel = useCallback(
    (x: number, y: number, isFirstClick: boolean) => {
      if (!basePixelMatrix.length) return;
      if (y < 0 || y >= basePixelMatrix.length || x < 0 || x >= basePixelMatrix[0].length) return;

      const currentHex = basePixelMatrix[y][x];
      const matchedColor = currentHex ? colorByHex.get(currentHex.toUpperCase()) || null : null;

      if (activeTool === 'inspect') {
        if (isFirstClick) {
          setPinnedPixel((prev) =>
            prev && prev.x === x && prev.y === y
              ? null
              : {
                  x,
                  y,
                  worldX: settings.originX + x,
                  worldY: settings.originY + y,
                  color: matchedColor,
                }
          );
        }
        return;
      }

      if (activeTool === 'eyedropper') {
        if (matchedColor) {
          setActiveBrushColor(matchedColor);
          setActiveTool('pencil');
          showToast(`Picked #${matchedColor.id} ${matchedColor.name}`);
        }
        return;
      }

      if (activeTool === 'pencil' || activeTool === 'eraser') {
        const targetHex = activeTool === 'eraser' ? null : activeBrushColor.hex;
        const symmetricCoords = expandWithSymmetry([[x, y]]);

        if (isFirstClick) {
          pushUndoSnapshot();
        }

        setBasePixelMatrix((prev) => {
          const next = prev.map((r) => [...r]);
          for (const [px, py] of symmetricCoords) {
            if (py >= 0 && py < next.length && px >= 0 && px < next[0].length) {
              next[py][px] = targetHex;
            }
          }
          return next;
        });
        return;
      }

      if (activeTool === 'bucket' && isFirstClick) {
        const targetHex = activeBrushColor.hex;
        if (currentHex === targetHex) return;
        pushUndoSnapshot();
        setBasePixelMatrix((prev) => floodFillMatrix(prev, x, y, targetHex));
      }
    },
    [
      basePixelMatrix,
      colorByHex,
      activeTool,
      activeBrushColor,
      settings.originX,
      settings.originY,
      expandWithSymmetry,
      pushUndoSnapshot,
      floodFillMatrix,
      showToast,
    ]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, basePixelMatrix.map((r) => [...r])]);
    setBasePixelMatrix(previous);
    setUndoStack((prev) => prev.slice(0, -1));
  }, [undoStack, basePixelMatrix]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, basePixelMatrix.map((r) => [...r])]);
    setBasePixelMatrix(next);
    setRedoStack((prev) => prev.slice(0, -1));
  }, [redoStack, basePixelMatrix]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Escape') {
        setHighlightedHex(null);
        setPinnedPixel(null);
        setShapeStart(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  const getPixelCoordsFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent): { x: number; y: number } | null => {
      if (!artWrapperRef.current || !basePixelMatrix.length) return null;
      const rect = artWrapperRef.current.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) return null;

      const x = Math.min(
        actualMatrixWidth - 1,
        Math.max(0, Math.floor((relX / rect.width) * actualMatrixWidth))
      );
      const y = Math.min(
        actualMatrixHeight - 1,
        Math.max(0, Math.floor((relY / rect.height) * actualMatrixHeight))
      );
      return { x, y };
    },
    [basePixelMatrix.length, actualMatrixWidth, actualMatrixHeight]
  );

  const handleViewportMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button === 1 || activeTool === 'pan') {
        setIsPanning(true);
        panStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          startX: panOffset.x,
          startY: panOffset.y,
        };
        return;
      }

      const coords = getPixelCoordsFromEvent(e);
      if (coords) {
        if (activeTool === 'line' || activeTool === 'rect') {
          setShapeStart(coords);
          return;
        }
        setIsPainting(true);
        applyToolAtPixel(coords.x, coords.y, true);
      } else {
        setIsPanning(true);
        panStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          startX: panOffset.x,
          startY: panOffset.y,
        };
      }
    },
    [activeTool, panOffset, getPixelCoordsFromEvent, applyToolAtPixel]
  );

  const handleViewportMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.clientX;
        const dy = e.clientY - panStartRef.current.clientY;
        setPanOffset({
          x: panStartRef.current.startX + dx,
          y: panStartRef.current.startY + dy,
        });
        return;
      }

      const coords = getPixelCoordsFromEvent(e);
      if (coords && basePixelMatrix.length) {
        const hex = basePixelMatrix[coords.y]?.[coords.x] || null;
        const color = hex ? colorByHex.get(hex.toUpperCase()) || null : null;
        setHoveredPixel({
          x: coords.x,
          y: coords.y,
          worldX: settings.originX + coords.x,
          worldY: settings.originY + coords.y,
          color,
        });

        if (isPainting && (activeTool === 'pencil' || activeTool === 'eraser')) {
          applyToolAtPixel(coords.x, coords.y, false);
        }
      } else {
        setHoveredPixel(null);
      }
    },
    [
      isPanning,
      isPainting,
      activeTool,
      getPixelCoordsFromEvent,
      basePixelMatrix,
      colorByHex,
      settings.originX,
      settings.originY,
      applyToolAtPixel,
    ]
  );

  // Commit Line or Rectangle shape on mouseup
  useEffect(() => {
    const onWindowMouseUp = () => {
      if (shapeStart && hoveredPixel && (activeTool === 'line' || activeTool === 'rect')) {
        const rawPts =
          activeTool === 'line'
            ? getLinePixels(shapeStart.x, shapeStart.y, hoveredPixel.x, hoveredPixel.y)
            : getRectPixels(shapeStart.x, shapeStart.y, hoveredPixel.x, hoveredPixel.y);
        const allPts = expandWithSymmetry(rawPts);
        pushUndoSnapshot();
        setBasePixelMatrix((prev) => {
          const next = prev.map((r) => [...r]);
          for (const [px, py] of allPts) {
            if (py >= 0 && py < next.length && px >= 0 && px < next[0].length) {
              next[py][px] = activeBrushColor.hex;
            }
          }
          return next;
        });
      }
      setShapeStart(null);
      setIsPanning(false);
      setIsPainting(false);
    };
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => window.removeEventListener('mouseup', onWindowMouseUp);
  }, [
    shapeStart,
    hoveredPixel,
    activeTool,
    expandWithSymmetry,
    pushUndoSnapshot,
    activeBrushColor.hex,
  ]);

  const handleViewportWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setSettings((prev) => ({
      ...prev,
      zoom: Math.max(0.25, Math.min(8, Number((prev.zoom * factor).toFixed(2)))),
    }));
  }, []);

  // High-resolution Image Download (with optional Grid, Coordinate Ruler & Paint-by-Numbers IDs)
  const handleDownloadImage = useCallback(
    (
      format: ExportFormat = exportFormat,
      includeGrid = exportWithGrid,
      includeIds = exportWithIds
    ) => {
      if (!basePixelMatrix.length) return;

      const scale = Math.max(includeIds ? 16 : 1, settings.outputResolution);
      const rulerMargin = includeGrid && scale >= 10 ? 28 : 0;
      const canvas = document.createElement('canvas');
      canvas.width = actualMatrixWidth * scale + rulerMargin;
      canvas.height = actualMatrixHeight * scale + rulerMargin;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (format === 'jpeg' || !settings.preserveTransparency || rulerMargin > 0) {
        ctx.fillStyle = rulerMargin > 0 ? '#0F172A' : settings.backgroundColor || '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      for (let y = 0; y < actualMatrixHeight; y++) {
        for (let x = 0; x < actualMatrixWidth; x++) {
          const hex = basePixelMatrix[y][x];
          if (!hex) {
            if (format === 'jpeg' || !settings.preserveTransparency) {
              ctx.fillStyle = settings.backgroundColor || '#FFFFFF';
              ctx.fillRect(rulerMargin + x * scale, rulerMargin + y * scale, scale, scale);
            }
            continue;
          }
          ctx.fillStyle = hex;
          ctx.fillRect(rulerMargin + x * scale, rulerMargin + y * scale, scale, scale);
        }
      }

      if (includeIds && scale >= 12) {
        const fontSize = Math.max(8, Math.floor(scale * 0.45));
        ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let y = 0; y < actualMatrixHeight; y++) {
          for (let x = 0; x < actualMatrixWidth; x++) {
            const hex = basePixelMatrix[y][x];
            if (!hex) continue;
            const c = colorByHex.get(hex.toUpperCase());
            if (!c) continue;
            ctx.fillStyle = isColorDark(hex) ? '#FFFFFF' : '#0F172A';
            ctx.fillText(
              String(c.id),
              rulerMargin + (x + 0.5) * scale,
              rulerMargin + (y + 0.5) * scale
            );
          }
        }
      }

      if (includeGrid && scale >= 4) {
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= actualMatrixWidth; x++) {
          const px = rulerMargin + x * scale + 0.5;
          ctx.moveTo(px, rulerMargin);
          ctx.lineTo(px, canvas.height);
        }
        for (let y = 0; y <= actualMatrixHeight; y++) {
          const py = rulerMargin + y * scale + 0.5;
          ctx.moveTo(rulerMargin, py);
          ctx.lineTo(canvas.width, py);
        }
        ctx.stroke();

        if (settings.majorGridInterval > 1) {
          ctx.strokeStyle = 'rgba(79, 70, 229, 0.75)';
          ctx.lineWidth = Math.max(1.5, scale / 8);
          ctx.beginPath();
          for (let x = 0; x <= actualMatrixWidth; x += settings.majorGridInterval) {
            const px = rulerMargin + x * scale + 0.5;
            ctx.moveTo(px, 0);
            ctx.lineTo(px, canvas.height);
          }
          for (let y = 0; y <= actualMatrixHeight; y += settings.majorGridInterval) {
            const py = rulerMargin + y * scale + 0.5;
            ctx.moveTo(0, py);
            ctx.lineTo(canvas.width, py);
          }
          ctx.stroke();
        }

        if (rulerMargin > 0) {
          ctx.fillStyle = '#E2E8F0';
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const step = settings.majorGridInterval || 8;
          for (let x = 0; x < actualMatrixWidth; x += step) {
            ctx.fillText(
              String(settings.originX + x),
              rulerMargin + x * scale + (scale * step) / 2,
              rulerMargin / 2
            );
          }
          for (let y = 0; y < actualMatrixHeight; y += step) {
            ctx.fillText(
              String(settings.originY + y),
              rulerMargin / 2,
              rulerMargin + y * scale + (scale * step) / 2
            );
          }
        }
      }

      const link = document.createElement('a');
      link.href = canvas.toDataURL(`image/${format}`, 0.95);
      const slug = (sourceImageName || 'wplace-art').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      link.download = `${slug}-${actualMatrixWidth}x${actualMatrixHeight}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Downloaded ${actualMatrixWidth}×${actualMatrixHeight} (${format.toUpperCase()})`);
    },
    [
      basePixelMatrix,
      exportFormat,
      exportWithGrid,
      exportWithIds,
      settings.outputResolution,
      settings.preserveTransparency,
      settings.backgroundColor,
      settings.majorGridInterval,
      settings.originX,
      settings.originY,
      actualMatrixWidth,
      actualMatrixHeight,
      colorByHex,
      sourceImageName,
      showToast,
    ]
  );

  const handleExportBlueprintCsv = useCallback(() => {
    if (!basePixelMatrix.length) return;
    const rows: string[] = ['Local_X,Local_Y,Wplace_X,Wplace_Y,Color_ID,Color_Name,HEX'];
    for (let y = 0; y < basePixelMatrix.length; y++) {
      for (let x = 0; x < basePixelMatrix[y].length; x++) {
        const hex = basePixelMatrix[y][x];
        if (!hex) continue;
        const color = colorByHex.get(hex.toUpperCase());
        rows.push(
          `${x},${y},${settings.originX + x},${settings.originY + y},${color?.id || 0},"${
            color?.name || 'Custom'
          }",${hex}`
        );
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(sourceImageName || 'wplace').toLowerCase()}-coordinates.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exported Wplace coordinate CSV');
  }, [basePixelMatrix, colorByHex, settings.originX, settings.originY, sourceImageName, showToast]);

  const handleCopyBlueprintJson = useCallback(() => {
    if (!basePixelMatrix.length) return;
    const payload = {
      name: sourceImageName,
      dimensions: { width: actualMatrixWidth, height: actualMatrixHeight },
      wplaceOrigin: { x: settings.originX, y: settings.originY },
      totalPixels: colorUsage.reduce((acc, c) => acc + c.count, 0),
      billOfMaterials: colorUsage.map((u) => ({
        id: u.color.id,
        name: u.color.name,
        hex: u.color.hex,
        count: u.count,
        percentage: Number(u.percentage.toFixed(2)),
      })),
    };
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    showToast('Copied Blueprint JSON to clipboard');
  }, [
    basePixelMatrix.length,
    sourceImageName,
    actualMatrixWidth,
    actualMatrixHeight,
    settings.originX,
    settings.originY,
    colorUsage,
    showToast,
  ]);

  const handleToggleColorEnabled = useCallback((hex: string) => {
    setDisabledHexes((prev) => {
      const next = new Set(prev);
      if (next.has(hex)) {
        next.delete(hex);
      } else if (next.size < WPLACE_COLORS.length - 1) {
        next.add(hex);
      }
      return next;
    });
  }, []);

  const handleApplyPalettePreset = useCallback(
    (presetId: string) => {
      const preset = PALETTE_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const disabled = new Set<string>();
      WPLACE_COLORS.forEach((c) => {
        if (!preset.filter(c)) disabled.add(c.hex);
      });
      setDisabledHexes(disabled);
      showToast(`Applied "${preset.name}" palette filter`);
    },
    [showToast]
  );

  const toggleCompletedColor = useCallback((hex: string) => {
    setCompletedHexes((prev) => {
      const next = new Set(prev);
      if (next.has(hex)) next.delete(hex);
      else next.add(hex);
      return next;
    });
  }, []);

  const loadFromHistory = useCallback(
    (item: ImageHistoryItem) => {
      setSourceImage(item.thumbnail);
      setSourceImageName(item.name);
      setSettings(item.settings);
      setHighlightedHex(null);
      setCompletedHexes(new Set());
      if (item.pixelMatrix && item.pixelMatrix.length > 0) {
        setBasePixelMatrix(item.pixelMatrix);
      } else {
        setPixelatedImage(item.pixelatedImage);
      }
      setActiveNavTab('studio');
      showToast(`Restored "${item.name}" to Workspace`);
    },
    [showToast]
  );

  // Total completion metrics
  const totalPixelCount = useMemo(
    () => colorUsage.reduce((sum, item) => sum + item.count, 0),
    [colorUsage]
  );
  const completedPixelCount = useMemo(
    () =>
      colorUsage.reduce(
        (sum, item) => (completedHexes.has(item.color.hex) ? sum + item.count : sum),
        0
      ),
    [colorUsage, completedHexes]
  );
  const completionPercent =
    totalPixelCount > 0 ? Math.round((completedPixelCount / totalPixelCount) * 100) : 0;

  const activeInspected = hoveredPixel || pinnedPixel;

  const filteredColorUsage = useMemo(() => {
    if (!colorSearch.trim()) return colorUsage;
    const q = colorSearch.toLowerCase();
    return colorUsage.filter(
      (u) =>
        u.color.name.toLowerCase().includes(q) ||
        u.color.hex.toLowerCase().includes(q) ||
        String(u.color.id) === q
    );
  }, [colorUsage, colorSearch]);

  // Chunk Inspector calculations (8x8 chunks)
  const chunkStep = Math.max(4, settings.majorGridInterval || 8);
  const totalChunksX = Math.max(1, Math.ceil(actualMatrixWidth / chunkStep));
  const totalChunksY = Math.max(1, Math.ceil(actualMatrixHeight / chunkStep));
  const safeChunkX = Math.min(selectedChunk.cx, totalChunksX - 1);
  const safeChunkY = Math.min(selectedChunk.cy, totalChunksY - 1);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100">
      {/* Top Bar Contract: 3 Zones (Brand Wordmark — 4 Single-line Nav Links — 1 Primary Action) */}
      <header className="h-14 shrink-0 flex items-center justify-between gap-8 px-6 bg-white dark:bg-[#0f1623] border-b border-slate-200 dark:border-slate-800/90 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            setActiveNavTab('studio');
          }}
          className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          Wplace Pixel Art Helper
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <a
            href="#studio"
            onClick={(e) => {
              e.preventDefault();
              setActiveNavTab('studio');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeNavTab === 'studio'
                ? 'border-indigo-500 text-slate-900 dark:text-white'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Workspace
          </a>
          <a
            href="#palette"
            onClick={(e) => {
              e.preventDefault();
              setActiveNavTab('palette');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeNavTab === 'palette'
                ? 'border-indigo-500 text-slate-900 dark:text-white'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Palette Guide
          </a>
          <a
            href="#blueprint"
            onClick={(e) => {
              e.preventDefault();
              setActiveNavTab('blueprint');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeNavTab === 'blueprint'
                ? 'border-indigo-500 text-slate-900 dark:text-white'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Coordinate Matrix
          </a>
          <a
            href="#history"
            onClick={(e) => {
              e.preventDefault();
              setActiveNavTab('history');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeNavTab === 'history'
                ? 'border-indigo-500 text-slate-900 dark:text-white'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Saved History
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
          >
            Export Blueprint
          </button>
        </div>
      </header>

      {/* Main 3-Column Studio Layout */}
      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT SIDEBAR: Image Input, Quantization, Dithering & Color Adjustments */}
        <aside className="w-80 shrink-0 bg-white dark:bg-[#0f1623] border-r border-slate-200 dark:border-slate-800/90 flex flex-col overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Section 1: Source Image & Instant Sample Presets */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  01. Source Artwork
                </h2>
                <button
                  type="button"
                  onClick={() => setDarkMode(!darkMode)}
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors whitespace-nowrap shrink-0"
                >
                  {darkMode ? 'Light Theme' : 'Dark Theme'}
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                }}
                className="hidden"
              />

              <div
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleImageUpload(f);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={() => fileInputRef.current?.click()}
                className="group relative border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-3.5 text-center cursor-pointer transition-colors bg-slate-50/70 dark:bg-slate-900/50"
              >
                {sourceImage ? (
                  <div className="flex items-center gap-3 text-left">
                    <img
                      src={sourceImage}
                      alt={sourceImageName}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {sourceImageName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Click or drop image to replace
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-2">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Drop image or click to browse
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      PNG, JPEG, WebP, GIF
                    </p>
                  </div>
                )}
              </div>

              {/* Built-in 2x2 Sample Templates */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Quick Sample Templates:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {SAMPLE_PRESETS.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleLoadSamplePreset(sample.id)}
                      className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md border transition-colors truncate text-left ${
                        sourceImageName === sample.name
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500/60 text-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-100/80 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {sample.name}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* Section 2: Canvas Dimensions & Wplace World Coordinates */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  02. Dimensions & Wplace Origin
                </h2>
                <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {(actualMatrixWidth * actualMatrixHeight).toLocaleString()} px
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {[32, 48, 64, 96, 128].map((dim) => (
                  <button
                    key={dim}
                    type="button"
                    onClick={() => handleSettingsChange('width', dim)}
                    className={`py-1 text-xs font-mono tabular-nums rounded border transition-colors ${
                      settings.width === dim
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {dim}px
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Grid Width (px)
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={320}
                    value={settings.width}
                    onChange={(e) =>
                      handleSettingsChange(
                        'width',
                        Math.max(4, Math.min(320, parseInt(e.target.value, 10) || 4))
                      )
                    }
                    className="w-full font-mono tabular-nums bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Grid Height (px)
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={320}
                    value={settings.height}
                    onChange={(e) =>
                      handleSettingsChange(
                        'height',
                        Math.max(4, Math.min(320, parseInt(e.target.value, 10) || 4))
                      )
                    }
                    className="w-full font-mono tabular-nums bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between cursor-pointer pt-0.5">
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  Lock Source Aspect Ratio
                </span>
                <input
                  type="checkbox"
                  checked={settings.lockAspectRatio}
                  onChange={(e) => handleSettingsChange('lockAspectRatio', e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              {/* Matrix Orientation Actions */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleFlipHorizontal}
                  className="py-1.5 px-2 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Flip Horiz
                </button>
                <button
                  type="button"
                  onClick={handleFlipVertical}
                  className="py-1.5 px-2 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Flip Vert
                </button>
                <button
                  type="button"
                  onClick={handleRotate90}
                  className="py-1.5 px-2 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Rotate 90°
                </button>
              </div>

              {/* Wplace Start X / Y */}
              <div className="pt-1 grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Wplace Start X
                  </label>
                  <input
                    type="number"
                    value={settings.originX}
                    onChange={(e) =>
                      handleSettingsChange('originX', parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full font-mono tabular-nums bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Wplace Start Y
                  </label>
                  <input
                    type="number"
                    value={settings.originY}
                    onChange={(e) =>
                      handleSettingsChange('originY', parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full font-mono tabular-nums bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* Section 3: Quantization & Dithering Engine */}
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                03. Dithering & Quantization
              </h2>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Dithering Algorithm
                </label>
                <select
                  value={settings.dithering ? settings.ditherAlgorithm : 'none'}
                  onChange={(e) => {
                    const val = e.target.value as DitherAlgorithm;
                    if (val === 'none') {
                      handleSettingsChange('dithering', false);
                    } else {
                      handleSettingsChange('dithering', true);
                      handleSettingsChange('ditherAlgorithm', val);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="none">None (Nearest Solid Color)</option>
                  <option value="floyd-steinberg">Floyd-Steinberg (Smooth Diffusion)</option>
                  <option value="atkinson">Atkinson (Crisp Retro Contrast)</option>
                  <option value="bayer-4x4">Bayer 4×4 (Ordered Crosshatch)</option>
                  <option value="bayer-8x8">Bayer 8×8 (Fine Ordered Pattern)</option>
                </select>
              </div>

              {settings.dithering && (
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Dither Strength</span>
                    <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {settings.ditherStrength}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={settings.ditherStrength}
                    onChange={(e) =>
                      handleSettingsChange('ditherStrength', parseInt(e.target.value, 10))
                    }
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Color Matching Distance
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  {(
                    [
                      { id: 'perceptual', label: 'Perceptual' },
                      { id: 'euclidean', label: 'Linear RGB' },
                    ] as { id: ColorSpaceMode; label: string }[]
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSettingsChange('colorSpace', m.id)}
                      className={`py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        settings.colorSpace === m.id
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* Section 4: Color Grading & Pre-Processing */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  04. Color & Edge Grading
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setSettings((prev) => ({
                      ...prev,
                      brightness: 0,
                      contrast: 0,
                      saturation: 0,
                      sharpness: 15,
                    }));
                  }}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Reset
                </button>
              </div>

              {(
                [
                  { label: 'Brightness', key: 'brightness' as const, min: -100, max: 100 },
                  { label: 'Contrast', key: 'contrast' as const, min: -100, max: 100 },
                  { label: 'Saturation', key: 'saturation' as const, min: -100, max: 100 },
                  { label: 'Edge Sharpness', key: 'sharpness' as const, min: 0, max: 100 },
                ] as const
              ).map(({ label, key, min, max }) => (
                <div key={key}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500 dark:text-slate-400">{label}</span>
                    <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {settings[key] > 0 && min < 0 ? `+${settings[key]}` : settings[key]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={settings[key]}
                    onChange={(e) => handleSettingsChange(key, parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              ))}

              <div className="pt-1 flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={settings.preserveTransparency}
                    onChange={(e) =>
                      handleSettingsChange('preserveTransparency', e.target.checked)
                    }
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                  Keep Transparent Pixels
                </label>
                {!settings.preserveTransparency && (
                  <input
                    type="color"
                    value={settings.backgroundColor}
                    onChange={(e) => handleSettingsChange('backgroundColor', e.target.value)}
                    className="w-6 h-6 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                    title="Background fill color for transparent areas"
                  />
                )}
              </div>
            </section>

            {/* Snapshot to History Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => runPixelation(true)}
                disabled={isLoading || !sourceImage}
                className="w-full py-2.5 px-4 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isLoading ? 'Processing Artwork...' : 'Save Snapshot to History'}
              </button>
            </div>
          </div>
        </aside>

        {/* CENTER VIEWPORT: Interactive Canvas, Palette Guide, Coordinate Matrix, or History Gallery */}
        <section className="flex-1 flex flex-col relative overflow-hidden bg-canvas-grid">
          {/* Top Workspace Toolbar */}
          <div className="h-12 shrink-0 px-4 bg-white/90 dark:bg-[#0f1623]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 z-20 overflow-x-auto">
            {/* Left: Interactive Pixel Tools */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
              {(
                [
                  { id: 'inspect', label: 'Inspect' },
                  { id: 'pan', label: 'Pan' },
                  { id: 'pencil', label: 'Pencil' },
                  { id: 'line', label: 'Line' },
                  { id: 'rect', label: 'Rect' },
                  { id: 'bucket', label: 'Fill' },
                  { id: 'eyedropper', label: 'Picker' },
                  { id: 'eraser', label: 'Erase' },
                ] as { id: CanvasTool; label: string }[]
              ).map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    setActiveTool(tool.id);
                    if (activeNavTab !== 'studio') setActiveNavTab('studio');
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeTool === tool.id && activeNavTab === 'studio'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tool.label}
                </button>
              ))}
            </div>

            {/* Center: Symmetry Selector + Undo / Redo + Comparison Mode Switcher */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                {(
                  [
                    { id: 'none', label: 'Sym: Off' },
                    { id: 'horizontal', label: 'Mirror X' },
                    { id: 'vertical', label: 'Mirror Y' },
                    { id: 'quad', label: '4-Way' },
                  ] as { id: SymmetryMode; label: string }[]
                ).map((sym) => (
                  <button
                    key={sym.id}
                    type="button"
                    onClick={() => setSymmetryMode(sym.id)}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      symmetryMode === sym.id
                        ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {sym.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  title="Undo pixel edit (Ctrl+Z)"
                >
                  Undo ({undoStack.length})
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  title="Redo pixel edit (Ctrl+Y)"
                >
                  Redo
                </button>
              </div>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                {(
                  [
                    { id: 'pixel', label: 'Pixel Art' },
                    { id: 'split', label: 'Split' },
                    { id: 'overlay', label: 'Ghost' },
                    { id: 'side-by-side', label: '2-Up' },
                  ] as { id: ViewComparisonMode; label: string }[]
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      setComparisonMode(mode.id);
                      if (activeNavTab !== 'studio') setActiveNavTab('studio');
                    }}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      comparisonMode === mode.id && activeNavTab === 'studio'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Active Highlight Indicator */}
            {highlightedHex && (
              <button
                type="button"
                onClick={() => setHighlightedHex(null)}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0"
              >
                Clear Isolation ({highlightedHex})
              </button>
            )}
          </div>

          {/* Toast & Error Notifications */}
          {error && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-medium flex items-center gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="underline text-white/90 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}

          {toastMessage && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-lg shadow-lg text-xs font-medium pointer-events-none">
              {toastMessage}
            </div>
          )}

          {/* TAB 1: PALETTE GUIDE & GLOBAL COLOR SWAPPER */}
          {activeNavTab === 'palette' && (
            <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-[#090d16]">
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Official 64-Color Wplace Master Reference & Color Swapper
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Click any color used in your artwork to remap all its pixels to a different
                      Wplace color, or toggle colors in/out of quantization.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PALETTE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPalettePreset(preset.id)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-500 transition-colors whitespace-nowrap shrink-0"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Global Color Swapper Banner */}
                {swapSourceHex && (
                  <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-xs">
                      <span
                        className="w-6 h-6 rounded border border-black/20 shrink-0"
                        style={{ backgroundColor: swapSourceHex }}
                      />
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          Select a target color below to replace all pixels of {swapSourceHex}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">
                          Click any of the 64 Wplace color cards below to perform an instant swap.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSwapSourceHex(null)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      Cancel Swap
                    </button>
                  </div>
                )}

                {/* 64 Color Reference Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
                  {WPLACE_COLORS.map((color) => {
                    const usage = colorUsage.find((u) => u.color.hex === color.hex);
                    const isDisabled = disabledHexes.has(color.hex);
                    const isSwapSource = swapSourceHex === color.hex;

                    return (
                      <div
                        key={color.id}
                        onClick={() => {
                          if (swapSourceHex) {
                            handleReplaceColorInMatrix(swapSourceHex, color);
                          } else {
                            setActiveBrushColor(color);
                          }
                        }}
                        className={`p-2.5 rounded-xl bg-white dark:bg-[#0f1623] border transition-all cursor-pointer ${
                          isSwapSource
                            ? 'ring-2 ring-indigo-500 border-indigo-500'
                            : usage
                            ? 'border-slate-300 dark:border-slate-700 hover:border-indigo-500'
                            : 'border-slate-200/70 dark:border-slate-800/70 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <div
                          className="w-full h-11 rounded-lg border border-black/10 dark:border-white/10 mb-2 flex items-center justify-between px-2"
                          style={{ backgroundColor: color.hex }}
                        >
                          <span
                            className={`text-[11px] font-mono font-bold ${
                              isColorDark(color.hex) ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            #{color.id}
                          </span>
                          {usage && (
                            <span
                              className={`text-[10px] font-mono tabular-nums font-semibold ${
                                isColorDark(color.hex) ? 'text-white/90' : 'text-slate-900/90'
                              }`}
                            >
                              {usage.count}px
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {color.name}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] font-mono text-slate-500">{color.hex}</span>
                          {usage && !swapSourceHex && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSwapSourceHex(color.hex);
                              }}
                              className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              Swap
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleColorEnabled(color.hex);
                          }}
                          className={`mt-2 w-full py-1 text-[10px] font-medium rounded border transition-colors ${
                            isDisabled
                              ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {isDisabled ? 'Disabled' : 'Enabled'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COORDINATE MATRIX & CHUNK INSPECTOR */}
          {activeNavTab === 'blueprint' && (
            <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-[#090d16]">
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Wplace Paint-by-Numbers Chunk Inspector & Coordinate Matrix
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      World origin ({settings.originX}, {settings.originY}) · Select any{' '}
                      {chunkStep}×{chunkStep} chunk below for pixel-by-pixel Wplace placement.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyBlueprintJson}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Copy JSON Summary
                    </button>
                    <button
                      type="button"
                      onClick={handleExportBlueprintCsv}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    >
                      Download Full CSV ({totalPixelCount.toLocaleString()} rows)
                    </button>
                  </div>
                </div>

                {/* Interactive Chunk Paint-by-Numbers Inspector */}
                <div className="p-5 bg-white dark:bg-[#0f1623] border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Step-by-Step Chunk Inspector (Chunk X:{safeChunkX + 1}/{totalChunksX}, Y:
                        {safeChunkY + 1}/{totalChunksY})
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Wplace X: {settings.originX + safeChunkX * chunkStep} to{' '}
                        {settings.originX +
                          Math.min(actualMatrixWidth, (safeChunkX + 1) * chunkStep) -
                          1}{' '}
                        · Wplace Y: {settings.originY + safeChunkY * chunkStep} to{' '}
                        {settings.originY +
                          Math.min(actualMatrixHeight, (safeChunkY + 1) * chunkStep) -
                          1}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedChunk((p) => ({ ...p, cx: Math.max(0, p.cx - 1) }))
                        }
                        disabled={safeChunkX === 0}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40"
                      >
                        Prev X
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedChunk((p) => ({
                            ...p,
                            cx: Math.min(totalChunksX - 1, p.cx + 1),
                          }))
                        }
                        disabled={safeChunkX >= totalChunksX - 1}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40"
                      >
                        Next X
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedChunk((p) => ({ ...p, cy: Math.max(0, p.cy - 1) }))
                        }
                        disabled={safeChunkY === 0}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40"
                      >
                        Prev Y
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedChunk((p) => ({
                            ...p,
                            cy: Math.min(totalChunksY - 1, p.cy + 1),
                          }))
                        }
                        disabled={safeChunkY >= totalChunksY - 1}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40"
                      >
                        Next Y
                      </button>
                    </div>
                  </div>

                  {/* Paint-by-Numbers Chunk Matrix Table */}
                  <div className="overflow-x-auto">
                    <table className="border-collapse mx-auto">
                      <thead>
                        <tr>
                          <th className="p-1.5 text-[10px] font-mono text-slate-400">Y \ X</th>
                          {Array.from({ length: chunkStep }).map((_, idx) => {
                            const gx = safeChunkX * chunkStep + idx;
                            if (gx >= actualMatrixWidth) return null;
                            return (
                              <th
                                key={gx}
                                className="p-1.5 text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 text-center"
                              >
                                {settings.originX + gx}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: chunkStep }).map((_, rIdx) => {
                          const gy = safeChunkY * chunkStep + rIdx;
                          if (gy >= actualMatrixHeight) return null;
                          return (
                            <tr key={gy}>
                              <td className="p-1.5 text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 pr-2">
                                {settings.originY + gy}
                              </td>
                              {Array.from({ length: chunkStep }).map((__, cIdx) => {
                                const gx = safeChunkX * chunkStep + cIdx;
                                if (gx >= actualMatrixWidth) return null;
                                const hex = basePixelMatrix[gy]?.[gx];
                                const color = hex ? colorByHex.get(hex.toUpperCase()) : null;
                                return (
                                  <td
                                    key={gx}
                                    style={{ backgroundColor: hex || 'transparent' }}
                                    title={
                                      color
                                        ? `(${settings.originX + gx}, ${settings.originY + gy}) — #${color.id} ${color.name}`
                                        : 'Transparent'
                                    }
                                    className="w-10 h-10 border border-slate-300 dark:border-slate-700 text-center font-mono text-xs font-bold select-all"
                                  >
                                    {color ? (
                                      <span
                                        className={
                                          isColorDark(color.hex) ? 'text-white' : 'text-slate-900'
                                        }
                                      >
                                        #{color.id}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">·</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bill of Materials Table */}
                <div className="bg-white dark:bg-[#0f1623] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Wplace ID</th>
                        <th className="py-2.5 px-4">Color Name</th>
                        <th className="py-2.5 px-4">HEX Code</th>
                        <th className="py-2.5 px-4 text-right">Pixel Count</th>
                        <th className="py-2.5 px-4 text-right">Share</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70 text-xs">
                      {colorUsage.map((u) => {
                        const isDone = completedHexes.has(u.color.hex);
                        const isIsolated = highlightedHex === u.color.hex;
                        return (
                          <tr
                            key={u.color.hex}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                              isDone ? 'opacity-50' : ''
                            }`}
                          >
                            <td className="py-2.5 px-4">
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => toggleCompletedColor(u.color.hex)}
                                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                              #{u.color.id}
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <span
                                  className="w-4 h-4 rounded border border-black/15 dark:border-white/15 shrink-0"
                                  style={{ backgroundColor: u.color.hex }}
                                />
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  {u.color.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              {u.color.hex}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                              {u.count.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                              {u.percentage.toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setHighlightedHex(isIsolated ? null : u.color.hex);
                                  setActiveNavTab('studio');
                                }}
                                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                {isIsolated ? 'Showing on Canvas' : 'Locate on Canvas'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SAVED HISTORY GALLERY */}
          {activeNavTab === 'history' && (
            <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-[#090d16]">
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Saved Project Snapshots ({history.length})
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Compare different dithering algorithms, resolutions, and manual pixel edits.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => runPixelation(true)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    >
                      Save Current Artwork
                    </button>
                    {history.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setHistory([]);
                          localStorage.removeItem('wplacePixelHistory_v2');
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {history.length === 0 ? (
                  <div className="p-12 text-center bg-white dark:bg-[#0f1623] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      No snapshots saved yet
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Click "Save Current Artwork" above or "Save Snapshot to History" in the left
                      panel to store versions of your pixel art for comparison.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-white dark:bg-[#0f1623] border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4"
                      >
                        <div>
                          <div className="aspect-square rounded-lg bg-slate-100 dark:bg-slate-950 p-3 flex items-center justify-center mb-3 border border-slate-200/60 dark:border-slate-800">
                            <img
                              src={item.pixelatedImage}
                              alt={item.name}
                              style={{ imageRendering: 'pixelated' }}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {item.name}
                            </h3>
                            <span className="text-xs font-mono tabular-nums text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">
                              {item.settings.width}×{item.settings.height}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Dither:{' '}
                            {item.settings.dithering ? item.settings.ditherAlgorithm : 'None'} ·{' '}
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => loadFromHistory(item)}
                            className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                          >
                            Load in Studio
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setHistory((prev) => prev.filter((h) => h.id !== item.id))
                            }
                            className="py-1.5 px-2.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-red-500 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4 (DEFAULT): INTERACTIVE STUDIO CANVAS */}
          {activeNavTab === 'studio' && (
            <div
              ref={viewportRef}
              onMouseDown={handleViewportMouseDown}
              onMouseMove={handleViewportMouseMove}
              onMouseLeave={() => setHoveredPixel(null)}
              onWheel={handleViewportWheel}
              className={`flex-1 relative overflow-hidden flex items-center justify-center ${
                isPanning || activeTool === 'pan'
                  ? isPanning
                    ? 'cursor-grabbing'
                    : 'cursor-grab'
                  : activeTool === 'inspect'
                  ? 'cursor-crosshair'
                  : 'cursor-cell'
              }`}
            >
              {pixelatedImage && (
                <div
                  style={{
                    transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0)`,
                  }}
                  className="flex items-center gap-6"
                >
                  {/* Side-by-Side Original Reference */}
                  {comparisonMode === 'side-by-side' && sourceImage && (
                    <div className="relative rounded-lg overflow-hidden shadow-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                      <img
                        src={sourceImage}
                        alt="Original Source"
                        style={{
                          width: `${displayWidth}px`,
                          height: `${displayHeight}px`,
                        }}
                        className="block object-fill pointer-events-none"
                        draggable={false}
                      />
                      <div className="absolute bottom-2 left-2 bg-slate-900/80 text-white text-[11px] font-medium px-2 py-0.5 rounded">
                        Original Reference
                      </div>
                    </div>
                  )}

                  {/* Primary Interactive Pixel Art Canvas Container */}
                  <div
                    ref={artWrapperRef}
                    style={{
                      width: `${displayWidth}px`,
                      height: `${displayHeight}px`,
                    }}
                    className="relative rounded-lg shadow-2xl border border-slate-300 dark:border-slate-700 bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] dark:bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]"
                  >
                    {/* Ghost Overlay Original Image underneath */}
                    {comparisonMode === 'overlay' && sourceImage && (
                      <img
                        src={sourceImage}
                        alt="Source Ghost"
                        className="absolute inset-0 w-full h-full object-fill pointer-events-none rounded-lg"
                        draggable={false}
                      />
                    )}

                    {/* Pixelated Output Image */}
                    <img
                      src={pixelatedImage}
                      alt="Pixelated Output"
                      style={{
                        imageRendering: 'pixelated',
                        opacity: comparisonMode === 'overlay' ? settings.opacity : 1,
                      }}
                      className="w-full h-full block rounded-lg pointer-events-none"
                      draggable={false}
                    />

                    {/* Split Comparison Curtain */}
                    {comparisonMode === 'split' && sourceImage && (
                      <>
                        <div
                          style={{ width: `${splitPosition}%` }}
                          className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none rounded-l-lg"
                        >
                          <img
                            src={sourceImage}
                            alt="Before Split"
                            style={{
                              width: `${displayWidth}px`,
                              height: `${displayHeight}px`,
                              maxWidth: 'none',
                            }}
                            className="block object-fill"
                            draggable={false}
                          />
                        </div>
                        <div
                          style={{ left: `${splitPosition}%` }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const moveSplit = (ev: MouseEvent) => {
                              if (!artWrapperRef.current) return;
                              const r = artWrapperRef.current.getBoundingClientRect();
                              const pct = Math.max(
                                0,
                                Math.min(100, ((ev.clientX - r.left) / r.width) * 100)
                              );
                              setSplitPosition(pct);
                            };
                            const upSplit = () => {
                              window.removeEventListener('mousemove', moveSplit);
                              window.removeEventListener('mouseup', upSplit);
                            };
                            window.addEventListener('mousemove', moveSplit);
                            window.addEventListener('mouseup', upSplit);
                          }}
                          className="absolute inset-y-0 -ml-0.5 w-1 bg-white shadow-md cursor-ew-resize z-20 flex items-center justify-center"
                        >
                          <div className="w-5 h-8 rounded bg-white text-slate-900 shadow-md flex items-center justify-center text-[10px] font-bold">
                            ⋮
                          </div>
                        </div>
                      </>
                    )}

                    {/* Crisp HTML5 Grid, Symmetry, ID Numbers & Coordinate Highlight Canvas */}
                    <canvas
                      ref={gridCanvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Top-Left Live Coordinate & Color Inspector HUD */}
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute top-3 left-3 bg-white/95 dark:bg-[#0f1623]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 shadow-lg text-xs space-y-1.5 min-w-[235px]"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Grid Size
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {actualMatrixWidth} × {actualMatrixHeight} px
                  </span>
                </div>

                {activeInspected ? (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Local (X, Y)
                      </span>
                      <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        ({activeInspected.x}, {activeInspected.y})
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Wplace Coord
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                        X:{activeInspected.worldX} · Y:{activeInspected.worldY}
                      </span>
                    </div>
                    <div className="pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                      {activeInspected.color ? (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3.5 h-3.5 rounded border border-black/20 dark:border-white/20 shrink-0"
                              style={{ backgroundColor: activeInspected.color.hex }}
                            />
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                              #{activeInspected.color.id} {activeInspected.color.name}
                            </span>
                          </div>
                          <span className="font-mono tabular-nums text-[11px] text-slate-500">
                            {activeInspected.color.hex}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">Transparent Pixel</span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                    Hover or click any pixel to inspect Wplace coordinates
                  </p>
                )}
              </div>

              {/* Bottom Floating Viewport Controls */}
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-[#0f1623]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 shadow-xl flex items-center gap-4 text-xs z-20"
              >
                {/* Zoom Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleSettingsChange(
                        'zoom',
                        Math.max(0.25, Number((settings.zoom - 0.25).toFixed(2)))
                      )
                    }
                    className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-mono font-bold text-slate-700 dark:text-slate-200"
                  >
                    -
                  </button>
                  <span className="font-mono tabular-nums w-12 text-center font-medium text-slate-800 dark:text-slate-200">
                    {Math.round(settings.zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleSettingsChange(
                        'zoom',
                        Math.min(8, Number((settings.zoom + 0.25).toFixed(2)))
                      )
                    }
                    className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-mono font-bold text-slate-700 dark:text-slate-200"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSettingsChange('zoom', 1);
                      setPanOffset({ x: 0, y: 0 });
                    }}
                    className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    Center 1:1
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

                {/* Pixel Grid Toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.showGrid}
                    onChange={(e) => handleSettingsChange('showGrid', e.target.checked)}
                    className="w-3.5 h-3.5 accent-indigo-600 rounded"
                  />
                  <span className="text-slate-700 dark:text-slate-300">Pixel Grid</span>
                </label>

                {/* Major Chunk Grid Toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.showMajorGrid}
                    onChange={(e) => handleSettingsChange('showMajorGrid', e.target.checked)}
                    className="w-3.5 h-3.5 accent-indigo-600 rounded"
                  />
                  <span className="text-slate-700 dark:text-slate-300">
                    {settings.majorGridInterval}×{settings.majorGridInterval} Guide
                  </span>
                </label>

                {/* Paint-by-Numbers Color ID Toggle */}
                <label
                  className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  title="Display Wplace Color IDs (#1-64) inside each pixel (zoom in if cells are small)"
                >
                  <input
                    type="checkbox"
                    checked={settings.showColorIds}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      handleSettingsChange('showColorIds', checked);
                      if (checked && displayWidth / actualMatrixWidth < 12) {
                        handleSettingsChange(
                          'zoom',
                          Math.min(4, Math.ceil((14 * actualMatrixWidth) / settings.previewSize))
                        );
                      }
                    }}
                    className="w-3.5 h-3.5 accent-indigo-600 rounded"
                  />
                  <span className="text-slate-700 dark:text-slate-300">Color IDs (#)</span>
                </label>

                {comparisonMode === 'overlay' && (
                  <>
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Opacity</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={settings.opacity}
                        onChange={(e) =>
                          handleSettingsChange('opacity', parseFloat(e.target.value))
                        }
                        className="w-20 h-1.5 accent-indigo-600 cursor-pointer"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT SIDEBAR: Wplace 64-Color Palette, Placement Progress Checklist & History */}
        <aside className="w-80 shrink-0 bg-white dark:bg-[#0f1623] border-l border-slate-200 dark:border-slate-800/90 flex flex-col overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Official 64-Color Wplace Palette */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Wplace 64-Color Palette
                </h2>
                <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {colorUsage.length} used
                </span>
              </div>

              <WplacePalette
                colors={WPLACE_COLORS}
                activeBrushColor={activeBrushColor}
                onSelectBrushColor={(color) => {
                  setActiveBrushColor(color);
                  if (activeTool === 'pan' || activeTool === 'inspect') {
                    setActiveTool('pencil');
                  }
                }}
                disabledHexes={disabledHexes}
                onToggleColorEnabled={handleToggleColorEnabled}
                onApplyPreset={handleApplyPalettePreset}
                highlightedHex={highlightedHex}
                onSelectHighlightHex={setHighlightedHex}
                mode={paletteMode}
                setMode={setPaletteMode}
              />
            </section>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* Wplace Placement Guide & Color Checklist */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Placement Checklist
                </h2>
                <span className="text-[11px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                  {completedPixelCount.toLocaleString()} / {totalPixelCount.toLocaleString()} (
                  {completionPercent}%)
                </span>
              </div>

              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  style={{ width: `${completionPercent}%` }}
                  className="h-full bg-emerald-500 transition-all duration-150"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={colorSearch}
                  onChange={(e) => setColorSearch(e.target.value)}
                  placeholder="Search color name, ID or HEX..."
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {completedHexes.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setCompletedHexes(new Set())}
                    className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0"
                  >
                    Reset Done
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {filteredColorUsage.map((u) => {
                  const isIsolated = highlightedHex === u.color.hex;
                  const isDone = completedHexes.has(u.color.hex);
                  return (
                    <div
                      key={u.color.hex}
                      className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition-colors ${
                        isIsolated
                          ? 'bg-amber-500/10 border-amber-500/40'
                          : 'bg-slate-50/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80'
                      } ${isDone ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => toggleCompletedColor(u.color.hex)}
                          className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer shrink-0"
                          title="Mark color as placed on Wplace"
                        />
                        <span
                          className="w-4 h-4 rounded border border-black/15 dark:border-white/15 shrink-0"
                          style={{ backgroundColor: u.color.hex }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                            #{u.color.id} {u.color.name}
                          </p>
                          <p className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            {u.count.toLocaleString()} px · {u.percentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setHighlightedHex(isIsolated ? null : u.color.hex)}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                          isIsolated
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-500'
                        }`}
                      >
                        {isIsolated ? 'Isolated' : 'Isolate'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* Saved History Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Saved Snapshots ({history.length})
                </h2>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveNavTab('history')}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Open Gallery
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click "Save Snapshot to History" after customizing an artwork to compare versions.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {history.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => loadFromHistory(item)}
                      className="group text-left p-2 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition-colors"
                    >
                      <img
                        src={item.pixelatedImage}
                        alt={item.name}
                        style={{ imageRendering: 'pixelated' }}
                        className="w-full aspect-square object-contain rounded bg-slate-200/50 dark:bg-slate-950 mb-1.5"
                      />
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {item.name}
                      </p>
                      <p className="text-[10px] font-mono tabular-nums text-slate-500">
                        {item.settings.width}×{item.settings.height} px
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </aside>
      </main>

      {/* Export Blueprint Modal */}
      {showExportModal && (
        <div
          onClick={() => setShowExportModal(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-[#0f1623] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Export Artwork & Wplace Blueprint
              </h3>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Image Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['png', 'webp', 'jpeg'] as ExportFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setExportFormat(fmt)}
                      className={`py-2 text-xs font-semibold uppercase rounded-lg border transition-colors ${
                        exportFormat === fmt
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-400">
                    Upscale Multiplier ({settings.outputResolution}× per pixel)
                  </span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100 font-semibold">
                    {actualMatrixWidth * settings.outputResolution} ×{' '}
                    {actualMatrixHeight * settings.outputResolution} px
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={32}
                  value={settings.outputResolution}
                  onChange={(e) =>
                    handleSettingsChange('outputResolution', parseInt(e.target.value, 10))
                  }
                  className="w-full h-1.5 accent-indigo-600 cursor-pointer"
                />
              </div>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Bake Wplace Grid & Coordinate Ruler
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Draws grid lines and world coordinates ({settings.originX}, {settings.originY})
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={exportWithGrid}
                  onChange={(e) => setExportWithGrid(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Bake Paint-by-Numbers Color IDs (#1–#64)
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Prints the Wplace Color ID inside every pixel cell
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={exportWithIds}
                  onChange={(e) => setExportWithIds(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
              </label>

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadImage(exportFormat, exportWithGrid, exportWithIds);
                    setShowExportModal(false);
                  }}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                >
                  Download High-Res {exportFormat.toUpperCase()} Image
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleExportBlueprintCsv();
                      setShowExportModal(false);
                    }}
                    className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors"
                  >
                    Export Coordinate CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyBlueprintJson();
                      setShowExportModal(false);
                    }}
                    className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors"
                  >
                    Copy Blueprint JSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
