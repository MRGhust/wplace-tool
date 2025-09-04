
import React from 'react';

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export const NumberInput: React.FC<NumberInputProps> = ({ label, value, onChange, min = 1, max = 100, step = 1 }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let num = parseInt(e.target.value, 10);
    if (isNaN(num)) num = min;
    if (num < min) num = min;
    if (num > max) num = max;
    onChange(num);
  };
    
  return (
    <div>
      <label htmlFor={label} className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
      <input
        id={label}
        type="number"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        className="w-full bg-gray-700 border border-gray-600 text-white rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
    </div>
  );
};
