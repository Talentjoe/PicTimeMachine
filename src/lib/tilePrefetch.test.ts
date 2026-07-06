import { tileUrlsFor } from './tilePrefetch';

describe('tileUrlsFor', () => {
  const base = {
    url: 'https://{s}.tile.test/{z}/{x}/{y}.png',
    lat: 39.9042,
    lng: 116.4074,
    zoom: 15,
  };

  it('covers the destination zoom plus two approach zooms', () => {
    const urls = tileUrlsFor({ ...base, subdomains: ['a'] });
    expect(urls).toHaveLength(25 + 9 + 9); // 5×5 @z15, 3×3 @z13, 3×3 @z11
    expect(urls.some((u) => u.includes('/15/'))).toBe(true);
    expect(urls.some((u) => u.includes('/13/'))).toBe(true);
    expect(urls.some((u) => u.includes('/11/'))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length); // no duplicates
  });

  it('rotates subdomains across tiles', () => {
    const urls = tileUrlsFor({ ...base, subdomains: ['1', '2', '3'] });
    expect(urls.some((u) => u.startsWith('https://1.'))).toBe(true);
    expect(urls.some((u) => u.startsWith('https://2.'))).toBe(true);
    expect(urls.some((u) => u.startsWith('https://3.'))).toBe(true);
  });

  it('caps the number of tiles', () => {
    expect(tileUrlsFor({ ...base, maxTiles: 10 })).toHaveLength(10);
  });

  it('stays inside the world at low zooms / near the edge', () => {
    const urls = tileUrlsFor({ ...base, lat: 85, lng: -179.9, zoom: 2 });
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((u) => {
      const m = u.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/);
      expect(m).not.toBeNull();
      const [, z, x, y] = m!.map(Number);
      const max = 2 ** z;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(max);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(max);
    });
  });

  it('returns nothing for invalid zooms', () => {
    expect(tileUrlsFor({ ...base, zoom: NaN })).toEqual([]);
  });
});
