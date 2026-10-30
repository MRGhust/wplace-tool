import type { WplaceColor, SamplePreset } from './types';

// Official 64-color Wplace Palette with unique HEX codes, IDs, and color groups
export const WPLACE_COLORS: WplaceColor[] = [
  // Row 1: Monochrome & Neutrals (8)
  { id: 1, name: "Pure White", hex: "#FFFFFF", category: "neutral" },
  { id: 2, name: "Light Gray 3", hex: "#E4E4E4", category: "neutral" },
  { id: 3, name: "Light Gray 2", hex: "#C6C6C6", category: "neutral" },
  { id: 4, name: "Light Gray 1", hex: "#A8A8A8", category: "neutral" },
  { id: 5, name: "Medium Gray", hex: "#8A8A8A", category: "neutral" },
  { id: 6, name: "Dark Gray 1", hex: "#6C6C6C", category: "neutral" },
  { id: 7, name: "Dark Gray 2", hex: "#4E4E4E", category: "neutral" },
  { id: 8, name: "Charcoal", hex: "#303030", category: "neutral" },

  // Row 2: Deep Neutrals & Warm Slate (4) + Creams/Beiges (4)
  { id: 9, name: "Obsidian Black", hex: "#141414", category: "neutral" },
  { id: 10, name: "Cool Slate", hex: "#5A6988", category: "neutral" },
  { id: 11, name: "Steel Gray", hex: "#8B9BB4", category: "neutral" },
  { id: 12, name: "Warm Cream", hex: "#FFF4E3", category: "earth" },
  { id: 13, name: "Light Beige", hex: "#FFE8C6", category: "earth" },
  { id: 14, name: "Sand Beige", hex: "#FFDCAB", category: "earth" },
  { id: 15, name: "Warm Tan", hex: "#FFCE8D", category: "earth" },
  { id: 16, name: "Light Ochre", hex: "#E3A062", category: "earth" },

  // Row 3: Earth & Browns (8)
  { id: 17, name: "Sienna Brown", hex: "#C67C3A", category: "earth" },
  { id: 18, name: "Saddle Brown", hex: "#A85A12", category: "earth" },
  { id: 19, name: "Deep Umber", hex: "#8A3800", category: "earth" },
  { id: 20, name: "Dark Espresso", hex: "#542200", category: "earth" },
  { id: 21, name: "Peach Skin", hex: "#FFCCB3", category: "warm" },
  { id: 22, name: "Coral Blush", hex: "#FF9980", category: "warm" },
  { id: 23, name: "Terracotta", hex: "#D96B43", category: "earth" },
  { id: 24, name: "Rust Red", hex: "#9E3B24", category: "earth" },

  // Row 4: Reds & Oranges (8)
  { id: 25, name: "Light Red", hex: "#FFB3B3", category: "warm" },
  { id: 26, name: "Crimson Red", hex: "#FF0000", category: "warm" },
  { id: 27, name: "Dark Red", hex: "#E30000", category: "warm" },
  { id: 28, name: "Deep Maroon", hex: "#C60000", category: "warm" },
  { id: 29, name: "Apricot Orange", hex: "#FFD180", category: "warm" },
  { id: 30, name: "Vibrant Orange", hex: "#FF5500", category: "warm" },
  { id: 31, name: "Dark Orange", hex: "#E34D00", category: "warm" },
  { id: 32, name: "Burnt Orange", hex: "#C64500", category: "warm" },

  // Row 5: Yellows & Limes (8)
  { id: 33, name: "Pale Lemon", hex: "#FFFFB3", category: "yellow-green" },
  { id: 34, name: "Bright Yellow", hex: "#FFFF00", category: "yellow-green" },
  { id: 35, name: "Golden Yellow", hex: "#E3E300", category: "yellow-green" },
  { id: 36, name: "Olive Gold", hex: "#C6C600", category: "yellow-green" },
  { id: 37, name: "Chartreuse", hex: "#B3FF00", category: "yellow-green" },
  { id: 38, name: "Pure Lime", hex: "#00FF00", category: "yellow-green" },
  { id: 39, name: "Vivid Green", hex: "#00E300", category: "yellow-green" },
  { id: 40, name: "Forest Green", hex: "#00C600", category: "yellow-green" },

  // Row 6: Greens & Cyans (8)
  { id: 41, name: "Mint Green", hex: "#00FFB3", category: "yellow-green" },
  { id: 42, name: "Spring Teal", hex: "#00FF55", category: "yellow-green" },
  { id: 43, name: "Emerald", hex: "#00E34D", category: "yellow-green" },
  { id: 44, name: "Deep Pine", hex: "#00C645", category: "yellow-green" },
  { id: 45, name: "Ice Cyan", hex: "#B3FFFF", category: "cyan-blue" },
  { id: 46, name: "Aqua Cyan", hex: "#00FFFF", category: "cyan-blue" },
  { id: 47, name: "Cerulean Cyan", hex: "#00E3E3", category: "cyan-blue" },
  { id: 48, name: "Deep Turquoise", hex: "#00C6C6", category: "cyan-blue" },

  // Row 7: Blues & Indigos (8)
  { id: 49, name: "Sky Blue", hex: "#00B3FF", category: "cyan-blue" },
  { id: 50, name: "Cobalt Blue", hex: "#0055FF", category: "cyan-blue" },
  { id: 51, name: "Royal Blue", hex: "#004DE3", category: "cyan-blue" },
  { id: 52, name: "Navy Blue", hex: "#0045C6", category: "cyan-blue" },
  { id: 53, name: "Electric Violet", hex: "#B300FF", category: "purple-pink" },
  { id: 54, name: "Indigo", hex: "#5500FF", category: "purple-pink" },
  { id: 55, name: "Dark Indigo", hex: "#4D00E3", category: "purple-pink" },
  { id: 56, name: "Midnight Purple", hex: "#4500C6", category: "purple-pink" },

  // Row 8: Magentas & Pinks (8)
  { id: 57, name: "Orchid Lavender", hex: "#FFB3FF", category: "purple-pink" },
  { id: 58, name: "Magenta", hex: "#FF00FF", category: "purple-pink" },
  { id: 59, name: "Dark Magenta", hex: "#E300E3", category: "purple-pink" },
  { id: 60, name: "Plum Purple", hex: "#C600C6", category: "purple-pink" },
  { id: 61, name: "Hot Pink", hex: "#FF00B3", category: "purple-pink" },
  { id: 62, name: "Rose Pink", hex: "#FF0055", category: "purple-pink" },
  { id: 63, name: "Ruby Pink", hex: "#E3004D", category: "purple-pink" },
  { id: 64, name: "Berry Crimson", hex: "#C60045", category: "purple-pink" },
];

