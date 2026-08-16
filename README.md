# Wplace Pixel Art Helper Pro 🎨

A professional pixel art converter tool designed to transform any image into wplace-ready pixel art with advanced features.

## ✨ New Features

### Professional Redesign
- **Modern UI/UX**: Clean, professional interface with intuitive controls
- **Dark/Light Mode**: Toggle between dark and light themes
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### Advanced Image Processing
- **Color Adjustments**: Fine-tune brightness, contrast, and saturation before conversion
- **Enhanced Dithering**: Improved Floyd-Steinberg dithering algorithm for better color transitions
- **Aspect Ratio Lock**: Automatically maintain proportions when resizing
- **High-Quality Downsampling**: Smart averaging algorithm for optimal pixel conversion

### Color Analysis
- **Color Usage Statistics**: See exactly which colors are used and their percentages
- **Top 10 Colors Display**: Quick view of the most dominant colors in your artwork
- **64-Color Wplace Palette**: Full palette reference built-in

### Productivity Features
- **History Management**: Save and reload up to 20 previous conversions
- **Local Storage**: Your history persists across browser sessions
- **Multiple Export Formats**: Download as PNG, JPEG, or WebP
- **Configurable Resolution**: Scale output from 1x to 50x per pixel

### Enhanced Preview
- **Draggable Overlay**: Position your pixel art preview anywhere on screen
- **Adjustable Opacity**: Control preview transparency for easy comparison
- **Grid Overlay**: Optional grid display for precise pixel alignment
- **Zoom Controls**: Adjust preview size from 300px to 1200px

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher recommended)
- Modern web browser with ES6 support

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## 📖 How to Use

1. **Upload an Image**: Drag and drop or click to select any image file (PNG, JPEG, GIF, WebP)

2. **Configure Output Settings**:
   - Set desired width and height in pixels
   - Enable/disable aspect ratio lock
   - Toggle dithering for smoother color transitions
   - Adjust output resolution for final export

3. **Fine-tune Colors** (Optional):
   - Adjust brightness (-100 to +100)
   - Modify contrast (-100 to +100)
   - Change saturation (-100 to +100)

4. **Preview Settings**:
   - Adjust opacity for overlay comparison
   - Toggle grid visibility
   - Resize preview window

5. **Generate & Export**:
   - Click "Generate Pixel Art"
   - Review color usage statistics
   - Choose export format (PNG/JPEG/WebP)
   - Download your pixelated masterpiece!

## 🛠️ Technical Details

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS
- **Canvas API**: For high-performance image processing
- **LocalStorage**: For persistent history storage

## 📝 Notes

- All image processing happens locally in your browser - no server uploads
- The tool uses the official Wplace 64-color palette
- Maximum recommended dimensions: 512x512 pixels for optimal performance

## 📄 License

This project is open source and available for personal and commercial use.

---

Enjoy creating amazing pixel art! 🎮✨
