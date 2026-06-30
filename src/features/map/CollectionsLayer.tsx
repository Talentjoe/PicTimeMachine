import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import { convexHull } from '../../lib/hull';
import type { Collection } from '../../types/collection';

/** A collection paired with its members' already-projected coordinates. */
export interface CollectionShape {
  collection: Collection;
  /** Member coordinates in the active basemap datum ([lat, lng]). */
  points: [number, number][];
}

interface CollectionsLayerProps {
  shapes: CollectionShape[];
  onSelectCollection?: (id: string) => void;
}

/**
 * Draws each collection's geographic range as a convex-hull polygon (imperative
 * Leaflet side effect; renders null). Collections with fewer than 3 located
 * members can't form a polygon and are skipped (their photo markers still show
 * via MarkerClusterLayer). The popup shows the collection name + comment.
 */
const CollectionsLayer: React.FC<CollectionsLayerProps> = ({ shapes, onSelectCollection }) => {
  const map = useMap();

  useEffect(() => {
    const layers: L.Layer[] = [];

    shapes.forEach(({ collection, points }) => {
      const hull = convexHull(points);
      if (hull.length < 3) return;

      const polygon = L.polygon(hull, {
        color: collection.color,
        weight: 2,
        fillColor: collection.color,
        fillOpacity: 0.15,
      });

      const popup = document.createElement('div');
      popup.className = 'collection-popup';
      const title = document.createElement('strong');
      title.textContent = collection.name;
      const comment = document.createElement('div');
      comment.className = 'collection-popup__comment';
      comment.textContent = collection.comment;
      popup.append(title, comment);
      polygon.bindPopup(popup);

      if (onSelectCollection) {
        polygon.on('click', () => onSelectCollection(collection.id));
      }

      polygon.addTo(map);
      layers.push(polygon);
    });

    return () => {
      layers.forEach((layer) => map.removeLayer(layer));
    };
  }, [map, shapes, onSelectCollection]);

  return null;
};

export default CollectionsLayer;
