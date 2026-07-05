import { overlayFocusOffset } from './overlayLayout';

describe('overlayFocusOffset', () => {
  it('puts the marker in the lower-left margin for center/auto overlays', () => {
    expect(overlayFocusOffset('center', 1000, 500)).toEqual([-320, 110]);
    expect(overlayFocusOffset('auto', 1000, 500)).toEqual([-320, 110]);
  });

  it('centers the marker in the visible left part for side overlays', () => {
    expect(overlayFocusOffset('side', 1000, 500)).toEqual([-225, 0]);
  });

  it('keeps the marker centered when no overlay is shown', () => {
    expect(overlayFocusOffset('none', 1000, 500)).toEqual([0, 0]);
  });

  it('degenerate map sizes yield no offset', () => {
    expect(overlayFocusOffset('center', 0, 500)).toEqual([0, 0]);
  });
});
