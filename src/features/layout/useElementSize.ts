import { useEffect, useState } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Observes an element's content size via ResizeObserver. Returns a ref
 * callback to attach to the element and the latest size (0×0 until attached).
 *
 * The element lives in state and the observer is created inside an effect
 * keyed on it — so StrictMode's simulated unmount/remount (which runs effect
 * cleanups synchronously, before the observer's async first delivery) safely
 * recreates the observer instead of leaving it permanently disconnected.
 */
export default function useElementSize<T extends HTMLElement = HTMLDivElement>(): [
  (el: T | null) => void,
  ElementSize
] {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    if (!element) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height }
      );
    });
    ro.observe(element);
    return () => ro.disconnect();
  }, [element]);

  return [setElement, size];
}
