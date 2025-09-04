import React from 'react';
import type { PixelatorSettings, WplaceColor } from '../types';
import { ImageUploader } from './ImageUploader';
import { WplacePalette } from './WplacePalette';
import { Slider } from './ui/Slider';
import { NumberInput } from './ui/NumberInput';
import { Toggle } from './ui/Toggle';

interface ControlsPanelProps {
  settings: PixelatorSettings;
  onSettingsChange: <K extends keyof PixelatorSettings>(key: K, value: PixelatorSettings[K]) => void;
  onImageUpload: (file: File) => void;
  onPixelate: () => void;
  isLoading: boolean;
  sourceImage: string | null;
  pixelatedImage: string | null;
  wplaceColors: WplaceColor[];
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  settings,
  onSettingsChange,
  onImageUpload,
  onPixelate,
  isLoading,
  sourceImage,
  pixelatedImage,
  wplaceColors
}) => {
  const handleDownload = () => {
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
      link.href = canvas.toDataURL('image/png');
      link.download = 'wplace-pixel-art.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.onerror = () => {
      console.error('Failed to load pixelated image for download.');
    };
    img.src = pixelatedImage;
  };

  return (
    <aside className="w-full lg:w-96 bg-gray-800 p-6 space-y-6 overflow-y-auto h-screen shadow-2xl flex-shrink-0">
      <div className="space-y-2 pb-4 border-b border-gray-700">
        <h2 className="text-2xl font-bold text-white">Pixel Art Helper</h2>
        <p className="text-sm text-gray-400">Convert any image into wplace-ready pixel art.</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-300">1. Upload Image</h3>
        <ImageUploader onImageUpload={onImageUpload} />
        {sourceImage && (
            <div className="p-2 bg-gray-900 rounded-lg">
                <img src={sourceImage} alt="Preview" className="max-h-32 w-auto mx-auto rounded" />
            </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-300">2. Configure Output</h3>
        <div className="grid grid-cols-2 gap-4">
          <NumberInput
            label="Width (px)"
            value={settings.width}
            onChange={(val) => onSettingsChange('width', val)}
            min={1}
            max={512}
          />
          <NumberInput
            label="Height (px)"
            value={settings.height}
            onChange={(val) => onSettingsChange('height', val)}
            min={1}
            max={512}
          />
        </div>
        <Toggle
            label="Lock Aspect Ratio"
            enabled={settings.lockAspectRatio}
            setEnabled={(val) => onSettingsChange('lockAspectRatio', val)}
        />
        <Toggle
            label="Dithering"
            enabled={settings.dithering}
            setEnabled={(val) => onSettingsChange('dithering', val)}
        />
        <Slider
          label="Output Resolution (px/cell)"
          value={settings.outputResolution}
          onChange={(val) => onSettingsChange('outputResolution', val)}
          min={1}
          max={50}
          step={1}
        />
      </div>
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-300">3. Preview Settings</h3>
         <Slider
          label="Opacity"
          value={settings.opacity}
          onChange={(val) => onSettingsChange('opacity', val)}
          min={0}
          max={1}
          step={0.01}
        />
        <Slider
          label="Preview Size"
          value={settings.previewSize}
          onChange={(val) => onSettingsChange('previewSize', val)}
          min={300}
          max={1200}
          step={10}
        />
        <Toggle
            label="Show Grid"
            enabled={settings.showGrid}
            setEnabled={(val) => onSettingsChange('showGrid', val)}
        />
      </div>

      <div className="pt-4 border-t border-gray-700 space-y-3">
        <button
          onClick={onPixelate}
          disabled={isLoading || !sourceImage}
          className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Pixelating...
            </>
          ) : (
            'Generate Pixel Art'
          )}
        </button>
        {pixelatedImage && (
            <button
                onClick={handleDownload}
                className="w-full bg-emerald-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-500 disabled:bg-gray-600 transition-all duration-300 flex items-center justify-center gap-2"
            >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download Image
            </button>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-300">Wplace 64 Color Palette</h3>
        <WplacePalette colors={wplaceColors} />
      </div>
    </aside>
  );
};