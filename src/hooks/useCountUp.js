import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Eases a number from its last shown value to `target`. A null target (not
// loaded) and reduced-motion both skip the animation and return the target
// as is.
export function useCountUp(target, duration = 700) {
  const animate = target !== null && !prefersReducedMotion() && typeof requestAnimationFrame === 'function';
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!animate) return undefined;
    const from = fromRef.current;
    const startedAt = performance.now();
    let frame;
    const tick = (now) => {
      // rAF timestamps can precede performance.now() by a frame, which would
      // give a negative progress and a count of -0.
      const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
      const next = Math.round(from + (target - from) * (1 - (1 - progress) ** 3));
      fromRef.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, target, duration]);

  return animate ? shown : target;
}
