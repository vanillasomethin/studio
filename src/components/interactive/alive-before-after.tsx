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
      <h3 className="font-headline text-2xl font-bold mb-2">
        Alive in Action
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-muted-foreground mb-8">
        Slide to see the transformation - before and after Alive
      </p>

      <div
        className="relative mx-auto aspect-video max-w-4xl overflow-hidden rounded-xl shadow-2xl cursor-col-resize select-none"
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
            <div className="absolute top-4 left-4 bg-background/90 text-foreground px-4 py-2 rounded-md font-semibold">
              BEFORE
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
            <div className="absolute top-4 right-4 bg-primary/90 text-primary-foreground px-4 py-2 rounded-md font-semibold">
              AFTER
            </div>
          </div>
        )}

        {/* Slider Handle */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white cursor-col-resize"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
            <div className="flex gap-1">
              <div className="w-0.5 h-4 bg-gray-600"></div>
              <div className="w-0.5 h-4 bg-gray-600"></div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 text-foreground px-4 py-2 rounded-md text-sm font-medium">
          👆 Drag or tap to compare
        </div>
      </div>
    </div>
  );
}
