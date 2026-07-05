import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  memo,
} from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Stack, Slider, IconButton, TextField, Typography, Paper, Box } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import {
  clipIndexAt,
  clipLength,
  clipPhase,
  clipProgressAt,
  type ClipKind,
  type TimelineClip,
} from '../../types/timeline';

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
  /** Fired when the active clip's move/hold phase changes (not every frame). */
  onPhaseChange?: (phase: 'move' | 'hold') => void;
  /** Fired when a clip block is clicked (opens the inspector). */
  onSelectClip?: (id: string) => void;
  /** Fired when the user starts playback or scrubs. */
  onUserInteract?: () => void;
  /** Fired when playback starts/stops (drives the map's animate flag). */
  onPlayStateChange?: (playing: boolean) => void;
  /** Fired on right-click over a clip (context menu). */
  onClipContextMenu?: (e: React.MouseEvent, clipId: string) => void;
}

export interface TimelineHandle {
  pause: () => void;
  togglePlay: () => void;
  seek: (t: number) => void;
}

/** Sortable/droppable id prefixes shared with the page-level DndContext. */
export const CLIP_DND_PREFIX = 'clip:';
export const TIMELINE_TRACK_DROP_ID = 'timeline-track';

const GAP_HATCH =
  'repeating-linear-gradient(45deg, #e9ecef, #e9ecef 6px, #dfe3e8 6px, #dfe3e8 12px)';

/** Fixed clip card metrics — width no longer encodes duration. */
export const CLIP_WIDTH = 76;
const CLIP_THUMB_HEIGHT = 44;
const CONNECTOR_WIDTH = 14;

interface SortableClipProps {
  clip: TimelineClip;
  info: ClipInfo;
  selected: boolean;
  showConnector: boolean;
  onSelect: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, clipId: string) => void;
  /** Registers the card element used for playhead positioning. */
  registerNode: (id: string, el: HTMLElement | null) => void;
}

const SortableClip = memo<SortableClipProps>(
  ({ clip, info, selected, showConnector, onSelect, onContextMenu, registerNode }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: `${CLIP_DND_PREFIX}${clip.id}`,
    });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
    };

    return (
      <Box ref={setNodeRef} style={style} {...attributes} {...listeners}>
        {showConnector && (
          <Box sx={{ width: CONNECTOR_WIDTH, height: 2, bgcolor: 'divider', flexShrink: 0 }} />
        )}
        <Box
          ref={(el: HTMLElement | null) => registerNode(clip.id, el)}
          onClick={() => onSelect(clip.id)}
          onContextMenu={onContextMenu ? (e) => onContextMenu(e, clip.id) : undefined}
          sx={{
            width: CLIP_WIDTH,
            flexShrink: 0,
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
              height: CLIP_THUMB_HEIGHT,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
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
                maxWidth: '100%',
                color: clip.kind === 'gap' ? 'text.secondary' : '#fff',
                textShadow: clip.kind === 'gap' ? 'none' : '0 1px 2px rgba(0,0,0,0.8)',
                fontSize: 10,
              }}
            >
              {info.label}
            </Typography>
          </Box>
          <Typography
            variant="caption"
            component="div"
            sx={{ textAlign: 'center', fontSize: 10, lineHeight: '14px', color: 'text.secondary' }}
          >
            {clipLength(clip).toFixed(1)}s
          </Typography>
          {/* move (fly) + hold (dwell) split bar */}
          <Box sx={{ display: 'flex', height: 4 }}>
            <Box sx={{ flexGrow: clip.moveDuration || 0.0001, flexBasis: 0, bgcolor: 'secondary.main' }} />
            <Box sx={{ flexGrow: clip.holdDuration || 0.0001, flexBasis: 0, bgcolor: 'primary.main' }} />
          </Box>
        </Box>
      </Box>
    );
  }
);

/**
 * The NLE timeline track. Owns playback via requestAnimationFrame, but keeps
 * the advancing time in a ref (`timeRef`) — React state (`displayTime`) is
 * only refreshed a few times per second for the header text and the slider,
 * while the playhead is repositioned imperatively (style.transform) every
 * frame. This keeps playback smooth regardless of how many clips exist.
 *
 * Clips render as fixed-width thumbnail cards joined by thin connectors and
 * scroll horizontally; the playhead maps time → pixels through the active
 * clip's measured card (clipProgressAt), auto-following during playback.
 * Sorting/drops are handled by the page-level DndContext (ids `clip:<id>`,
 * track droppable `timeline-track`).
 */
