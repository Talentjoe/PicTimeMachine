import {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Stack, Slider, IconButton, TextField, Typography, Paper, Box } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { clipIndexAt, clipLength, type ClipKind, type TimelineClip } from '../../types/timeline';

/** Per-clip presentation, parallel to the `clips` array. */
export interface ClipInfo {
  kind: ClipKind;
  label: string;
  color: string;
  thumbUrl?: string;
}

interface TimelineProps {
  clips: TimelineClip[];
  /** Display info for each clip (same order/length as `clips`). */
  infos: ClipInfo[];
  /** Cumulative start offset (seconds) of each clip; boundaries[0] === 0. */
  boundaries: number[];
  /** Total length of the timeline (seconds). */
  total: number;
  selectedClipId: string | null;
  /** Fired when the active clip index changes (not every frame). */
  onClipChange?: (index: number) => void;
  /** Fired when a clip block is clicked (opens the inspector). */
  onSelectClip?: (id: string) => void;
  /** Fired after a drag-reorder of the clips. */
  onReorder?: (clips: TimelineClip[]) => void;
  /** Fired when the user starts playback or scrubs. */
  onUserInteract?: () => void;
  /** Fired when playback starts/stops (drives the map's animate flag). */
  onPlayStateChange?: (playing: boolean) => void;
}

export interface TimelineHandle {
  pause: () => void;
}

const GAP_HATCH =
  'repeating-linear-gradient(45deg, #e9ecef, #e9ecef 6px, #dfe3e8 6px, #dfe3e8 12px)';

interface SortableClipProps {
  clip: TimelineClip;
  info: ClipInfo;
  selected: boolean;
  onSelect: (id: string) => void;
}

