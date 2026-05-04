'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';

export default function BeforeAfter() {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.buttons === 0 && e.type === 'pointermove') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setPos(x);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  return (
    <section id="features" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            <span className="text-primary">Experience</span> Alive in Action
          </h2>
          <p className="text-lg text-muted-foreground">
            See how an Alive screen transforms a kirana shelf into a discovery moment.
          </p>
        </div>

        <div
          ref={containerRef}
          className="relative mx-auto overflow-hidden rounded-xl select-none cursor-ew-resize"
          style={{ maxWidth: 880, aspectRatio: '16/10' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          {/* After image (base layer) */}
          <Image
            src="/alive_after.png"
            alt="Kirana store with Alive screen"
            fill
            className="object-cover"
            draggable={false}
          />

          {/* Before image (clipped overlay) */}
          <div
            style={{ position: 'absolute', inset: 0, width: `${pos}%`, overflow: 'hidden' }}
          >
            <Image
              src="/alive_before.png"
              alt="Kirana store without Alive screen"
              fill
              className="object-cover"
              style={{ width: `${(100 / pos) * 100}%`, maxWidth: 'none', objectFit: 'cover' }}
              draggable={false}
            />
          </div>

          {/* Divider line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${pos}%`,
              width: 2,
              background: 'hsl(var(--primary))',
              pointerEvents: 'none',
              transform: 'translateX(-50%)',
            }}
          >
            {/* Handle circle */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 40,
                height: 40,
                borderRadius: 999,
                background: 'hsl(var(--primary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(220,38,38,0.4)',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              ⟺
            </div>
          </div>

          {/* Labels */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              background: 'rgba(10,10,10,0.8)',
              color: '#fafafa',
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              pointerEvents: 'none',
            }}
          >
            Before
          </div>
          <div
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'hsl(var(--primary))',
              color: '#fafafa',
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              pointerEvents: 'none',
            }}
          >
            With Alive
          </div>
        </div>
      </div>
    </section>
  );
}