export const PALETTE_PRESETS: { id: string; name: string; filter: (c: WplaceColor) => boolean }[] = [
  { id: 'all', name: 'All 64 Colors', filter: () => true },
  { id: 'mono', name: 'Monochrome (9)', filter: (c) => c.category === 'neutral' && c.id <= 9 },
  { id: 'warm', name: 'Warm & Sunset', filter: (c) => c.category === 'warm' || c.category === 'earth' || c.id === 1 || c.id === 9 },
  { id: 'cool', name: 'Cool & Ocean', filter: (c) => c.category === 'cyan-blue' || c.category === 'purple-pink' || c.id === 1 || c.id === 9 },
  { id: 'retro16', name: 'Classic 16-Bit', filter: (c) => [1, 4, 7, 9, 17, 26, 30, 34, 38, 44, 46, 50, 52, 54, 58, 62].includes(c.id) },
];

// Procedural high-contrast canvas sample generators so users can test immediately
export const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'sunset-peaks',
    name: 'Alpine Sunset',
    subtitle: 'Gradient sky, sun disc & layered mountain peaks',
    width: 64,
    height: 64,
    generateDataUrl: () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, 180);
      sky.addColorStop(0, '#4500C6');
      sky.addColorStop(0.35, '#C60045');
      sky.addColorStop(0.7, '#FF5500');
      sky.addColorStop(1, '#FFFF00');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 256, 256);

      // Sun
      ctx.fillStyle = '#FFFFB3';
      ctx.beginPath();
      ctx.arc(128, 115, 46, 0, Math.PI * 2);
      ctx.fill();

      // Far mountains
      ctx.fillStyle = '#5500FF';
      ctx.beginPath();
      ctx.moveTo(0, 190);
      ctx.lineTo(55, 110);
      ctx.lineTo(115, 165);
      ctx.lineTo(185, 95);
      ctx.lineTo(256, 175);
      ctx.lineTo(256, 256);
      ctx.lineTo(0, 256);
      ctx.fill();

      // Near mountains
      ctx.fillStyle = '#141414';
      ctx.beginPath();
      ctx.moveTo(0, 210);
      ctx.lineTo(85, 135);
      ctx.lineTo(150, 195);
      ctx.lineTo(215, 140);
      ctx.lineTo(256, 190);
      ctx.lineTo(256, 256);
      ctx.lineTo(0, 256);
      ctx.fill();

      // Water reflection stripes
      ctx.fillStyle = '#0045C6';
      ctx.fillRect(0, 205, 256, 51);
      ctx.fillStyle = '#FF5500';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(90 + i * 4, 212 + i * 7, 76 - i * 8, 3);
      }
      return c.toDataURL('image/png');
    }
  },
  {
    id: 'arcade-bot',
    name: 'Mecha Companion',
    subtitle: 'Crisp retro character sprite with glowing visor',
    width: 48,
    height: 48,
    generateDataUrl: () => {
      const c = document.createElement('canvas');
      c.width = 240;
      c.height = 240;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#0045C6';
      ctx.fillRect(0, 0, 240, 240);

      // Background grid circle
      ctx.fillStyle = '#0055FF';
      ctx.beginPath();
      ctx.arc(120, 120, 95, 0, Math.PI * 2);
      ctx.fill();

      // Antenna
      ctx.fillStyle = '#FF0055';
      ctx.fillRect(114, 22, 12, 32);
      ctx.fillStyle = '#FFFF00';
      ctx.beginPath();
      ctx.arc(120, 20, 12, 0, Math.PI * 2);
      ctx.fill();

      // Robot Head
      ctx.fillStyle = '#E4E4E4';
      ctx.fillRect(55, 52, 130, 105);
      ctx.strokeStyle = '#141414';
      ctx.lineWidth = 8;
      ctx.strokeRect(55, 52, 130, 105);

      // Visor
      ctx.fillStyle = '#141414';
      ctx.fillRect(72, 74, 96, 44);

      // Glowing Cyan Eyes
      ctx.fillStyle = '#00FFFF';
      ctx.fillRect(84, 86, 24, 20);
      ctx.fillRect(132, 86, 24, 20);

      // Cheek bolts
      ctx.fillStyle = '#FF5500';
      ctx.fillRect(42, 90, 13, 28);
      ctx.fillRect(185, 90, 13, 28);

      // Body
      ctx.fillStyle = '#A8A8A8';
      ctx.fillRect(70, 158, 100, 62);
      ctx.strokeRect(70, 158, 100, 62);

      // Chest core
      ctx.fillStyle = '#00FF55';
      ctx.fillRect(102, 174, 36, 30);
      return c.toDataURL('image/png');
    }
  },
  {
    id: 'isometric-citadel',
    name: 'Isometric Cube',
    subtitle: '3D geometric faces for testing color shading & dithering',
    width: 64,
    height: 64,
    generateDataUrl: () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, 256, 256);

      const cx = 128, cy = 128, r = 92;
      // Top face
      const gTop = ctx.createLinearGradient(cx, cy - r, cx, cy);
      gTop.addColorStop(0, '#00FFFF');
      gTop.addColorStop(1, '#00B3FF');
      ctx.fillStyle = gTop;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.866, cy - r * 0.5);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx - r * 0.866, cy - r * 0.5);
      ctx.closePath();
      ctx.fill();

      // Left face
      const gLeft = ctx.createLinearGradient(cx - r, cy, cx, cy + r);
      gLeft.addColorStop(0, '#0055FF');
      gLeft.addColorStop(1, '#4500C6');
      ctx.fillStyle = gLeft;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.866, cy - r * 0.5);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r * 0.866, cy + r * 0.5);
      ctx.closePath();
      ctx.fill();

      // Right face
      const gRight = ctx.createLinearGradient(cx, cy, cx + r, cy + r);
      gRight.addColorStop(0, '#FF0055');
      gRight.addColorStop(1, '#8A3800');
      ctx.fillStyle = gRight;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * 0.866, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.866, cy + r * 0.5);
      ctx.lineTo(cx, cy + r);
      ctx.closePath();
      ctx.fill();

      return c.toDataURL('image/png');
    }
  }
];

