import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './icons'; // registers the default Leaflet marker icon (side effect)
import { MarkerClusterLayer } from './MarkerClusterLayer';
import FocusOnMarkers from './FocusOnMarkers';
import FitBounds from './FitBounds';
import CollectionsLayer, { type CollectionShape } from './CollectionsLayer';
import { selectTileSource, type ChinaProvider } from './tileSources';
import { wgs84ToGcj02 } from '../../lib/geo';
import { prefetchTiles } from '../../lib/tilePrefetch';
import type { LocatedPhoto } from '../../types/photo';
import type { Collection } from '../../types/collection';

/**
 * What the map should frame right now, driven by the current timeline clip:
 * - `overview` — fit all located bin photos (editing / no playback).
 * - `photo` — fly to a single photo at `zoom` over `moveDuration` seconds.
 * - `collection` — fit-bounds over a collection's members + draw its hull.
 */
export type ViewTarget =
  | { kind: 'overview' }
  | { kind: 'photo'; photoId: string; zoom: number; moveDuration: number; animate: boolean }
  | { kind: 'collection'; collectionId: string; moveDuration: number; animate: boolean };

interface MapViewProps {
  /** All located bin photos (drawn as context markers in every mode). */
  images: LocatedPhoto[];
  /** Current framing target. */
  target: ViewTarget;
  isChina: boolean;
  provider: ChinaProvider;
  /** Called when the user edits a photo's description in its popup. */
  onDescriptionChange?: (id: string, description: string) => void;
  /** All collections (used to resolve a collection target's hull). */
  collections?: Collection[];
  onSelectCollection?: (id: string) => void;
  /** Next clip's target (WGS-84) whose tiles to warm; null to skip prefetch. */
  prefetch?: { lat: number; lng: number; zoom: number } | null;
}

/** Re-projects WGS-84 coords to GCJ-02 when the active basemap requires it. */
function project(images: LocatedPhoto[], gcj02: boolean): LocatedPhoto[] {
  if (!gcj02) return images;
  return images.map((img) => {
    const [lat, lng] = wgs84ToGcj02(img.lat, img.lng);
    return { ...img, lat, lng };
  });
}

const MapView: React.FC<MapViewProps> = ({
  images,
  target,
  isChina,
  provider,
  onDescriptionChange,
  collections,
  onSelectCollection,
  prefetch,
}) => {
  const source = selectTileSource(isChina, provider);
  const displayImages = useMemo(() => project(images, source.gcj02), [images, source.gcj02]);
  const idToDisplay = useMemo(
    () => new Map(displayImages.map((img) => [img.id, img] as const)),
    [displayImages]
  );
  const allPositions = useMemo(
    () => displayImages.map((img) => [img.lat, img.lng] as [number, number]),
    [displayImages]
  );

  // The single collection a 'collection' target refers to, with hull points.
  const collectionShapes = useMemo<CollectionShape[]>(() => {
    if (target.kind !== 'collection' || !collections) return [];
    const col = collections.find((c) => c.id === target.collectionId);
    if (!col) return [];
    const points = col.photoIds
      .map((id) => idToDisplay.get(id))
      .filter((p): p is LocatedPhoto => p !== undefined)
      .map((p) => [p.lat, p.lng] as [number, number]);
    return [{ collection: col, points }];
  }, [target, collections, idToDisplay]);

  const collectionPositions = collectionShapes[0]?.points ?? [];
  const highlightId = target.kind === 'photo' ? target.photoId : null;

  // Warm tiles for the upcoming clip's location (best-effort preload).
  const pf = prefetch
    ? source.gcj02
      ? wgs84ToGcj02(prefetch.lat, prefetch.lng)
      : ([prefetch.lat, prefetch.lng] as [number, number])
    : null;
  const pfLat = pf ? pf[0] : null;
  const pfLng = pf ? pf[1] : null;
  const pfZoom = prefetch?.zoom ?? null;
  useEffect(() => {
    if (pfLat == null || pfLng == null || pfZoom == null) return;
    prefetchTiles({ url: source.url, subdomains: source.subdomains, lat: pfLat, lng: pfLng, zoom: pfZoom });
  }, [pfLat, pfLng, pfZoom, source.url, source.subdomains]);

  let framing: React.ReactNode;
  if (target.kind === 'photo') {
    const p = idToDisplay.get(target.photoId);
    framing = (
      <FocusOnMarkers
        point={p ? { lat: p.lat, lng: p.lng, zoom: target.zoom } : null}
        moveDuration={target.moveDuration}
        animate={target.animate}
      />
    );
  } else if (target.kind === 'collection') {
    framing = (
      <FitBounds positions={collectionPositions} duration={target.animate ? target.moveDuration : undefined} />
    );
  } else {
    framing = <FitBounds positions={allPositions} />;
  }

  return (
    <MapContainer center={[0, 0]} zoom={3} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        key={source.key}
        url={source.url}
        attribution={source.attribution}
        {...(source.subdomains ? { subdomains: source.subdomains } : {})}
      />

      <MarkerClusterLayer
        images={displayImages}
        highlightId={highlightId}
        openHighlightPopup={false}
        onDescriptionChange={onDescriptionChange}
      />

      {target.kind === 'collection' && (
        <CollectionsLayer shapes={collectionShapes} onSelectCollection={onSelectCollection} />
      )}

      {framing}
    </MapContainer>
  );
};

export default MapView;
