import { buildManifest, serializeManifest, parseManifest, type ProjectSettings } from './project';
import type { PhotoPoint } from '../types/photo';
import type { Collection } from '../types/collection';
import type { TimelineClip } from '../types/timeline';

const settings: ProjectSettings = { defaultDuration: 1, isChina: true, provider: 'amap' };

const photos: PhotoPoint[] = [
  {
    id: 'a',
    name: 'first.jpg',
    path: 'trip/first.jpg',
    url: 'blob:fake-a',
    description: '起点',
    duration: 2,
    zoom: 15,
    lat: 39.9042,
    lng: 116.4074,
    date: new Date('2024-01-01T08:00:00.000Z'),
  },
  {
    id: 'b',
    name: 'second.jpg',
    path: 'trip/second.jpg',
    url: 'blob:fake-b',
    description: '',
    duration: 1,
    lat: null,
    lng: null,
    date: null,
  },
];

const collections: Collection[] = [
  { id: 'c1', name: '第一天', comment: '北京一日', color: '#e0533d', photoIds: ['a', 'b'] },
];

const timeline: TimelineClip[] = [
  { id: 'clip-1', kind: 'photo', refId: 'a', moveDuration: 1.5, holdDuration: 3, zoom: 16 },
  { id: 'clip-2', kind: 'gap', moveDuration: 0, holdDuration: 2 },
  { id: 'clip-3', kind: 'collection', refId: 'c1', moveDuration: 1, holdDuration: 2 },
  { id: 'clip-4', kind: 'photo', refId: 'a', moveDuration: 1, holdDuration: 2 }, // same photo twice
];

describe('manifest round-trip', () => {
  it('preserves order, descriptions, durations, zoom, dates, ids, collections and timeline', () => {
    const manifest = parseManifest(
      serializeManifest(buildManifest(photos, settings, collections, timeline, 'full'))
    );

    expect(manifest.version).toBe(3);
    expect(manifest.mode).toBe('full');
    expect(manifest.settings).toEqual(settings);
    expect(manifest.collections).toEqual(collections);
    expect(manifest.photos).toHaveLength(2);

    const [a, b] = manifest.photos;
    expect(a.id).toBe('a');
    expect(a.description).toBe('起点');
    expect(a.duration).toBe(2);
    expect(a.zoom).toBe(15);
    expect(a.date).toBe('2024-01-01T08:00:00.000Z');
    expect(a.file).not.toBe(b.file); // collision-free entry names

    expect(b.zoom).toBe(13); // DEFAULT_ZOOM applied to undefined
    expect(b.lat).toBeNull();
    expect(b.date).toBeNull();

    // Timeline round-trips intact, including a photo referenced twice and a gap.
    expect(manifest.timeline).toEqual(timeline);
  });

  it('preserves bin order (the photos array IS the bin order after drag-reorder)', () => {
    const reordered = [photos[1], photos[0]];
    const manifest = parseManifest(
      serializeManifest(buildManifest(reordered, settings, collections, timeline, 'full'))
    );
    expect(manifest.photos.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('records the reference mode flag', () => {
    const manifest = buildManifest(photos, settings, collections, timeline, 'reference');
    expect(manifest.mode).toBe('reference');
  });

  it('rejects an unrecognised or legacy manifest', () => {
    expect(() => parseManifest('{"version":99}')).toThrow();
    expect(() => parseManifest('{"version":2,"photos":[]}')).toThrow();
  });

  it('generates a default timeline (one clip per located photo) when none is stored', () => {
    const raw = JSON.stringify({
      version: 3,
      mode: 'full',
      settings,
      collections: [],
      photos: [
        { id: 'a', file: 'images/0.jpg', name: 'a.jpg', path: 'a.jpg', lat: 1, lng: 2, date: '2024-01-01T00:00:00.000Z' },
        { id: 'b', file: 'images/1.jpg', name: 'b.jpg', path: 'b.jpg', lat: null, lng: null, date: null },
      ],
    });
    const manifest = parseManifest(raw);
    expect(manifest.timeline).toHaveLength(1); // only the located photo
    expect(manifest.timeline[0].kind).toBe('photo');
    expect(manifest.timeline[0].refId).toBe('a');
  });
});
