import { memo, useEffect, useRef, useState } from 'react';
import { Box, Fade, Typography } from '@mui/material';
import type { PhotoPoint } from '../../types/photo';
import type { OverlayMode, SmallOverlayPos } from '../../lib/uiPrefs';
import { clamp } from '../../lib/layout';

interface PhotoOverlayProps {
  /** The photo to showcase (current photo clip), or null to hide the overlay. */
  photo: PhotoPoint | null;
  /** Display mode: centered large, side-docked, always-small, or move-small/hold-large. */
  mode: OverlayMode;
  /** Current clip phase; only the 'auto' mode renders differently per phase. */
  phase: 'move' | 'hold';
  /** Device-local dragged position of the small card (% of the map viewport). */
  smallPos?: SmallOverlayPos | null;
  /** Fired when the user drops the small card at a new position. */
  onSmallPosChange?: (pos: SmallOverlayPos) => void;
}

/**
 * The photo "presentation" card shown over the map during a photo clip. All
 * sizes use container-query units (cqw/cqh against the letterboxed map
 * viewport), so the composition scales proportionally with the map area and
 * looks the same across devices/window sizes:
 * - center: large card in the middle (~70% of the viewport height with caption).
 * - side: docked right at ~42% of the viewport width.
 * - small: a small card the user can drag anywhere (position is a device-local
 *   preference, default bottom-right corner).
 * - auto: the small card while the map flies (move), center-large on hold.
 *
 * The card is keyed by photo id only, so mode/phase flips restyle the same
 * <img> element in place instead of remounting (no reload / re-fade mid-clip).
 */
const PhotoOverlay: React.FC<PhotoOverlayProps> = ({
  photo,
  mode,
  phase,
  smallPos = null,
  onSmallPosChange,
}) => {
  const variant: 'center' | 'side' | 'small' =
    mode === 'small'
      ? 'small'
      : mode === 'side'
      ? 'side'
      : mode === 'auto' && phase === 'move'
      ? 'small'
      : 'center';

  // ---- drag-to-place for the small card (pointer capture, % of the parent) ----
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const grabOffset = useRef({ x: 0, y: 0 });
  /** Transient position while dragging; cleared once the committed prop lands. */
  const [dragPos, setDragPos] = useState<SmallOverlayPos | null>(null);

  useEffect(() => {
    setDragPos(null);
  }, [smallPos]);

  const posFromPointer = (e: React.PointerEvent): SmallOverlayPos | null => {
    const card = cardRef.current;
    const parent = card?.parentElement;
    if (!card || !parent) return null;
    const pr = parent.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    if (pr.width <= 0 || pr.height <= 0) return null;
    const left = clamp(
      e.clientX - pr.left - grabOffset.current.x,
      0,
      Math.max(0, pr.width - cr.width)
    );
    const top = clamp(
      e.clientY - pr.top - grabOffset.current.y,
      0,
      Math.max(0, pr.height - cr.height)
    );
    return { xPct: (left / pr.width) * 100, yPct: (top / pr.height) * 100 };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const card = cardRef.current;
    if (!card) return;
    e.preventDefault();
    const cr = card.getBoundingClientRect();
    grabOffset.current = { x: e.clientX - cr.left, y: e.clientY - cr.top };
    dragging.current = true;
    card.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const pos = posFromPointer(e);
    if (pos) setDragPos(pos);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    cardRef.current?.releasePointerCapture(e.pointerId);
    const pos = posFromPointer(e);
    if (pos) onSmallPosChange?.(pos);
  };

  const effectiveSmallPos = dragPos ?? smallPos;
  const positionSx =
    variant === 'center'
      ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', maxWidth: '86cqw' }
      : variant === 'side'
      ? { right: '2cqw', top: '50%', transform: 'translateY(-50%)', width: '42cqw' }
      : {
          ...(effectiveSmallPos
            ? { left: `${effectiveSmallPos.xPct}%`, top: `${effectiveSmallPos.yPct}%` }
            : { right: 12, bottom: 12 }),
          width: 'clamp(150px, 22cqw, 340px)',
        };

  const imgSx =
    variant === 'center'
      ? { maxHeight: '62cqh', maxWidth: '100%', width: 'auto', height: 'auto' }
      : variant === 'side'
      ? { width: '100%', height: 'auto', maxHeight: '62cqh', objectFit: 'cover' as const }
      : { width: '100%', height: 'auto', maxHeight: '30cqh', objectFit: 'cover' as const };

  return (
    <Fade in={!!photo} timeout={400} key={photo?.id ?? 'none'}>
      <Box
        ref={cardRef}
        onPointerDown={variant === 'small' ? handlePointerDown : undefined}
        onPointerMove={variant === 'small' ? handlePointerMove : undefined}
        onPointerUp={variant === 'small' ? handlePointerUp : undefined}
        sx={{
          position: 'absolute',
          zIndex: 1000,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'rgba(255,255,255,0.96)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          border: '3px solid',
          borderColor: 'primary.main',
          ...(variant === 'small'
            ? {
                pointerEvents: 'auto',
                cursor: 'grab',
                touchAction: 'none',
                '&:active': { cursor: 'grabbing' },
              }
            : { pointerEvents: 'none' }),
          ...positionSx,
        }}
      >
        {photo && (
          <>
            <Box
              component="img"
              src={photo.url}
              alt={photo.name}
              draggable={false}
              sx={{ display: 'block', ...imgSx }}
            />
            <Box sx={{ px: 1.5, py: 1 }}>
              <Typography variant="subtitle2" noWrap title={photo.name}>
                {photo.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div" noWrap>
                {photo.date ? photo.date.toLocaleString() : '无时间信息'}
              </Typography>
              {photo.description && variant !== 'small' && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {photo.description}
                </Typography>
              )}
            </Box>
          </>
        )}
      </Box>
    </Fade>
  );
};

// Memoized: the page re-renders far more often than the overlay's props change.
export default memo(PhotoOverlay);
