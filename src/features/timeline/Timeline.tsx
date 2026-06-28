import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Stack, Slider, IconButton, TextField, Typography, Paper } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

interface TimelineProps {
  startTime: number;
  endTime: number;
  /**
   * Fired whenever the integer ("second") part of the cursor changes. Note: in
   * this app the cursor is a *photo index*, not wall-clock time — see the
   * project's CLAUDE.md. `0` (or `endTime`) means "show all".
   */
  onSecondChange?: (second: number) => void;
}

export interface TimelineHandle {
  getCurrentTime: () => number;
}

const Timeline = forwardRef<TimelineHandle, TimelineProps>(
  ({ startTime, endTime, onSecondChange }, ref) => {
    const [currentTime, setCurrentTime] = useState(startTime);
    const [playing, setPlaying] = useState(false);
    const [rate, setRate] = useState(1);
    const requestRef = useRef<number>(0);
    const lastUpdateTime = useRef<number>(Date.now());
    const lastSecondRef = useRef<number>(Math.floor(startTime));

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => currentTime,
    }));

    /** Emits onSecondChange only when the floored value actually changes. */
    const emitSecond = (value: number) => {
      const floored = Math.floor(value);
      if (floored !== lastSecondRef.current) {
        lastSecondRef.current = floored;
        onSecondChange?.(floored);
      }
    };

    useEffect(() => {
      if (!playing) return;

      const update = () => {
        const now = Date.now();
        const delta = (now - lastUpdateTime.current) / 1000;
        lastUpdateTime.current = now;

        setCurrentTime((prev) => {
          const next = prev + delta * rate;
          emitSecond(next);
          if (next >= endTime) {
            setPlaying(false);
            return endTime;
          }
          return next;
        });

        requestRef.current = requestAnimationFrame(update);
      };

      requestRef.current = requestAnimationFrame(update);
      return () => cancelAnimationFrame(requestRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing, rate, endTime, onSecondChange]);

    useEffect(() => {
      lastUpdateTime.current = Date.now();
    }, [playing]);

    const handleSliderChange = (_e: Event, value: number | number[]) => {
      const v = Array.isArray(value) ? value[0] : value;
      setCurrentTime(v);
      emitSecond(v);
    };

    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 96 }}>
            当前图片: <strong>{Math.floor(currentTime)}</strong>
          </Typography>

          <IconButton
            color="primary"
            onClick={() => setPlaying((p) => !p)}
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
          min={startTime}
          max={endTime}
          step={0.01}
          value={currentTime}
          onChange={handleSliderChange}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => Math.floor(v).toString()}
        />
      </Paper>
    );
  }
);

export default Timeline;
