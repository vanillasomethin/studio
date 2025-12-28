'use client';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { useState } from 'react';

const beforeImage = PlaceHolderImages.find((p) => p.id === 'alive-tv-bg');
const afterImage = PlaceHolderImages.find((p) => p.id === 'alive-ad-in-store');

export default function AliveBeforeAfter() {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging && e.type !== 'click') return;

    const container = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const position = ((clientX - container.left) / container.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, position)));
  };

  return (
    <div className="text-center">
      <h3 className="font-headline text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-red-600 bg-clip-text text-transparent">
        ✨ The Alive Effect
      </h3>
      <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground mb-10">
        <span className="font-semibold text-foreground">Experience the transformation:</span> Drag the slider to see how Alive brings stores to life with dynamic digital advertising
      </p>

      <div
        className="relative mx-auto aspect-video max-w-5xl overflow-hidden rounded-2xl shadow-2xl border-4 border-primary/20 cursor-col-resize select-none transition-all hover:border-primary/40 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={handleMove}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
        onTouchMove={handleMove}
        onClick={handleMove}
      >
        {/* BEFORE Image */}
        {beforeImage && (
          <div className="absolute inset-0">
            <Image
              src={beforeImage.imageUrl}
              alt="Before Alive"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute top-6 left-6 bg-gray-900/90 text-white px-5 py-3 rounded-lg font-bold text-lg shadow-lg backdrop-blur-sm">
              ⛔ BEFORE
            </div>
          </div>
        )}

        {/* AFTER Image */}
        {afterImage && (
          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            <Image
              src={afterImage.imageUrl}
              alt="After Alive"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute top-6 right-6 bg-primary/95 text-white px-5 py-3 rounded-lg font-bold text-lg shadow-lg backdrop-blur-sm animate-pulse">
              ✨ AFTER - WITH ALIVE
            </div>
          </div>
        )}

        {/* Slider Handle */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-primary shadow-lg cursor-col-resize"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-primary rounded-full shadow-2xl flex items-center justify-center border-4 border-white hover:scale-110 transition-transform">
            <div className="flex gap-1.5">
              <div className="w-1 h-6 bg-white rounded-full"></div>
              <div className="w-1 h-6 bg-white rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-primary/95 text-white px-6 py-3 rounded-full text-base font-bold shadow-xl backdrop-blur-sm border-2 border-white/20">
          ← Drag to See the Magic →
        </div>
      </div>
    </div>
  );
}