const Timeline = forwardRef<TimelineHandle, TimelineProps>(
  (
    {
      clips,
      infos,
      boundaries,
      total,
      selectedClipId,
      onClipChange,
      onPhaseChange,
      onSelectClip,
      onUserInteract,
      onPlayStateChange,
      onClipContextMenu,
    },
    ref
  ) => {
    /** Authoritative playback time (seconds); state mirrors it at low frequency. */
    const timeRef = useRef(0);
    const [displayTime, setDisplayTime] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [rate, setRate] = useState(1);

    const requestRef = useRef<number>(0);
    const lastUpdateTime = useRef<number>(0);
    const lastDisplaySync = useRef<number>(0);

    // Mirrors so the rAF loop never has to re-subscribe mid-playback.
    const rateRef = useRef(rate);
    rateRef.current = rate;
    const totalRef = useRef(total);
    totalRef.current = total;
    const boundariesRef = useRef(boundaries);
    boundariesRef.current = boundaries;
    const clipsRef = useRef(clips);
    clipsRef.current = clips;
    const playingRef = useRef(playing);
    playingRef.current = playing;

    const onClipChangeRef = useRef(onClipChange);
    onClipChangeRef.current = onClipChange;
    const onPhaseChangeRef = useRef(onPhaseChange);
    onPhaseChangeRef.current = onPhaseChange;
    const onPlayStateChangeRef = useRef(onPlayStateChange);
    onPlayStateChangeRef.current = onPlayStateChange;

    const lastIndexRef = useRef<number | null>(null);
    const lastPhaseRef = useRef<'move' | 'hold' | null>(null);

    const playheadRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const clipNodesRef = useRef(new Map<string, HTMLElement>());

    const registerNode = useCallback((id: string, el: HTMLElement | null) => {
      if (el) clipNodesRef.current.set(id, el);
      else clipNodesRef.current.delete(id);
    }, []);

    const { setNodeRef: setTrackDropRef } = useDroppable({ id: TIMELINE_TRACK_DROP_ID });

    /** Emits onClipChange / onPhaseChange when (and only when) they change. */
    const emitDerived = useCallback((t: number) => {
      const index = clipIndexAt(t, boundariesRef.current);
      if (index !== lastIndexRef.current) {
        lastIndexRef.current = index;
        onClipChangeRef.current?.(index);
      }
      const clip = index >= 0 ? clipsRef.current[index] : undefined;
      const phase = clip ? clipPhase(clip, t - boundariesRef.current[index]) : 'hold';
      if (phase !== lastPhaseRef.current) {
        lastPhaseRef.current = phase;
        onPhaseChangeRef.current?.(phase);
      }
    }, []);

    /** Positions the playhead (and auto-scrolls during playback). Pure DOM. */
    const positionPlayhead = useCallback((t: number) => {
      const el = playheadRef.current;
      if (!el) return;
      const cs = clipsRef.current;
      if (cs.length === 0) {
        el.style.opacity = '0';
        return;
      }
      const { index, progress } = clipProgressAt(t, boundariesRef.current, cs);
      let x = 0;
      if (index >= 0) {
        const node = clipNodesRef.current.get(cs[index].id);
        if (node) x = node.offsetLeft + node.offsetWidth * progress;
      }
      el.style.opacity = '1';
      el.style.transform = `translateX(${x}px)`;

      if (playingRef.current) {
        const sc = scrollRef.current;
        if (sc && sc.scrollWidth > sc.clientWidth) {
          if (x > sc.scrollLeft + sc.clientWidth - CLIP_WIDTH) {
            sc.scrollLeft = x - sc.clientWidth * 0.4;
          } else if (x < sc.scrollLeft) {
            sc.scrollLeft = Math.max(0, x - CLIP_WIDTH);
          }
        }
      }
    }, []);

    /** Moves the authoritative time and syncs everything derived from it. */
    const applyTime = useCallback(
      (t: number) => {
        const clamped = Math.max(0, Math.min(t, totalRef.current));
        timeRef.current = clamped;
        setDisplayTime(clamped);
        emitDerived(clamped);
        positionPlayhead(clamped);
      },
      [emitDerived, positionPlayhead]
    );

    useImperativeHandle(ref, () => ({
      pause: () => setPlaying(false),
      togglePlay: () => handlePlayToggle(),
      seek: (t: number) => applyTime(t),
    }));

    useEffect(() => {
      onPlayStateChangeRef.current?.(playing);
    }, [playing]);

    // Keep the cursor inside the (possibly shrunk) timeline, and re-emit the
    // active clip when boundaries move under a fixed time.
    useEffect(() => {
      if (timeRef.current > total) timeRef.current = total;
      setDisplayTime(timeRef.current);
      emitDerived(timeRef.current);
    }, [total, boundaries, emitDerived]);

    // The rAF playback loop — depends only on `playing`.
    useEffect(() => {
      if (!playing) return;

      lastUpdateTime.current = performance.now();
      lastDisplaySync.current = 0;

      const update = () => {
        const now = performance.now();
        const delta = (now - lastUpdateTime.current) / 1000;
        lastUpdateTime.current = now;

        const next = timeRef.current + delta * rateRef.current;
        if (next >= totalRef.current) {
          timeRef.current = totalRef.current;
          setPlaying(false);
          setDisplayTime(totalRef.current);
          emitDerived(totalRef.current);
          positionPlayhead(totalRef.current);
          return;
        }
        timeRef.current = next;
        emitDerived(next);
        positionPlayhead(next);

        // Low-frequency React sync for the header text + slider.
        if (now - lastDisplaySync.current >= 150) {
          lastDisplaySync.current = now;
          setDisplayTime(next);
        }

        requestRef.current = requestAnimationFrame(update);
      };

      requestRef.current = requestAnimationFrame(update);
      return () => cancelAnimationFrame(requestRef.current);
    }, [playing, emitDerived, positionPlayhead]);

    // Reposition after any render (clips reordered/edited, layout shifts).
    useLayoutEffect(() => {
      positionPlayhead(timeRef.current);
    });

    const handlePlayToggle = () => {
      if (!playing) {
        onUserInteract?.();
        if (timeRef.current >= totalRef.current) applyTime(0);
      }
      setPlaying((p) => !p);
    };

    const handleSliderChange = (_e: Event, value: number | number[]) => {
      const v = Array.isArray(value) ? value[0] : value;
      onUserInteract?.();
      applyTime(v);
    };

    const count = clips.length;
    const disabled = count === 0;
    const displayIndex = useMemo(
      () => clipIndexAt(displayTime, boundaries),
      [displayTime, boundaries]
    );

    const clipIds = useMemo(() => clips.map((c) => `${CLIP_DND_PREFIX}${c.id}`), [clips]);

    return (
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 170 }}>
            {disabled ? (
              '时间线为空，从素材库拖入或点「加入时间线」'
            ) : (
              <>
                片段 <strong>{displayIndex + 1}</strong>/{count} · {displayTime.toFixed(1)}s /{' '}
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

        {/* Scrollable clip track (also the drop target for photos from the bin). */}
        <Box
          ref={(el: HTMLDivElement | null) => {
            scrollRef.current = el;
            setTrackDropRef(el);
          }}
          sx={{ overflowX: 'auto', overflowY: 'hidden', pb: 0.5 }}
        >
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              width: 'max-content',
              minWidth: '100%',
              minHeight: CLIP_THUMB_HEIGHT + 22,
              py: '2px',
            }}
          >
            {disabled ? (
              <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
                将素材库中的图片拖到这里
              </Typography>
            ) : (
              <SortableContext items={clipIds} strategy={horizontalListSortingStrategy}>
                {clips.map((clip, i) => (
                  <SortableClip
                    key={clip.id}
                    clip={clip}
                    info={infos[i]}
                    selected={clip.id === selectedClipId}
                    showConnector={i > 0}
                    onSelect={onSelectClip ?? (() => {})}
                    onContextMenu={onClipContextMenu}
                    registerNode={registerNode}
                  />
                ))}
              </SortableContext>
            )}
            {/* playhead (positioned imperatively — see positionPlayhead) */}
            <Box
              ref={playheadRef}
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: 2,
                bgcolor: 'error.main',
                pointerEvents: 'none',
                zIndex: 5,
                opacity: 0,
                willChange: 'transform',
              }}
            />
          </Box>
        </Box>

        <Slider
          min={0}
          max={total || 1}
          step={0.05}
          value={Math.min(displayTime, total || 1)}
          onChange={handleSliderChange}
          disabled={disabled}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v.toFixed(1)}s`}
          size="small"
          sx={{ mt: 0.5 }}
        />
      </Paper>
    );
  }
);

export default Timeline;
