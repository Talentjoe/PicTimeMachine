# features/timeline — 时间轴

`Timeline.tsx`：基于 `requestAnimationFrame` 的平滑播放/拖动滑块，MUI 实现（Slider/IconButton/TextField）。

## 关键语义：以「秒」为单位的连续时间轴

每张图片有自己的时长 `duration`（秒，默认 1，「一秒一张」），可在图片列表中调整、随项目文件保存。父组件 `PhotoTrackPage` 把这些时长换算成：

- `totalDuration` — 全部（含坐标的）图片时长之和，即滑块长度。
- `boundaries` — 每张图片的起始偏移（秒，升序，`boundaries[0]===0`）。

Timeline 内部用 `requestAnimationFrame` 平滑推进 `currentTime`（浮点秒，`next = prev + delta * rate`，保留播放速率 `rate`），并由 `boundaries` 反查当前图片下标，**仅在下标变化时**触发 `onIndexChange(index)`（避免每帧回调导致地图图层每帧重建）。

回调：
- `onIndexChange(index)` — 当前图片下标变化（时间推进 / 拖动 / 编辑时长 / 重排都可能触发）。
- `onUserInteract()` — 播放或拖动时触发，父组件据此退出「总览」模式。

`TimelineHandle.pause()` 通过 `useImperativeHandle` 暴露，父组件点「总览」时调用以暂停播放。
