import { wgs84ToGcj02 } from './geo';

describe('wgs84ToGcj02', () => {
  it('leaves coordinates outside China unchanged', () => {
    const [lat, lng] = wgs84ToGcj02(40.7128, -74.006); // New York
    expect(lat).toBeCloseTo(40.7128, 6);
    expect(lng).toBeCloseTo(-74.006, 6);
  });

  it('offsets coordinates inside China by a few hundred metres', () => {
    const [lat, lng] = wgs84ToGcj02(39.9042, 116.4074); // Beijing
    expect(lat).not.toBeCloseTo(39.9042, 4);
    expect(lng).not.toBeCloseTo(116.4074, 4);
    // The offset is small (< ~0.01 deg), so still in the same neighbourhood.
    expect(Math.abs(lat - 39.9042)).toBeLessThan(0.01);
    expect(Math.abs(lng - 116.4074)).toBeLessThan(0.01);
  });
});
