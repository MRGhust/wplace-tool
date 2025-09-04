import type { WplaceColor } from './types';

// Fix: Removed obsolete color definitions and logic to resolve variable redeclaration errors.
// The list below is the single source of truth for the Wplace color palette.
export const WPLACE_COLORS: WplaceColor[] = [
    { name: "White", hex: "#FFFFFF" }, { name: "Light Gray 3", hex: "#E4E4E4" }, { name: "Light Gray 2", hex: "#C6C6C6" }, { name: "Light Gray 1", hex: "#A8A8A8" },
    { name: "Gray", hex: "#8A8A8A" }, { name: "Dark Gray 1", hex: "#6C6C6C" }, { name: "Dark Gray 2", hex: "#4E4E4E" }, { name: "Black", hex: "#303030" },
    { name: "Off White", hex: "#FFF4E3" }, { name: "Light Beige", hex: "#FFE8C6" }, { name: "Beige", hex: "#FFDCAB" }, { name: "Dark Beige", hex: "#FFCE8D" },
    { name: "Light Brown", hex: "#E3A062" }, { name: "Brown", hex: "#C67C3A" }, { name: "Dark Brown", hex: "#A85A12" }, { name: "Deep Brown", hex: "#8A3800" },
    { name: "Light Yellow", hex: "#FFFFB3" }, { name: "Yellow", hex: "#FFFF00" }, { name: "Dark Yellow", hex: "#E3E300" }, { name: "Gold", hex: "#C6C600" },
    { name: "Light Lime", hex: "#B3FF00" }, { name: "Lime", hex: "#00FF00" }, { name: "Dark Lime", hex: "#00E300" }, { name: "Green", hex: "#00C600" },
    { name: "Light Green", hex: "#00FFB3" }, { name: "Teal", hex: "#00FF55" }, { name: "Dark Green", hex: "#00E34D" }, { name: "Deep Green", hex: "#00C645" },
    { name: "Light Cyan", hex: "#B3FFFF" }, { name: "Cyan", hex: "#00FFFF" }, { name: "Dark Cyan", hex: "#00E3E3" }, { name: "Turquoise", hex: "#00C6C6" },
    { name: "Light Blue", hex: "#00B3FF" }, { name: "Blue", hex: "#0055FF" }, { name: "Dark Blue", hex: "#004DE3" }, { name: "Deep Blue", hex: "#0045C6" },
    { name: "Light Indigo", hex: "#B300FF" }, { name: "Indigo", hex: "#5500FF" }, { name: "Dark Indigo", hex: "#4D00E3" }, { name: "Deep Indigo", hex: "#4500C6" },
    { name: "Light Magenta", hex: "#FFB3FF" }, { name: "Magenta", hex: "#FF00FF" }, { name: "Dark Magenta", hex: "#E300E3" }, { name: "Deep Magenta", hex: "#C600C6" },
    { name: "Light Pink", hex: "#FF00B3" }, { name: "Pink", hex: "#FF0055" }, { name: "Dark Pink", hex: "#E3004D" }, { name: "Deep Pink", hex: "#C60045" },
    // Fix: Corrected typo `name:-` to `name:` which caused a type error.
    { name: "Light Red", hex: "#FFB3B3" }, { name: "Red", hex: "#FF0000" }, { name: "Dark Red", hex: "#E30000" }, { name: "Deep Red", hex: "#C60000" },
    { name: "Light Orange", hex: "#FFFFB3" }, { name: "Orange", hex: "#FF5500" }, { name: "Dark Orange", hex: "#E34D00" }, { name: "Deep Orange", hex: "#C64500" }
];
