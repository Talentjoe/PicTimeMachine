import { buildManifest, serializeManifest, parseManifest, type ProjectSettings } from './project';
import type { PhotoPoint } from '../types/photo';
import type { Collection } from '../types/collection';

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

describe('manifest round-trip', () => {
  it('preserves order, descriptions, durations, zoom, dates, ids and collections', () => {
    const manifest = parseManifest(
      serializeManifest(buildManifest(photos, settings, collections, 'full'))
    );

    expect(manifest.version).toBe(2);
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
  });

  it('records the reference mode flag', () => {
    const manifest = buildManifest(photos, settings, collections, 'reference');
    expect(manifest.mode).toBe('reference');
  });

  it('rejects an unrecognised manifest', () => {
    expect(() => parseManifest('{"version":99}')).toThrow();
  });

  it('upgrades a legacy v1 manifest (no collections/zoom)', () => {
    const legacy = JSON.stringify({
      version: 1,
      settings,
      photos: [{ file: 'images/0.jpg', name: 'x.jpg', path: 'x.jpg', description: '', duration: 1, lat: null, lng: null, date: null }],
    });
    const manifest = parseManifest(legacy);
    expect(manifest.version).toBe(2);
    expect(manifest.collections).toEqual([]);
    expect(manifest.photos[0].zoom).toBe(13);
    expect(typeof manifest.photos[0].id).toBe('string');
  });
});
