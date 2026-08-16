import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ControlsPanel } from './components/ControlsPanel';
import { DraggablePreview } from './components/DraggableOverlay';
import { pixelate } from './services/pixelator';
import type { PixelatorSettings, ImageHistoryItem, ColorUsage, ExportFormat } from './types';
import { WPLACE_COLORS } from './constants';

const App: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [pixelatedImage, setPixelatedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceImageAspectRatio, setSourceImageAspectRatio] = useState<number | null>(null);
  const [colorUsage, setColorUsage] = useState<ColorUsage[]>([]);
  const [history, setHistory] = useState<ImageHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [darkMode, setDarkMode] = useState(true);
  
  const [settings, setSettings] = useState<PixelatorSettings>({
    width: 64,
    height: 64,
    previewX: 100,
    previewY: 100,
    opacity: 0.7,
    showGrid: true,
    previewSize: 640,
    outputResolution: 10,
    dithering: true,
    lockAspectRatio: true,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    zoom: 1,
    darkMode: true,
  });
  
  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('pixelArtHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistory(parsed);
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  // Save history to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('pixelArtHistory', JSON.stringify(history));
  }, [history]);

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSourceImage(result);
      setPixelatedImage(null);
      setColorUsage([]);

      const img = new Image();
      img.onload = () => {
          const aspectRatio = img.width / img.height;
          setSourceImageAspectRatio(aspectRatio);
          if (settings.lockAspectRatio) {
              setSettings(prev => ({
                  ...prev,
                  height: Math.max(1, Math.round(prev.width / aspectRatio)),
              }));
          }
      };
      img.src = result;
    };
    reader.onerror = () => {
        setError('Failed to read the image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSettingsChange = <K extends keyof PixelatorSettings>(
    key: K,
    value: PixelatorSettings[K]
  ) => {
    setSettings(prev => {
        const newSettings = { ...prev, [key]: value };

        if (newSettings.lockAspectRatio && sourceImageAspectRatio) {
            if (key === 'width' && typeof value === 'number') {
                newSettings.height = Math.max(1, Math.round(value / sourceImageAspectRatio));
            } else if (key === 'height' && typeof value === 'number') {
                newSettings.width = Math.max(1, Math.round(value * sourceImageAspectRatio));
            }
        }
        
        // When toggling lock on, adjust height to match current width
        if (key === 'lockAspectRatio' && value === true && sourceImageAspectRatio) {
             newSettings.height = Math.max(1, Math.round(newSettings.width / sourceImageAspectRatio));
        }

        return newSettings;
    });
  };

  const runPixelation = useCallback(async () => {
    if (!sourceImage) {
      setError('Please upload an image first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setPixelatedImage(null);
    try {
      const result = await pixelate(sourceImage, settings, WPLACE_COLORS);
      setPixelatedImage(result.dataUrl);
      
      // Calculate color usage percentages
      const colorUsageArray: ColorUsage[] = [];
      result.colorUsage.forEach((count, hex) => {
        const color = WPLACE_COLORS.find(c => c.hex === hex);
        if (color) {
          colorUsageArray.push({
            color,
            count,
            percentage: (count / result.totalPixels) * 100
          });
        }
      });
      colorUsageArray.sort((a, b) => b.count - a.count);
      setColorUsage(colorUsageArray);
      
      // Add to history
      const historyItem: ImageHistoryItem = {
        id: Date.now().toString(),
        sourceImage,
        pixelatedImage: result.dataUrl,
        settings: { ...settings },
        timestamp: Date.now()
      };
      setHistory(prev => [historyItem, ...prev].slice(0, 20)); // Keep last 20 items
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during pixelation.');
    } finally {
      setIsLoading(false);
    }
  }, [sourceImage, settings]);
  
  const handleDownload = useCallback((format: ExportFormat = 'png') => {
    if (!pixelatedImage) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get canvas context for download.');
        return;
      }

      const scale = settings.outputResolution;
      const w = img.width;
      const h = img.height;

      canvas.width = w * scale;
      canvas.height = h * scale;

      // Disable anti-aliasing to preserve sharp pixels
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const link = document.createElement('a');
      link.href = canvas.toDataURL(`image/${format}`);
      link.download = `wplace-pixel-art.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.onerror = () => {
      console.error('Failed to load pixelated image for download.');
    };
    img.src = pixelatedImage;
  }, [pixelatedImage, settings.outputResolution]);

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('pixelArtHistory');
  };

  const loadFromHistory = (item: ImageHistoryItem) => {
    setSourceImage(item.sourceImage);
    setPixelatedImage(item.pixelatedImage);
    setSettings(item.settings);
    setShowHistory(false);
  };

  const memoizedWplaceColors = useMemo(() => WPLACE_COLORS, []);

  return (
    <div className={`min-h-screen flex flex-col lg:flex-row ${darkMode ? 'bg-gray-900 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
      <ControlsPanel
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onImageUpload={handleImageUpload}
        onPixelate={runPixelation}
        isLoading={isLoading}
        sourceImage={sourceImage}
        pixelatedImage={pixelatedImage}
        wplaceColors={memoizedWplaceColors}
        colorUsage={colorUsage}
        onDownload={handleDownload}
        exportFormat={exportFormat}
        setExportFormat={setExportFormat}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        history={history}
        onLoadFromHistory={loadFromHistory}
        onClearHistory={clearHistory}
        showHistory={showHistory}
        setShowHistory={setShowHistory}
      />
      <main className={`flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden ${darkMode ? 'bg-grid bg-gray-900/50' : 'bg-gray-200'}`}>
         <div className="absolute inset-0 backdrop-blur-sm z-0"></div>
         <div className="relative z-10 text-center mb-8">
            <h1 className={`text-4xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>Wplace Preview Pro</h1>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-2`}>Professional pixel art converter with advanced features</p>
            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md mt-4">{error}</p>}
         </div>
        
        {pixelatedImage && (
           <DraggablePreview
             imageDataUrl={pixelatedImage}
             settings={settings}
             setSettings={setSettings}
           />
        )}
      </main>
    </div>
  );
};

export default App;
