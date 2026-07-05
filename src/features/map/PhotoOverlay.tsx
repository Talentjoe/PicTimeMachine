import { Box, Fade, Typography } from '@mui/material';
import type { PhotoPoint } from '../../types/photo';
import type { OverlayMode } from '../../lib/uiPrefs';

interface PhotoOverlayProps {
  /** The photo to showcase (current photo clip), or null to hide the overlay. */
  photo: PhotoPoint | null;
  /** Display mode (user preference): centered large, side-docked, or move-small/hold-large. */
  mode: OverlayMode;
  /** Current clip phase; only the 'auto' mode renders differently per phase. */
  phase: 'move' | 'hold';
}

/**
 * The photo "presentation" card shown over the map during a photo clip. All
 * sizes use container-query units (cqw/cqh against the letterboxed map
 * viewport), so the composition scales proportionally with the map area and
 * looks the same across devices/window sizes:
 * - center: large card in the middle (~70% of the viewport height with caption).
 * - side: docked right at ~42% of the viewport width.
 * - auto: small corner card while the map flies (move), center-large on hold.
 */
const PhotoOverlay: React.FC<PhotoOverlayProps> = ({ photo, mode, phase }) => {
  const variant: 'center' | 'side' | 'small' =
    mode === 'side' ? 'side' : mode === 'auto' && phase === 'move' ? 'small' : 'center';

  const positionSx =
    variant === 'center'
      ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', maxWidth: '86cqw' }
      : variant === 'side'
      ? { right: '2cqw', top: '50%', transform: 'translateY(-50%)', width: '42cqw' }
      : { right: 12, bottom: 12, width: 'clamp(150px, 22cqw, 340px)' };

  const imgSx =
    variant === 'center'
      ? { maxHeight: '62cqh', maxWidth: '100%', width: 'auto', height: 'auto' }
      : variant === 'side'
      ? { width: '100%', height: 'auto', maxHeight: '62cqh', objectFit: 'cover' as const }
      : { width: '100%', height: 'auto', maxHeight: '30cqh', objectFit: 'cover' as const };

  return (
    <Fade in={!!photo} timeout={400} key={`${photo?.id ?? 'none'}:${variant}`}>
      <Box
        sx={{
          position: 'absolute',
          zIndex: 1000,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'rgba(255,255,255,0.96)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          border: '3px solid',
          borderColor: 'primary.main',
          pointerEvents: 'none',
          ...positionSx,
        }}
      >
        {photo && (
          <>
            <Box component="img" src={photo.url} alt={photo.name} sx={{ display: 'block', ...imgSx }} />
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

export default PhotoOverlay;
