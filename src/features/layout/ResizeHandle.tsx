import { useRef } from 'react';
import { Box } from '@mui/material';

interface ResizeHandleProps {
  /** 'vertical' = a vertical bar you drag horizontally (col-resize). */
  orientation: 'vertical' | 'horizontal';
  /** Incremental pointer delta (px) along the resize axis since the last event. */
  onResize: (delta: number) => void;
  /** Fired once when the drag ends (persist the committed size here). */
  onCommit?: () => void;
}

/**
 * A thin draggable divider between panels. Uses pointer capture so the drag
 * keeps tracking outside the bar; reports incremental deltas so the parent
 * can clamp freely.
 */
const ResizeHandle: React.FC<ResizeHandleProps> = ({ orientation, onResize, onCommit }) => {
  const last = useRef(0);
  const dragging = useRef(false);
  const axisPos = (e: React.PointerEvent) => (orientation === 'vertical' ? e.clientX : e.clientY);

  return (
    <Box
      onPointerDown={(e) => {
        e.preventDefault();
        dragging.current = true;
        last.current = axisPos(e);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const cur = axisPos(e);
        const delta = cur - last.current;
        if (delta !== 0) {
          last.current = cur;
          onResize(delta);
        }
      }}
      onPointerUp={(e) => {
        if (!dragging.current) return;
        dragging.current = false;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        onCommit?.();
      }}
      sx={{
        flexShrink: 0,
        zIndex: 10,
        touchAction: 'none',
        bgcolor: 'divider',
        transition: 'background-color 120ms',
        '&:hover': { bgcolor: 'primary.main' },
        ...(orientation === 'vertical'
          ? { width: 6, cursor: 'col-resize' }
          : { height: 6, cursor: 'row-resize' }),
      }}
      role="separator"
      aria-orientation={orientation}
    />
  );
};

export default ResizeHandle;
