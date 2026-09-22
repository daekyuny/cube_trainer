import { useLayoutEffect, useRef } from 'react';

// Measure the current (possibly still animating) heights before selecting a new
// option, then interpolate to the committed layout without delaying cube state.
export function useLessonTransition(selection: string) {
  const container = useRef<HTMLDivElement>(null);
  const before = useRef(new Map<string, number>());
  const animations = useRef<Animation[]>([]);
  const prepare = () => {
    before.current.clear();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    container.current
      ?.querySelectorAll<HTMLElement>('.lesson-item')
      .forEach((item) => {
        before.current.set(
          item.dataset.case!,
          item.getBoundingClientRect().height,
        );
      });
  };
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cancel = () => {
      animations.current.forEach((animation) => animation.cancel());
      animations.current = [];
    };
    cancel();
    if (!reduced.matches) {
      const timing = {
        duration: 200,
        easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
      };
      root.querySelectorAll<HTMLElement>('.lesson-item').forEach((item) => {
        const height = before.current.get(item.dataset.case!);
        if (height === undefined) return;
        const target = item.getBoundingClientRect().height;
        if (Math.abs(height - target) > 1)
          animations.current.push(
            item.animate(
              [{ height: `${height}px` }, { height: `${target}px` }],
              timing,
            ),
          );
      });
      const content = root.querySelector('.lesson-expanded');
      if (before.current.size && content)
        animations.current.push(
          content.animate([{ opacity: 0.35 }, { opacity: 1 }], timing),
        );
    }
    before.current.clear();
    // Respect a motion preference changed while a transition is in progress.
    reduced.addEventListener('change', cancel);
    return () => {
      reduced.removeEventListener('change', cancel);
      cancel();
    };
  }, [selection]);
  return { container, prepare };
}
