import { useCallback, useState } from 'react';

export interface ContextMenuState<T> {
  mouseX: number;
  mouseY: number;
  payload: T;
}

/**
 * Tiny shared hook for right-click context menus. Pair with an MUI `<Menu>`:
 *
 *   <Menu
 *     open={menu.state !== null}
 *     onClose={menu.close}
 *     anchorReference="anchorPosition"
 *     anchorPosition={menu.state ? { top: menu.state.mouseY, left: menu.state.mouseX } : undefined}
 *   >
 */
export function useContextMenu<T>() {
  const [state, setState] = useState<ContextMenuState<T> | null>(null);

  const open = useCallback((e: React.MouseEvent, payload: T) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ mouseX: e.clientX + 2, mouseY: e.clientY - 6, payload });
  }, []);

  const close = useCallback(() => setState(null), []);

  return { state, open, close };
}
