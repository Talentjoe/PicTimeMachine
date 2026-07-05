import { moveSelectedBlock, chronological } from './binOps';

const items = (ids: string[]) => ids.map((id) => ({ id }));
const idsOf = (arr: { id: string }[]) => arr.map((i) => i.id);

describe('moveSelectedBlock', () => {
  const list = items(['a', 'b', 'c', 'd', 'e']);

  it('moves an unselected item alone (selection ignored)', () => {
    const out = moveSelectedBlock(list, new Set(['a', 'e']), 'b', 'd');
    expect(idsOf(out)).toEqual(['a', 'c', 'd', 'b', 'e']);
  });

  it('moves the whole selection as a contiguous block downward', () => {
    const out = moveSelectedBlock(list, new Set(['a', 'c']), 'a', 'd');
    expect(idsOf(out)).toEqual(['b', 'd', 'a', 'c', 'e']);
  });

  it('moves the block upward, keeping its internal order', () => {
    const out = moveSelectedBlock(list, new Set(['c', 'e']), 'e', 'a');
    expect(idsOf(out)).toEqual(['c', 'e', 'a', 'b', 'd']);
  });

  it('is a no-op when dropping onto the moving block or unknown ids', () => {
    expect(moveSelectedBlock(list, new Set(['a', 'b']), 'a', 'b')).toBe(list);
    expect(moveSelectedBlock(list, new Set(), 'nope', 'c')).toBe(list);
  });
});

describe('chronological', () => {
  it('sorts by date ascending with undated photos last', () => {
    const photos = [
      { id: 'late', date: new Date(2000) },
      { id: 'none', date: null },
      { id: 'early', date: new Date(1000) },
    ];
    expect(chronological(photos).map((p) => p.id)).toEqual(['early', 'late', 'none']);
  });
});
