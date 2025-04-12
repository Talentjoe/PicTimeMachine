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
    onSecondChange?: (second: number) => void; // 整秒变化时调用
}

export interface TimelineHandle {
    getCurrentTime: () => number;
}

const Timeline = forwardRef<TimelineHandle, TimelineProps>(
    ({ startTime, endTime, interval = 100, onSecondChange }, ref) => {

        const [currentTime, setCurrentTime] = useState(startTime);
        const [playing, setPlaying] = useState(false);
        const [rate,setRate] = useState(1);
        const requestRef = useRef<number>(0);
        const lastUpdateTime = useRef<number>(Date.now());

        const lastSecondRef = useRef<number>(Math.floor(startTime));

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

                    const floored = Math.floor(next);
                    if (floored !== lastSecondRef.current) {
                        lastSecondRef.current = floored;
                        if (onSecondChange) onSecondChange(floored);
                    }

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
        }, [playing, rate, endTime, onSecondChange]);

        useEffect(() => {
            lastUpdateTime.current = Date.now();
        }, [playing]);

        const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = parseFloat(e.target.value);
            setCurrentTime(value);
            const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const value = parseFloat(e.target.value);
                const delta = 0; // ✅ 只手动更新 currentTime，不往后推进时间
                setCurrentTime(value);

                // 触发整秒变化回调
                const floored = Math.floor(value);
                if (floored !== lastSecondRef.current) {
                    lastSecondRef.current = floored;
                    if (onSecondChange) onSecondChange(floored);
                }
            };
            handleSliderChange(e);
        }

        return (
            <div className="timeline-container">
                <div className="current-time">
                    当前图片: <strong>{Math.floor(currentTime)}</strong>
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
                                setRate(val);
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
                    onChange={handleSliderChange}
                    className="slider"
                />
            </div>
        );
    }
);

export default Timeline;