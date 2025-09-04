
import React from 'react';
import type { WplaceColor } from '../types';

interface WplacePaletteProps {
  colors: WplaceColor[];
}

export const WplacePalette: React.FC<WplacePaletteProps> = ({ colors }) => {
  return (
    <div className="grid grid-cols-8 gap-2 p-2 bg-gray-900 rounded-lg">
      {colors.map((color, index) => (
        <div
          key={`${color.hex}-${index}`}
          className="w-full aspect-square rounded"
          style={{ backgroundColor: color.hex }}
          title={`${color.name} (${color.hex})`}
        />
      ))}
    </div>
  );
};
