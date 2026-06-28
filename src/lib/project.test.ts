import { buildManifest, serializeManifest, parseManifest, type ProjectSettings } from './project';
import type { PhotoPoint } from '../types/photo';

const settings: ProjectSettings = { defaultDuration: 1, isChina: true, provider: 'amap' };

const photos: PhotoPoint[] = [
  {
    id: 'a',
    name: 'first.jpg',
    path: 'trip/first.jpg',
    url: 'blob:fake-a',
    description: '起点',
    duration: 2,
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

describe('manifest round-trip', () => {
  it('preserves order, descriptions, durations and dates', () => {
    const manifest = parseManifest(serializeManifest(buildManifest(photos, settings)));

    expect(manifest.version).toBe(1);
    expect(manifest.settings).toEqual(settings);
    expect(manifest.photos).toHaveLength(2);

    const [a, b] = manifest.photos;
    expect(a.name).toBe('first.jpg');
    expect(a.description).toBe('起点');
    expect(a.duration).toBe(2);
    expect(a.date).toBe('2024-01-01T08:00:00.000Z');
    expect(a.file).not.toBe(b.file); // collision-free entry names

    expect(b.lat).toBeNull();
    expect(b.date).toBeNull();
  });

  it('rejects an unrecognised manifest', () => {
    expect(() => parseManifest('{"version":99}')).toThrow();
  });
});
