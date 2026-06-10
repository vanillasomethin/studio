'use client';

import { useEffect, useState, useRef } from 'react';

export function useCountUp(end: number, duration: number = 2000, startOnMount: boolean = false) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>();

  const startAnimation = () => {
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      const currentCount = Math.floor(percentage * end);
      setCount(currentCount);

      if (progress < duration) {
        animationFrameId.current = requestAnimationFrame(animate);
      }
    };
    animationFrameId.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (startOnMount) {
        startAnimation();
        return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          startAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      observer.disconnect();
    };
  }, [end, duration, startOnMount]);

  return { count, ref };
}
