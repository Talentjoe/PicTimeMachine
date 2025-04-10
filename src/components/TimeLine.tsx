import React, {
    useEffect,
    useRef,
    useState,
    forwardRef,
    useImperativeHandle,
} from 'react';
import './Timeline.css';

interface TimelineProps {
    startTime: number;
    endTime: number;
    interval?: number;
}

export interface TimelineHandle {
    getCurrentTime: () => number;
}

const Timeline = forwardRef<TimelineHandle, TimelineProps>(
    ({ startTime, endTime, interval = 100 }, ref) => {
        const [currentTime, setCurrentTime] = useState(startTime);
        const [playing, setPlaying] = useState(true);
        const [rate, setRate] = useState(1);
        const requestRef = useRef<number>(0);
        const lastUpdateTime = useRef<number>(Date.now());

        // 暴露方法给父组件
        useImperativeHandle(ref, () => ({
            getCurrentTime: () => currentTime,
        }));

        useEffect(() => {
            if (!playing) return;

            const update = () => {
                const now = Date.now();
                const delta = (now - lastUpdateTime.current) / 1000;
                lastUpdateTime.current = now;

                setCurrentTime((prev) => {
                    const next = prev + delta * rate;
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
        }, [playing, rate, endTime]);

        return (
            <div className="timeline-container">
                <div className="current-time">
                    当前时间: <strong>{Math.floor(currentTime)}s</strong>
                </div>

                <div className="controls">
                    <span className="start-time">{startTime}s</span>

                    <div className="rate-control">
                        <label htmlFor="rateInput">播放速率:</label>
                        <input
                            id="rateInput"
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={rate}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val > 0) setRate(val);
                            }}
                        />
                        <span>x</span>
                    </div>

                    <button
                        className="play-button"
                        onClick={() => setPlaying(!playing)}
                    >
                        {playing ? '暂停' : '播放'}
                    </button>
                </div>

                <input
                    type="range"
                    min={startTime}
                    max={endTime}
                    step="0.01"
                    value={currentTime}
                    onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                    className="slider"
                />
            </div>
        );
    }
);

export default Timeline;
