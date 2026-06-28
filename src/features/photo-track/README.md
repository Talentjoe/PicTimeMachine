# features/photo-track — 主页面

`PhotoTrackPage.tsx`：应用的状态容器与 MUI 布局根，组合 `features/map` 与 `features/timeline`，并新增 `PhotoList`（可排序/编辑列表）。

## 状态与派生值

- `images: PhotoPoint[]` — 主数组，**顺序即显示顺序**。来源：`lib/exif.ts#readPhotosFromFiles` 或 `lib/project.ts#importProject`。
- `located` — `images` 中含坐标+时间的子集（`isLocated`），地图与时间轴只走这部分。
- `boundaries` / `total` — 由 `located` 各自的 `duration`（秒）累加得到，传给时间轴（语义见 `features/timeline`）。
- `currentIndex` — 时间轴回调的当前图片下标（针对 `located`）。
- `overview: boolean`（默认 `true`）— **独立的总览模式**。`overview` → 地图显示全部 + FitBounds、不高亮；非 `overview` → 显示 `located[0..currentIndex]`、高亮当前、FocusOnMarkers。
  - 「总览」按钮 → `setOverview(true)` 且 `timelineRef.pause()`；时间轴 `onUserInteract` → `setOverview(false)`。

## 功能与处理器

- 选择图片（多选累加）、删除全部、**删除单张**（`handleDeleteOne`，含 `revokeObjectURL`）。
- **排序**：`PhotoList` 拖拽重排（`onReorder`）；「按时间排序」按钮（无时间的沉底）。
- **每张时长**：列表内数字框 `onDurationChange`，影响时间轴总长。
- **描述**：地图弹窗内编辑（`handleDescriptionChange`，见 `features/map`），显示在弹窗图片下方。
- **项目文件（自包含 .zip）**：`导出项目`（`exportProject`，`压缩` 开关切换 DEFLATE/STORE）、`打开项目`（`importProject`，完整恢复无需重选文件夹）。见 `lib/project.ts`。

## 布局

`Container` + 多个 `Paper` 卡片：地图、控制条（底图切换、总览、选择图片、打开/导出项目、压缩开关、按时间排序、删除全部、计数 `Chip`）、时间轴、`PhotoList`。提示用非阻塞 `Snackbar`。
