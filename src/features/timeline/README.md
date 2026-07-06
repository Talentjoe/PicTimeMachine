# features/timeline — 时间线（视频剪辑式轨道）

`Timeline.tsx`：基于 `requestAnimationFrame` 的平滑播放 + 一条由**片段（clip）**组成的水平轨道（`@dnd-kit` 拖动重排、点选片段、下方 Slider 拖动定位）。

## 关键语义：以「秒」为单位的连续时间轴 + 片段

时间线是一个有序的 `TimelineClip[]`（见 [`src/types/timeline.ts`](../../types/timeline.ts)），与素材库解耦：一张图片可出现 0/1/多次，也可完全不出现。每个片段有两个阶段，二者之和即片段长度：

- `moveDuration` — 地图飞向该片段目标的动画时长（Leaflet `flyTo` 用同一时长，使镜头移动与时间线同步）。
- `holdDuration` — 到达后停留、展示图片的时长。

父组件 `PhotoTrackPage` 用 `deriveSchedule(timeline)` 换算出：

- `total` — 全部片段长度之和（滑块/轨道长度）。
- `boundaries` — 每个片段的起始偏移（秒，升序，`boundaries[0]===0`）。

Timeline 内部用 `requestAnimationFrame` 平滑推进 `currentTime`（浮点秒，`next = prev + delta * rate`），由 `clipIndexAt` 反查当前片段下标，**仅在下标变化时**触发 `onClipChange(index)`（避免每帧重建地图图层）。时间推进**不等待**地图动画——播放保持 non-blocking。

## 轨道渲染

每个片段块的宽度按 `clipLength` 成比例（flex），并显示：图片片段→缩略图；组合片段→组合色块；空白片段→斜纹。块底部有一条「移动(次色) + 停留(主色)」比例条直观表示两阶段。红色竖线为播放头。

## 回调

- `onClipChange(index)` — 当前片段变化（播放推进/拖动/编辑时长/重排都可能触发）。
- `onSelectClip(id, e)` — 点选片段（事件携带修饰键：Ctrl/Cmd 切换、Shift 范围多选，选中集 `selectedClipIds` 由父组件维护），父组件据此在 `ClipInspector` 中编辑。
- 拖动重排由页面级 `DndContext` 处理（本组件只渲染 `SortableContext`/`useSortable`，id 前缀 `clip:`）。
- `onUserInteract()` — 播放或拖动时触发，父组件据此进入「预览（跟随片段）」。
- `onPlayStateChange(playing)` — 播放/暂停切换，驱动地图的 `animate` 标志。

`TimelineHandle.pause()` 经 `useImperativeHandle` 暴露，父组件点「总览」时调用以暂停。
