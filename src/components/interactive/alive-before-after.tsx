'use client';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { useState, useRef, useCallback } from 'react';

const beforeImage = PlaceHolderImages.find((p) => p.id === 'alive-tv-bg');
const afterImage  = PlaceHolderImages.find((p) => p.id === 'alive-ad-in-store');

export default function AliveBeforeAfter() {
  const [pos, setPos]           = useState(48);
  const [dragging, setDragging] = useState(false);
  const containerRef            = useRef<HTMLDivElement>(null);

  const updatePos = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    setPos(Math.max(2, Math.min(98, ((clientX - left) / width) * 100)));
  }, []);

  return (
    <div style={{ maxWidth: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontFamily: '"DM Mono", monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', opacity: 0.35 }}>
        <span>Without</span>
        <span>With Alive</span>
      </div>

      <div
        ref={containerRef}
        style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', background: '#000', cursor: 'col-resize', userSelect: 'none' }}
        onMouseDown={(e) => { setDragging(true); updatePos(e.clientX); }}
        onMouseMove={(e) => { if (dragging) updatePos(e.clientX); }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onTouchStart={(e) => { setDragging(true); updatePos(e.touches[0].clientX); }}
        onTouchMove={(e) => updatePos(e.touches[0].clientX)}
        onTouchEnd={() => setDragging(false)}
      >
        {/* Before */}
        {beforeImage && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <Image src={beforeImage.imageUrl} alt="Before" fill style={{ objectFit: 'cover' }} priority />
          </div>
        )}

        {/* After — clipped to the left of divider */}
        {afterImage && (
          <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
            <Image src={afterImage.imageUrl} alt="After Alive" fill style={{ objectFit: 'cover' }} priority />
          </div>
        )}

        {/* Divider line + handle */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.6)', left: `${pos}%` }}>
          <div
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 28, height: 28, borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
            }}
          >
            <span style={{ width: 1, height: 12, background: 'rgba(0,0,0,0.22)', borderRadius: 1 }} />
            <span style={{ width: 1, height: 12, background: 'rgba(0,0,0,0.22)', borderRadius: 1 }} />
          </div>
        </div>
      </div>

      <p style={{ marginTop: 12, textAlign: 'center', fontFamily: '"DM Mono", monospace', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', opacity: 0.28 }}>
        Drag to compare
      </p>
    </div>
  );
}
