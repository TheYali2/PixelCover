import React, { useEffect, useRef } from 'react';

interface PixelRevealProps {
  imageUrl: string;
  pixelFactor: number;
  onImageLoad: () => void;
}

const PixelReveal: React.FC<PixelRevealProps> = ({ imageUrl, pixelFactor, onImageLoad }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      imageRef.current = img;
      onImageLoad();
      draw();
    };
  }, [imageUrl]);

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas.getBoundingClientRect();

    canvas.width = width;
    canvas.height = height;

    const scale = Math.max(width / img.width, height / img.height);
    const x = (width / 2) - (img.width / 2) * scale;
    const y = (height / 2) - (img.height / 2) * scale;

    ctx.imageSmoothingEnabled = false;

    if (pixelFactor > 1) {
      const w = width / pixelFactor;
      const h = height / pixelFactor;

      ctx.drawImage(img, 0, 0, w, h);

      ctx.drawImage(canvas, 0, 0, w, h, 0, 0, width, height);
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    }
  };

  useEffect(() => {
    draw();
  }, [pixelFactor]);

  return (
    <div className="relative w-full max-w-sm aspect-square mx-auto rounded-none border-4 border-white/20 shadow-[0_0_30px_rgba(236,72,153,0.3)]">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none bg-[length:100%_4px,3px_100%] pointer-events-none" />
    </div>
  );
};

export default PixelReveal;