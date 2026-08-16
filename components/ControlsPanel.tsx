import React from 'react';
import type { PixelatorSettings, WplaceColor, ColorUsage, ExportFormat, ImageHistoryItem } from '../types';
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
  colorUsage: ColorUsage[];
  onDownload: (format: ExportFormat) => void;
  exportFormat: ExportFormat;
  setExportFormat: (format: ExportFormat) => void;
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
  history: ImageHistoryItem[];
  onLoadFromHistory: (item: ImageHistoryItem) => void;
  onClearHistory: () => void;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  settings,
  onSettingsChange,
  onImageUpload,
  onPixelate,
  isLoading,
  sourceImage,
  pixelatedImage,
  wplaceColors,
  colorUsage,
  onDownload,
  exportFormat,
  setExportFormat,
  darkMode,
  setDarkMode,
  history,
  onLoadFromHistory,
  onClearHistory,
  showHistory,
  setShowHistory
}) => {
  return (
    <aside className={`w-full lg:w-96 p-6 space-y-6 overflow-y-auto h-screen shadow-2xl flex-shrink-0 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="space-y-2 pb-4 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Pixel Art Helper Pro</h2>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
            title="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Convert any image into wplace-ready pixel art.</p>
      </div>

      <div className="space-y-4">
        <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>1. Upload Image</h3>
        <ImageUploader onImageUpload={onImageUpload} />
        {sourceImage && (
            <div className={`p-2 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} rounded-lg`}>
                <img src={sourceImage} alt="Preview" className="max-h-32 w-auto mx-auto rounded" />
            </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>2. Configure Output</h3>
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
        <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>3. Color Adjustments</h3>
        <Slider
          label="Brightness"
          value={settings.brightness}
          onChange={(val) => onSettingsChange('brightness', val)}
          min={-100}
          max={100}
          step={1}
        />
        <Slider
          label="Contrast"
          value={settings.contrast}
          onChange={(val) => onSettingsChange('contrast', val)}
          min={-100}
          max={100}
          step={1}
        />
        <Slider
          label="Saturation"
          value={settings.saturation}
          onChange={(val) => onSettingsChange('saturation', val)}
          min={-100}
          max={100}
          step={1}
        />
      </div>

      <div className="space-y-4">
        <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>4. Preview Settings</h3>
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
          className={`w-full font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center ${
            isLoading || !sourceImage 
              ? 'bg-gray-600 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
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
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                className={`flex-1 p-2 rounded-lg ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'}`}
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
              <button
                onClick={() => onDownload(exportFormat)}
                className="flex-1 bg-emerald-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-500 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download
              </button>
            </div>
          </div>
        )}
      </div>

      {colorUsage.length > 0 && (
        <div className="space-y-4">
          <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Color Usage</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {colorUsage.slice(0, 10).map((usage, index) => (
              <div key={index} className={`flex items-center justify-between p-2 rounded ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: usage.color.hex }}></div>
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{usage.color.name}</span>
                </div>
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {usage.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Wplace 64 Color Palette</h3>
        <WplacePalette colors={wplaceColors} />
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>History ({history.length})</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`px-3 py-1 rounded ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} text-sm`}
            >
              {showHistory ? 'Hide' : 'Show'}
            </button>
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-sm"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {showHistory && history.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => onLoadFromHistory(item)}
                className={`w-full flex items-center gap-2 p-2 rounded ${darkMode ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
              >
                <img src={item.pixelatedImage} alt="History" className="w-12 h-12 rounded object-cover" />
                <div className="text-left flex-1">
                  <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {item.settings.width}x{item.settings.height}
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
