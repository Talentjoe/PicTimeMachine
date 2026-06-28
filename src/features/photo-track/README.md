# features/photo-track — 主页面

`PhotoTrackPage.tsx`：应用的状态容器与 MUI 布局根，组合 `features/map` 与 `features/timeline`。

## 状态与派生值

- `images: PhotoPoint[]` — 通过 `lib/exif.ts#readPhotosFromFiles` 解析（按日期排序、去重）。
- `located` — `images` 中含坐标+时间的子集（`isLocated`）。
- `currentSecond` — 时间轴回调值，作为 `located` 的切片下标（语义见 `features/timeline`）。
- `showAll = currentSecond === 0 || currentSecond === images.length + 1` → 决定地图用 FitBounds 还是 FocusOnMarkers，以及是否高亮当前图。
- `visibleImages` / `focusImages` — 传给 `MapView` 的可见集与聚焦集。

## 布局

`Container` + 多个 `Paper` 卡片：地图、控制条（中国/外国与高德/天地图 `ToggleButtonGroup`、`选择图片` 用隐藏 `<input>` 的 `Button component="label"`、计数 `Chip`）、时间轴、图片 `List`。解析结果用非阻塞 `Snackbar` 提示。删除时会 `URL.revokeObjectURL` 释放预览 URL。
