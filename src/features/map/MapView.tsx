import { useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './icons'; // registers the default Leaflet marker icon (side effect)
import { MarkerClusterLayer } from './MarkerClusterLayer';
import FocusOnMarkers from './FocusOnMarkers';
import FitBounds from './FitBounds';
import { selectTileSource, type ChinaProvider } from './tileSources';
import { wgs84ToGcj02 } from '../../lib/geo';
import type { LocatedPhoto } from '../../types/photo';

interface MapViewProps {
  /** All currently-visible photos (already filtered to located ones). */
  images: LocatedPhoto[];
  /** The photo(s) to focus during playback (typically the latest single one). */
  focusImages: LocatedPhoto[];
  /** Whether to render the latest image as the highlighted red marker. */
  highlight: boolean;
  /** "Show all" framing (FitBounds) vs. playback framing (FocusOnMarkers). */
  showAll: boolean;
  isChina: boolean;
  provider: ChinaProvider;
  /** Called when the user edits a photo's description in its popup. */
  onDescriptionChange?: (id: string, description: string) => void;
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
  focusImages,
  highlight,
  showAll,
  isChina,
  provider,
  onDescriptionChange,
}) => {
  const source = selectTileSource(isChina, provider);
  const displayImages = useMemo(() => project(images, source.gcj02), [images, source.gcj02]);
  const displayFocus = useMemo(() => project(focusImages, source.gcj02), [focusImages, source.gcj02]);

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
        highlight={highlight}
        onDescriptionChange={onDescriptionChange}
      />

      {showAll ? (
        <FitBounds positions={displayImages.map((img) => [img.lat, img.lng])} />
      ) : (
        <FocusOnMarkers points={displayFocus} />
      )}
    </MapContainer>
  );
};

export default MapView;
