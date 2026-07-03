# features/photo-track — 主页面（视频剪辑式编辑器）

`PhotoTrackPage.tsx`：应用的状态容器与全屏 MUI 布局根，组合 `features/map` 与 `features/timeline`，并含 `MediaBin`（素材库）、`ClipInspector`（片段属性）与 `CollectionsPanel`（组合管理）。

## 状态与派生值

- `images: PhotoPoint[]` — **素材库**，顺序仅为库内排序，与时间线无关。来源：`lib/exif.ts#readPhotosFromFiles`、`lib/project.ts#importProject`（.zip）或 `applyReference`（.json + 重选文件）。
- `collections: Collection[]` — 多对多分组（一图可属多组）。
- **`timeline: TimelineClip[]`** — 有序的片段轨道（图片/组合/空白）。一张图可出现 0/1/多次。派生 `boundaries`/`total` 由 `deriveSchedule(timeline)` 得出（语义见 `features/timeline`、`types/timeline`）。
- `currentIndex` — 时间线回调的当前片段下标；`selectedClipId` — 被点选编辑的片段。
- `playing` — 来自 `Timeline.onPlayStateChange`，决定地图是否带动画飞行。
- **`preview: boolean`**（默认 false）：false=「总览」（FitBounds 全部 located 标记）；true=跟随当前片段。`onUserInteract` → true；「总览」按钮 → false 并 `timelineRef.pause()`。
- `selectedIds: Set` — 素材库勾选集（用于成组）。

## 地图取景（ViewTarget）

`resolveTarget(index)` 由当前片段算出传给 `MapView` 的 `target`：

- 图片片段 → `{kind:'photo'}`，缩放取 `clip.zoom ?? photo.zoom ?? DEFAULT_ZOOM`，`moveDuration` 为飞行时长，`animate = playing`。
- 组合片段 → `{kind:'collection'}`，地图框选该组合全部成员 + 画凸包。
- 空白片段 → 向前回溯到最近的非空白片段并**保持其取景**（不重新飞行）。

并把**下一个片段**的目标坐标作为 `prefetch` 传给 `MapView` 预加载瓦片。当前为图片片段时，`PhotoOverlay` 以统一风格的卡片展示该图。

## 功能与处理器

- 素材库（`MediaBin`）：导入（多选累加）、勾选成组、**加入时间线**（`addPhotoToTimeline`，追加图片片段）、**删除单张**（含 `revokeObjectURL`，并从组合与时间线移除其片段）。
- 时间线：拖动重排（`handleReorderClips`）、点选片段、**添加空白片段**（`addGapToTimeline`）、删除片段；`ClipInspector` 调整 `moveDuration`/`holdDuration`/`zoom`。
- 组合（`CollectionsPanel`）：勾选创建、加入/移除选中、重命名、备注、删除（同时删其时间线片段）、**加入时间线**（`addCollectionToTimeline`）。
- 描述：地图弹窗内编辑（`handleDescriptionChange`，见 `features/map`）。
- 「按时间排序」：仅对素材库排序（无时间的沉底）。
- **两种保存模式**（manifest **v3**，含 `timeline`）：完整 `.zip`（`exportProject`/`importProject`）与仅引用 `.json`（`exportReference` + `parseReferenceJson`/`applyReference`）。**不再兼容旧版项目文件。**

## 布局

全屏 `Box` 纵向：顶部工具条（底图切换、总览、打开项目/引用、导出、压缩、按时间排序、清空、计数）；中部横向（左 `MediaBin` 侧栏 + 中部地图 + `PhotoOverlay`）；下方时间线轨道（含「添加空白片段」）；底部横向（`ClipInspector` + `CollectionsPanel`）。提示用非阻塞 `Snackbar`。
