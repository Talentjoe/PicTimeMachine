import { saveProjectCache, loadProjectCache, clearProjectCache } from './projectCache';
import type { ProjectSettings } from './project';
import type { PhotoPoint } from '../types/photo';

const settings: ProjectSettings = { defaultDuration: 1, isChina: false, provider: 'amap' };

const photo: PhotoPoint = {
  id: 'a',
  name: 'first.jpg',
  path: 'trip/first.jpg',
  url: 'blob:fake-a',
  description: '起点',
  duration: 2,
  zoom: 15,
  lat: 39.9,
  lng: 116.4,
  date: new Date('2024-01-01T08:00:00.000Z'),
};

beforeEach(() => window.localStorage.clear());

describe('project cache', () => {
  it('round-trips a reference manifest without image data', () => {
    saveProjectCache([photo], settings, [], [
      { id: 'clip-1', kind: 'photo', refId: 'a', moveDuration: 1, holdDuration: 2 },
    ]);
    const cached = loadProjectCache();
    expect(cached).not.toBeNull();
    expect(cached!.manifest.mode).toBe('reference');
    expect(cached!.manifest.photos.map((p) => p.id)).toEqual(['a']);
    expect(cached!.manifest.timeline).toHaveLength(1);
    expect(cached!.savedAt).toBeInstanceOf(Date);
    // No blob/image payload is persisted.
    expect(window.localStorage.getItem('pic-time-machine.projectCache.v1')).not.toContain('blob:');
  });

  it('returns null for empty, missing, or corrupt caches', () => {
    expect(loadProjectCache()).toBeNull();
    saveProjectCache([], settings, [], []);
    expect(loadProjectCache()).toBeNull(); // empty project is not restorable
    window.localStorage.setItem('pic-time-machine.projectCache.v1', '{broken');
    expect(loadProjectCache()).toBeNull();
  });

  it('clearProjectCache removes the entry', () => {
    saveProjectCache([photo], settings, [], []);
    clearProjectCache();
    expect(loadProjectCache()).toBeNull();
  });
});
