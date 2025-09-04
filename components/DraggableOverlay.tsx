import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PixelatorSettings } from '../types';

interface DraggablePreviewProps {
  imageDataUrl: string;
  settings: PixelatorSettings;
  setSettings: React.Dispatch<React.SetStateAction<PixelatorSettings>>;
}

export const DraggablePreview: React.FC<DraggablePreviewProps> = ({
  imageDataUrl,
  settings,
  setSettings,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return;
    setIsDragging(true);
    const rect = overlayRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    e.preventDefault();
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setSettings(prev => ({
      ...prev,
      previewX: e.clientX - dragOffset.current.x,
      previewY: e.clientY - dragOffset.current.y,
    }));
  }, [isDragging, setSettings]);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const gridCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (settings.showGrid && gridCanvasRef.current) {
        const canvas = gridCanvasRef.current;
        const ctx = canvas.getContext('2d');
        
        const aspect = settings.width > 0 ? settings.height / settings.width : 1;
        const previewWidth = settings.previewSize;
        const previewHeight = previewWidth * aspect;

        canvas.width = previewWidth;
        canvas.height = previewHeight;

        if (ctx) {
            ctx.clearRect(0,0,previewWidth,previewHeight);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;

            const cellWidth = previewWidth / settings.width;
            const cellHeight = previewHeight / settings.height;

            for (let i = 0; i <= settings.width; i++) {
                const x = i * cellWidth;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, previewHeight);
                ctx.stroke();
            }
            for (let i = 0; i <= settings.height; i++) {
                const y = i * cellHeight;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(previewWidth, y);
                ctx.stroke();
            }
        }
    }
  }, [settings.showGrid, settings.width, settings.height, settings.previewSize]);

  const aspect = settings.width > 0 ? settings.height / settings.width : 1;
  const previewWidth = settings.previewSize;
  const previewHeight = previewWidth * aspect;

  return (
    <div
      ref={overlayRef}
      className="absolute border-2 border-dashed border-indigo-400 shadow-2xl"
      style={{
        left: `${settings.previewX}px`,
        top: `${settings.previewY}px`,
        opacity: settings.opacity,
        cursor: isDragging ? 'grabbing' : 'grab',
        width: `${previewWidth}px`,
        height: `${previewHeight}px`,
      }}
      onMouseDown={onMouseDown}
    >
      <img
        src={imageDataUrl}
        alt="Pixelated Output"
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
        draggable={false}
      />
      {settings.showGrid && (
          <canvas
            ref={gridCanvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
      )}
    </div>
  );
};