import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Keeps Leaflet's internal size in sync with the container. Any layout change
 * (divider drag, sidebar flip, aspect-ratio change, fullscreen enter/exit)
 * resizes the map div, and without `invalidateSize` Leaflet renders gray bands
 * and mispositions markers. One debounced ResizeObserver covers all cases.
 */
const InvalidateOnResize: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let timer: number | undefined;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => map.invalidateSize({ pan: false }), 100);
    });
    ro.observe(container);
    return () => {
      window.clearTimeout(timer);
      ro.disconnect();
    };
  }, [map]);

  return null;
};

export default InvalidateOnResize;
