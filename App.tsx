import React, { useState, useCallback, useMemo } from 'react';
import { ControlsPanel } from './components/ControlsPanel';
import { DraggablePreview } from './components/DraggableOverlay';
import { pixelate } from './services/pixelator';
import type { PixelatorSettings } from './types';
import { WPLACE_COLORS } from './constants';

const App: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [pixelatedImage, setPixelatedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceImageAspectRatio, setSourceImageAspectRatio] = useState<number | null>(null);

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
  });

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSourceImage(result);
      setPixelatedImage(null); // Clear previous result

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
      const dataUrl = await pixelate(sourceImage, settings, WPLACE_COLORS);
      setPixelatedImage(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during pixelation.');
    } finally {
      setIsLoading(false);
    }
  }, [sourceImage, settings]);
  
  const memoizedWplaceColors = useMemo(() => WPLACE_COLORS, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col lg:flex-row">
      <ControlsPanel
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onImageUpload={handleImageUpload}
        onPixelate={runPixelation}
        isLoading={isLoading}
        sourceImage={sourceImage}
        pixelatedImage={pixelatedImage}
        wplaceColors={memoizedWplaceColors}
      />
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden bg-grid">
         <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm z-0"></div>
         <div className="relative z-10 text-center mb-8">
            <h1 className="text-4xl font-bold text-white tracking-tight">Wplace Preview</h1>
            <p className="text-gray-400 mt-2">Your pixelated image preview appears here. Drag it to position it.</p>
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