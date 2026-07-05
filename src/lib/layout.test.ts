import { computeLetterbox, clamp, isAspectId } from './layout';

describe('computeLetterbox', () => {
  it('fills the area in auto mode', () => {
    expect(computeLetterbox(1200, 800, 'auto')).toEqual({ width: 1200, height: 800 });
  });

  it('pillarboxes a wide ratio in a wider area (height-limited)', () => {
    // 16:9 in 2000×900 → height limited: 900 * 16/9 = 1600 wide
    expect(computeLetterbox(2000, 900, '16:9')).toEqual({ width: 1600, height: 900 });
  });

  it('letterboxes a wide ratio in a tall area (width-limited)', () => {
    // 16:9 in 1600×2000 → width limited: 1600 / (16/9) = 900 high
    expect(computeLetterbox(1600, 2000, '16:9')).toEqual({ width: 1600, height: 900 });
  });

  it('handles square and portrait ratios', () => {
    expect(computeLetterbox(1000, 500, '1:1')).toEqual({ width: 500, height: 500 });
    const { width, height } = computeLetterbox(1000, 900, '9:16');
    expect(height).toBe(900);
    expect(width).toBeCloseTo(900 * (9 / 16));
  });

  it('degenerate available areas collapse safely', () => {
    expect(computeLetterbox(0, 500, '4:3')).toEqual({ width: 0, height: 500 });
    expect(computeLetterbox(-10, 500, 'auto')).toEqual({ width: 0, height: 500 });
  });
});

describe('clamp', () => {
  it('clamps into range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('isAspectId', () => {
  it('accepts known ids and rejects everything else', () => {
    expect(isAspectId('auto')).toBe(true);
    expect(isAspectId('16:9')).toBe(true);
    expect(isAspectId('21:9')).toBe(false);
    expect(isAspectId(42)).toBe(false);
  });
});
