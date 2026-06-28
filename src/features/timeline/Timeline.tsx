import {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Stack, Slider, IconButton, TextField, Typography, Paper } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

interface TimelineProps {
  /** Total length of the timeline in seconds (sum of all photo durations). */
  totalDuration: number;
  /**
   * Start offset (seconds) of each photo, ascending, with boundaries[0] === 0.
   * Used to map the smooth cursor time to the current photo index.
   */
  boundaries: number[];
  /** Fired when the current photo index changes (not every frame). */
  onIndexChange?: (index: number) => void;
  /** Fired when the user starts playback or scrubs — used to exit overview mode. */
  onUserInteract?: () => void;
}

export interface TimelineHandle {
  pause: () => void;
}

/** Largest i with boundaries[i] <= t; -1 when there are no photos. */
function indexAt(t: number, boundaries: number[]): number {
  let idx = -1;
  for (let i = 0; i < boundaries.length; i++) {
    if (boundaries[i] <= t) idx = i;
    else break;
  }
  return idx;
}

const Timeline = forwardRef<TimelineHandle, TimelineProps>(
  ({ totalDuration, boundaries, onIndexChange, onUserInteract }, ref) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [rate, setRate] = useState(1);
    const requestRef = useRef<number>(0);
    const lastUpdateTime = useRef<number>(Date.now());

    useImperativeHandle(ref, () => ({
      pause: () => setPlaying(false),
    }));

    const count = boundaries.length;
    const currentIndex = useMemo(
      () => indexAt(currentTime, boundaries),
      [currentTime, boundaries]
    );

    // Emit only when the resolved photo index changes (time advance, scrub, or
    // edited durations) — keeps the map from rebuilding layers every frame.
    const onIndexChangeRef = useRef(onIndexChange);
    onIndexChangeRef.current = onIndexChange;
    useEffect(() => {
      onIndexChangeRef.current?.(currentIndex);
    }, [currentIndex]);

    useEffect(() => {
      if (!playing) return;

      const update = () => {
        const now = Date.now();
        const delta = (now - lastUpdateTime.current) / 1000;
        lastUpdateTime.current = now;

        setCurrentTime((prev) => {
          const next = prev + delta * rate;
          if (next >= totalDuration) {
            setPlaying(false);
            return totalDuration;
          }
          return next;
        });

        requestRef.current = requestAnimationFrame(update);
      };

      requestRef.current = requestAnimationFrame(update);
      return () => cancelAnimationFrame(requestRef.current);
    }, [playing, rate, totalDuration]);

    useEffect(() => {
      lastUpdateTime.current = Date.now();
    }, [playing]);

    const handlePlayToggle = () => {
      if (!playing) {
        onUserInteract?.();
        // Restart from the beginning if we're sitting at the end.
        if (currentTime >= totalDuration) setCurrentTime(0);
      }
      setPlaying((p) => !p);
    };

    const handleSliderChange = (_e: Event, value: number | number[]) => {
      const v = Array.isArray(value) ? value[0] : value;
      onUserInteract?.();
      setCurrentTime(v);
    };

    const disabled = count === 0;

    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 150 }}>
            {disabled ? (
              '暂无图片'
            ) : (
              <>
                第 <strong>{currentIndex + 1}</strong>/{count} 张 ·{' '}
                {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
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

        <Slider
          min={0}
          max={totalDuration || 1}
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
