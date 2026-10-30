import React from 'react';
import type { WplaceColor } from '../types';
import { PALETTE_PRESETS } from '../constants';

interface WplacePaletteProps {
  colors: WplaceColor[];
  activeBrushColor: WplaceColor;
  onSelectBrushColor: (color: WplaceColor) => void;
  disabledHexes: Set<string>;
  onToggleColorEnabled: (hex: string) => void;
  onApplyPreset: (presetId: string) => void;
  highlightedHex: string | null;
  onSelectHighlightHex: (hex: string | null) => void;
  mode: 'brush' | 'filter';
  setMode: (mode: 'brush' | 'filter') => void;
}

export const WplacePalette: React.FC<WplacePaletteProps> = ({
  colors,
  activeBrushColor,
  onSelectBrushColor,
  disabledHexes,
  onToggleColorEnabled,
  onApplyPreset,
  highlightedHex,
  onSelectHighlightHex,
  mode,
  setMode,
}) => {
  const enabledCount = colors.length - disabledHexes.size;

  return (
    <div className="space-y-3">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg border border-slate-200 dark:border-slate-700/70 w-full">
          <button
            type="button"
            onClick={() => setMode('brush')}
            className={`flex-1 py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'brush'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Brush & Inspect
          </button>
          <button
            type="button"
            onClick={() => setMode('filter')}
            className={`flex-1 py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'filter'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Filter Palette ({enabledCount}/64)
          </button>
        </div>
      </div>

      {mode === 'filter' && (
        <div className="flex flex-wrap gap-1.5">
          {PALETTE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset.id)}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}

      {/* 8x8 Official Wplace Grid */}
      <div className="grid grid-cols-8 gap-1.5 p-2.5 bg-slate-100 dark:bg-slate-900/90 rounded-lg border border-slate-200 dark:border-slate-800">
        {colors.map((color) => {
          const isDisabled = disabledHexes.has(color.hex);
          const isSelectedBrush = activeBrushColor.hex === color.hex;
          const isHighlighted = highlightedHex === color.hex;

          return (
            <button
              key={color.id}
              type="button"
              onClick={() => {
                if (mode === 'filter') {
                  onToggleColorEnabled(color.hex);
                } else {
                  onSelectBrushColor(color);
                }
              }}
              onDoubleClick={() => {
                onSelectHighlightHex(isHighlighted ? null : color.hex);
              }}
              className={`relative w-full aspect-square rounded transition-transform duration-150 focus:outline-none ${
                mode === 'brush' && isSelectedBrush
                  ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-110 z-10'
                  : 'hover:scale-105'
              } ${
                isHighlighted
                  ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900 z-10'
                  : ''
              } ${isDisabled && mode === 'filter' ? 'opacity-25 scale-90' : ''}`}
              style={{ backgroundColor: color.hex }}
              title={`#${color.id} ${color.name} (${color.hex})${
                mode === 'filter'
                  ? isDisabled
                    ? ' — Click to enable'
                    : ' — Click to disable'
                  : ' — Click to select brush, Double-click to isolate on canvas'
              }`}
            >
              {isDisabled && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
                  ×
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Color Footer Info */}
      <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-4 h-4 rounded border border-black/15 dark:border-white/15 shrink-0"
            style={{ backgroundColor: activeBrushColor.hex }}
          />
          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
            #{activeBrushColor.id} {activeBrushColor.name}
          </span>
        </div>
        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
          {activeBrushColor.hex}
        </span>
      </div>
    </div>
  );
};