const SortableClip: React.FC<SortableClipProps> = ({ clip, info, selected, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: clip.id,
  });
  const len = clipLength(clip) || 0.001;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    flexGrow: len,
    flexBasis: 0,
    flexShrink: 1,
    minWidth: 44,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(clip.id)}
      sx={{
        cursor: 'grab',
        userSelect: 'none',
        borderRadius: 1,
        overflow: 'hidden',
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        boxShadow: selected ? 2 : 0,
        bgcolor: 'background.paper',
      }}
      title={`${info.label} · ${clip.moveDuration}s 移动 + ${clip.holdDuration}s 停留`}
    >
      <Box
        sx={{
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          ...(clip.kind === 'gap'
            ? { background: GAP_HATCH }
            : clip.kind === 'collection'
            ? { bgcolor: info.color }
            : {}),
          ...(info.thumbUrl
            ? {
                backgroundImage: `url(${info.thumbUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {}),
        }}
      >
        <Typography
          variant="caption"
          noWrap
          sx={{
            px: 0.5,
            color: clip.kind === 'photo' ? '#fff' : clip.kind === 'collection' ? '#fff' : 'text.secondary',
            textShadow: clip.kind === 'photo' ? '0 1px 2px rgba(0,0,0,0.8)' : 'none',
            fontSize: 10,
          }}
        >
          {info.label}
        </Typography>
      </Box>
      {/* move (fly) + hold (dwell) split bar */}
      <Box sx={{ display: 'flex', height: 5 }}>
        <Box sx={{ flexGrow: clip.moveDuration || 0.0001, flexBasis: 0, bgcolor: 'secondary.main' }} />
        <Box sx={{ flexGrow: clip.holdDuration || 0.0001, flexBasis: 0, bgcolor: 'primary.main' }} />
      </Box>
    </Box>
  );
};

/**
 * The NLE timeline track. Owns playback (requestAnimationFrame advancing
 * `currentTime`), renders clips as proportional blocks (photo thumbnail /
 * collection colour / gap hatch) with a move+hold split bar, supports
 * drag-reorder and click-to-select, and scrubbing via the slider underneath.
 * Fires `onClipChange` only when the active clip changes (keeps the map from
 * rebuilding every frame).
 */
const Timeline = forwardRef<TimelineHandle, TimelineProps>(
  (
    { clips, infos, boundaries, total, selectedClipId, onClipChange, onSelectClip, onReorder, onUserInteract, onPlayStateChange },
    ref
  ) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [rate, setRate] = useState(1);
    const requestRef = useRef<number>(0);
    const lastUpdateTime = useRef<number>(Date.now());

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    useImperativeHandle(ref, () => ({
      pause: () => setPlaying(false),
    }));

    const count = clips.length;
    const currentIndex = useMemo(() => clipIndexAt(currentTime, boundaries), [currentTime, boundaries]);

    // Emit only when the active clip changes (time advance, scrub, edits).
    const onClipChangeRef = useRef(onClipChange);
    onClipChangeRef.current = onClipChange;
    useEffect(() => {
      onClipChangeRef.current?.(currentIndex);
    }, [currentIndex]);

    const onPlayStateChangeRef = useRef(onPlayStateChange);
    onPlayStateChangeRef.current = onPlayStateChange;
    useEffect(() => {
      onPlayStateChangeRef.current?.(playing);
    }, [playing]);

    // Keep the cursor inside the (possibly shrunk) timeline.
    useEffect(() => {
      setCurrentTime((t) => (t > total ? total : t));
    }, [total]);

    useEffect(() => {
      if (!playing) return;

      const update = () => {
        const now = Date.now();
        const delta = (now - lastUpdateTime.current) / 1000;
        lastUpdateTime.current = now;

        setCurrentTime((prev) => {
          const next = prev + delta * rate;
          if (next >= total) {
            setPlaying(false);
            return total;
          }
          return next;
        });

        requestRef.current = requestAnimationFrame(update);
      };

      requestRef.current = requestAnimationFrame(update);
      return () => cancelAnimationFrame(requestRef.current);
    }, [playing, rate, total]);

    useEffect(() => {
      lastUpdateTime.current = Date.now();
    }, [playing]);

    const handlePlayToggle = () => {
      if (!playing) {
        onUserInteract?.();
        if (currentTime >= total) setCurrentTime(0);
      }
      setPlaying((p) => !p);
    };

    const handleSliderChange = (_e: Event, value: number | number[]) => {
      const v = Array.isArray(value) ? value[0] : value;
      onUserInteract?.();
      setCurrentTime(v);
    };

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = clips.findIndex((c) => c.id === active.id);
      const to = clips.findIndex((c) => c.id === over.id);
      if (from === -1 || to === -1) return;
      onReorder?.(arrayMove(clips, from, to));
    };

    const disabled = count === 0;
    const playheadPct = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0;

    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 170 }}>
            {disabled ? (
              '时间线为空，请从左侧添加片段'
            ) : (
              <>
                片段 <strong>{currentIndex + 1}</strong>/{count} · {currentTime.toFixed(1)}s /{' '}
                {total.toFixed(1)}s
              </>
            )}
          </Typography>

          <IconButton
            color="primary"
            onClick={handlePlayToggle}
            disabled={disabled}
            aria-label={playing ? '暂停' : '播放'}
          >
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>

          <TextField
            label="播放速率"
            type="number"
            size="small"
            value={rate}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!Number.isNaN(val) && val > 0) setRate(val);
            }}
            inputProps={{ step: 0.1, min: 0.1 }}
            sx={{ width: 110 }}
          />
        </Stack>

        {!disabled && (
          <Box sx={{ position: 'relative', mb: 0.5 }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={clips.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'stretch' }}>
                  {clips.map((clip, i) => (
                    <SortableClip
                      key={clip.id}
                      clip={clip}
                      info={infos[i]}
                      selected={clip.id === selectedClipId}
                      onSelect={(id) => onSelectClip?.(id)}
                    />
                  ))}
                </Box>
              </SortableContext>
            </DndContext>
            {/* playhead */}
            <Box
              sx={{
                position: 'absolute',
                top: -2,
                bottom: -2,
                left: `${playheadPct}%`,
                width: 2,
                bgcolor: 'error.main',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            />
          </Box>
        )}

        <Slider
          min={0}
          max={total || 1}
          step={0.05}
          value={currentTime}
          onChange={handleSliderChange}
          disabled={disabled}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v.toFixed(1)}s`}
        />
      </Paper>
    );
  }
);

export default Timeline;
