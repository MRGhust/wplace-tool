import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { pixelate } from './services/pixelator';
import type { PixelatorSettings, ImageHistoryItem, ColorUsage, ExportFormat } from './types';
import { WPLACE_COLORS } from './constants';

// Icons as simple SVG components
const SunIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const MoonIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const UploadIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const HistoryIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

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
  const [activeSection, setActiveSection] = useState<string | null>('upload');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const [settings, setSettings] = useState<PixelatorSettings>({
    width: 64,
    height: 64,
    previewX: 50,
    previewY: 50,
    opacity: 0.8,
    showGrid: false,
    previewSize: 500,
    outputResolution: 10,
    dithering: true,
    lockAspectRatio: true,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    zoom: 1,
    darkMode: true,
  });
  
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
    
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pixelArtHistory', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSourceImage(result);
      setPixelatedImage(null);
      setColorUsage([]);
      setError(null);

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

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  }, []);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
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
      
      const historyItem: ImageHistoryItem = {
        id: Date.now().toString(),
        sourceImage,
        pixelatedImage: result.dataUrl,
        settings: { ...settings },
        timestamp: Date.now()
      };
      setHistory(prev => [historyItem, ...prev].slice(0, 20));
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

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const link = document.createElement('a');
      link.href = canvas.toDataURL(`image/${format}`);
      link.download = `pixel-art.${format}`;
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

  const handlePreviewMouseDown = (e: React.MouseEvent) => {
    if (!previewContainerRef.current || !pixelatedImage) return;
    setIsDragging(true);
    const rect = previewContainerRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePreviewMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !previewContainerRef.current) return;
    const containerRect = previewContainerRef.current.getBoundingClientRect();
    const newX = ((e.clientX - dragOffset.current.x) / containerRect.width) * 100;
    const newY = ((e.clientY - dragOffset.current.y) / containerRect.height) * 100;
    setPreviewPosition({
      x: Math.max(0, Math.min(100, newX)),
      y: Math.max(0, Math.min(100, newY)),
    });
  }, [isDragging]);

  const handlePreviewMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handlePreviewMouseMove);
      window.addEventListener('mouseup', handlePreviewMouseUp);
      return () => {
        window.removeEventListener('mousemove', handlePreviewMouseMove);
        window.removeEventListener('mouseup', handlePreviewMouseUp);
      };
    }
  }, [isDragging, handlePreviewMouseMove, handlePreviewMouseUp]);

  const memoizedWplaceColors = useMemo(() => WPLACE_COLORS, []);

  const SectionHeader: React.FC<{ title: string; icon?: React.ReactNode; section: string }> = ({ title, icon, section }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-medium text-gray-700 dark:text-gray-200">{title}</span>
      </div>
      <div className={`transform transition-transform duration-200 ${activeSection === section ? 'rotate-180' : ''}`}>
        <ChevronDownIcon />
      </div>
    </button>
  );

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'dark' : ''}`}>
      {/* Header */}
      <header className="sticky top-0 z-50 glass bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <SparklesIcon />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Pixel Art Studio
              </h1>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 lg:w-96 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
          <div className="p-4 space-y-2">
            {/* Upload Section */}
            <div className="card">
              <SectionHeader 
                title="Upload Image" 
                section="upload"
                icon={<UploadIcon />}
              />
              {activeSection === 'upload' && (
                <div className="pt-2 animate-fadeIn">
                  <div
                    onDrop={handleFileDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={handleFileSelect}
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <UploadIcon />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Drop an image or click to browse
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          PNG, JPG, GIF, WebP
                        </p>
                      </div>
                    </div>
                  </div>
                  {sourceImage && (
                    <div className="mt-4 relative group">
                      <img src={sourceImage} alt="Source" className="w-full h-32 object-cover rounded-lg" />
                      <button
                        onClick={() => { setSourceImage(null); setPixelatedImage(null); }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Settings Section */}
            <div className="card">
              <SectionHeader 
                title="Settings" 
                section="settings"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              />
              {activeSection === 'settings' && (
                <div className="pt-2 space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Width</label>
                      <input
                        type="number"
                        value={settings.width}
                        onChange={(e) => handleSettingsChange('width', parseInt(e.target.value) || 1)}
                        min={1}
                        max={512}
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Height</label>
                      <input
                        type="number"
                        value={settings.height}
                        onChange={(e) => handleSettingsChange('height', parseInt(e.target.value) || 1)}
                        min={1}
                        max={512}
                        className="input-field text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Lock Aspect Ratio</span>
                      <input
                        type="checkbox"
                        checked={settings.lockAspectRatio}
                        onChange={(e) => handleSettingsChange('lockAspectRatio', e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Dithering</span>
                      <input
                        type="checkbox"
                        checked={settings.dithering}
                        onChange={(e) => handleSettingsChange('dithering', e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                    </label>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Output Resolution</label>
                      <span className="text-xs text-gray-600 dark:text-gray-400">{settings.outputResolution}px</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={settings.outputResolution}
                      onChange={(e) => handleSettingsChange('outputResolution', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Adjustments Section */}
            <div className="card">
              <SectionHeader 
                title="Adjustments" 
                section="adjustments"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                }
              />
              {activeSection === 'adjustments' && (
                <div className="pt-2 space-y-4 animate-fadeIn">
                  {[
                    { label: 'Brightness', key: 'brightness' as const, min: -100, max: 100 },
                    { label: 'Contrast', key: 'contrast' as const, min: -100, max: 100 },
                    { label: 'Saturation', key: 'saturation' as const, min: -100, max: 100 },
                  ].map(({ label, key, min, max }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-2">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
                        <span className="text-xs text-gray-600 dark:text-gray-400">{settings[key]}</span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        value={settings[key]}
                        onChange={(e) => handleSettingsChange(key, parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={runPixelation}
              disabled={isLoading || !sourceImage}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <SparklesIcon />
                  Generate Pixel Art
                </>
              )}
            </button>

            {/* Download Section */}
            {pixelatedImage && (
              <div className="card animate-fadeIn">
                <div className="flex gap-2">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                    className="input-field text-sm flex-1"
                  >
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WebP</option>
                  </select>
                  <button
                    onClick={() => handleDownload(exportFormat)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <DownloadIcon />
                    Download
                  </button>
                </div>
              </div>
            )}

            {/* Color Usage */}
            {colorUsage.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Top Colors</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {colorUsage.slice(0, 5).map((usage, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: usage.color.hex }} />
                        <span className="text-gray-600 dark:text-gray-400">{usage.color.name}</span>
                      </div>
                      <span className="text-gray-500 dark:text-gray-500">{usage.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History Section */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <HistoryIcon />
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">History</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">({history.length})</span>
                </div>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs text-red-500 hover:text-red-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              {history.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {history.slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all"
                    >
                      <img src={item.pixelatedImage} alt="History" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Canvas Area */}
        <div 
          ref={previewContainerRef}
          className="flex-1 bg-grid-pattern relative overflow-hidden"
          onMouseDown={handlePreviewMouseDown}
        >
          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
              <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
                {error}
              </div>
            </div>
          )}

          {!sourceImage && !pixelatedImage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UploadIcon />
                </div>
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Get Started
                </h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                  Upload an image to convert it into beautiful pixel art using the Wplace color palette
                </p>
              </div>
            </div>
          )}

          {pixelatedImage && (
            <div
              className="absolute transition-opacity duration-200"
              style={{
                left: `${previewPosition.x}%`,
                top: `${previewPosition.y}%`,
                transform: 'translate(-50%, -50%)',
                opacity: settings.opacity,
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
            >
              <div className="relative">
                <img
                  src={pixelatedImage}
                  alt="Pixelated"
                  className="rounded-lg shadow-2xl"
                  style={{ 
                    width: `${settings.previewSize}px`,
                    imageRendering: 'pixelated' 
                  }}
                  draggable={false}
                />
                {settings.showGrid && (
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255,255,255,0.3) 1px, transparent 1px)
                      `,
                      backgroundSize: `${settings.previewSize / settings.width}px ${settings.previewSize / settings.height * (settings.height / settings.width)}px`
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Preview Controls */}
          {pixelatedImage && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 glass bg-white/90 dark:bg-gray-800/90 rounded-full px-4 py-2 flex items-center gap-4 shadow-lg">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-400">Size</label>
                <input
                  type="range"
                  min={200}
                  max={800}
                  value={settings.previewSize}
                  onChange={(e) => handleSettingsChange('previewSize', parseInt(e.target.value))}
                  className="w-24"
                />
              </div>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showGrid}
                  onChange={(e) => handleSettingsChange('showGrid', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">Grid</span>
              </label>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-400">Opacity</label>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={settings.opacity}
                  onChange={(e) => handleSettingsChange('opacity', parseFloat(e.target.value))}
                  className="w-20"
                />
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default App;
