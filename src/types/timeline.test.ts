import {
  clipLength,
  deriveSchedule,
  clipIndexAt,
  clipPhase,
  clipProgressAt,
  photoClip,
  gapClip,
  type TimelineClip,
} from './timeline';

const clip = (move: number, hold: number, kind: TimelineClip['kind'] = 'photo'): TimelineClip => ({
  id: `${kind}-${move}-${hold}`,
  kind,
  refId: kind === 'gap' ? undefined : 'x',
  moveDuration: move,
  holdDuration: hold,
});

describe('clipLength', () => {
  it('sums move + hold and clamps negatives', () => {
    expect(clipLength(clip(1, 2))).toBe(3);
    expect(clipLength(clip(-5, 2))).toBe(2);
  });
});

describe('deriveSchedule', () => {
  it('produces cumulative boundaries and a total', () => {
    const { boundaries, total } = deriveSchedule([clip(1, 2), clip(0, 3), clip(2, 2)]);
    expect(boundaries).toEqual([0, 3, 6]);
    expect(total).toBe(10);
  });

  it('is empty for no clips', () => {
    expect(deriveSchedule([])).toEqual({ boundaries: [], total: 0 });
  });
});

describe('clipIndexAt', () => {
  const { boundaries } = deriveSchedule([clip(1, 2), clip(0, 3), clip(2, 2)]); // [0,3,6]

  it('resolves the active clip from a time', () => {
    expect(clipIndexAt(-1, boundaries)).toBe(-1);
    expect(clipIndexAt(0, boundaries)).toBe(0);
    expect(clipIndexAt(2.9, boundaries)).toBe(0);
    expect(clipIndexAt(3, boundaries)).toBe(1);
    expect(clipIndexAt(6, boundaries)).toBe(2);
    expect(clipIndexAt(100, boundaries)).toBe(2);
  });

  it('returns -1 when there are no clips', () => {
    expect(clipIndexAt(5, [])).toBe(-1);
  });
});

describe('clipPhase', () => {
  it('splits a clip into move then hold', () => {
    const c = clip(2, 3);
    expect(clipPhase(c, 0)).toBe('move');
    expect(clipPhase(c, 1.9)).toBe('move');
    expect(clipPhase(c, 2)).toBe('hold');
    expect(clipPhase(c, 4)).toBe('hold');
  });
});

describe('clipProgressAt', () => {
  const clips = [clip(1, 2), clip(0, 3), clip(2, 2)];
  const { boundaries } = deriveSchedule(clips); // [0,3,6], total 10

  it('reports the active clip and its elapsed fraction', () => {
    expect(clipProgressAt(0, boundaries, clips)).toEqual({ index: 0, progress: 0 });
    expect(clipProgressAt(1.5, boundaries, clips)).toEqual({ index: 0, progress: 0.5 });
    expect(clipProgressAt(3, boundaries, clips)).toEqual({ index: 1, progress: 0 });
    expect(clipProgressAt(7, boundaries, clips)).toEqual({ index: 2, progress: 0.25 });
  });

  it('clamps progress to 1 past the end of the timeline', () => {
    expect(clipProgressAt(100, boundaries, clips)).toEqual({ index: 2, progress: 1 });
  });

  it('returns -1 before the start or with no clips', () => {
    expect(clipProgressAt(-0.1, boundaries, clips)).toEqual({ index: -1, progress: 0 });
    expect(clipProgressAt(5, [], [])).toEqual({ index: -1, progress: 0 });
  });

  it('treats zero-length clips as fully elapsed', () => {
    const zero = [clip(0, 0), clip(1, 1)];
    const sched = deriveSchedule(zero); // [0,0]
    // t=0: clipIndexAt resolves the last boundary <= t, i.e. the second clip.
    expect(clipProgressAt(0, sched.boundaries, zero)).toEqual({ index: 1, progress: 0 });
    const onlyZero = [clip(0, 0)];
    const s2 = deriveSchedule(onlyZero);
    expect(clipProgressAt(0, s2.boundaries, onlyZero)).toEqual({ index: 0, progress: 1 });
  });
});

describe('factories', () => {
  it('photoClip carries its ref and default timings', () => {
    const c = photoClip('p1', 15);
    expect(c.kind).toBe('photo');
    expect(c.refId).toBe('p1');
    expect(c.zoom).toBe(15);
    expect(clipLength(c)).toBeGreaterThan(0);
  });

  it('gapClip has no move and no ref', () => {
    const g = gapClip();
    expect(g.kind).toBe('gap');
    expect(g.refId).toBeUndefined();
    expect(g.moveDuration).toBe(0);
  });
});
