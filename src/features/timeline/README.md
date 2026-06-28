# features/timeline — 时间轴

`Timeline.tsx`：基于 `requestAnimationFrame` 的播放/拖动滑块，MUI 实现（Slider/IconButton/TextField）。

## 关键语义：时间轴是「图片索引」，不是真实时间

父组件 `PhotoTrackPage` 传入 `endTime = images.length + 1`，把 `onSecondChange` 回调的整数当作**排序后图片数组的切片下标**：

- `0`（或 `endTime`）→ 显示全部图片（`showAll`）。
- 中间值 `n` → 显示 `images[0, n)`，即"轨迹播放到第 n 张"。

`onSecondChange` 只在 floored（整数）值变化时触发，避免每帧回调。`getCurrentTime()` 通过 `useImperativeHandle` 暴露（兼容旧 API）。
