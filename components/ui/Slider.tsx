
import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export const Slider: React.FC<SliderProps> = ({ label, value, onChange, min = 0, max = 100, step = 1 }) => {
  return (
    <div>
      <label className="flex justify-between items-center text-sm font-medium text-gray-400 mb-1">
        <span>{label}</span>
        <span className="text-white font-semibold bg-gray-700 px-2 py-0.5 rounded">{value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-indigo-500 [&::-moz-range-thumb]:rounded-full"
      />
    </div>
  );
};
