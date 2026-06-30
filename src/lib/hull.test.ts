import { convexHull } from './hull';

describe('convexHull', () => {
  it('returns input unchanged for fewer than 3 unique points', () => {
    expect(convexHull([])).toEqual([]);
    expect(convexHull([[1, 1]])).toEqual([[1, 1]]);
    expect(convexHull([[1, 1], [2, 2]])).toHaveLength(2);
    // duplicates collapse to < 3 unique
    expect(convexHull([[1, 1], [1, 1], [1, 1]])).toHaveLength(1);
  });

  it('drops interior points from the hull of a square + center', () => {
    const square: [number, number][] = [
      [0, 0],
      [0, 10],
      [10, 0],
      [10, 10],
      [5, 5], // interior point
    ];
    const hull = convexHull(square);
    expect(hull).toHaveLength(4);
    expect(hull).toEqual(expect.arrayContaining([[0, 0], [0, 10], [10, 0], [10, 10]]));
    expect(hull).not.toContainEqual([5, 5]);
  });

  it('keeps all corners of a triangle', () => {
    const tri: [number, number][] = [[0, 0], [0, 4], [3, 0]];
    expect(convexHull(tri)).toHaveLength(3);
  });
});
