# features/photo-track — 主页面

`PhotoTrackPage.tsx`：应用的状态容器与 MUI 布局根，组合 `features/map` 与 `features/timeline`，并含 `PhotoList`（可排序/选择/编辑列表）与 `CollectionsPanel`（组合管理）。

## 状态与派生值

- `images: PhotoPoint[]` — 主数组，**顺序即显示顺序**。来源：`lib/exif.ts#readPhotosFromFiles`、`lib/project.ts#importProject`（.zip）或 `applyReference`（.json + 重选文件）。
- `collections: Collection[]` — 多对多分组（一图可属多组）。
- `located` — `images` 中含坐标+时间的子集（`isLocated`），地图与时间轴只走这部分。
- `boundaries` / `total` — 由 `located` 各自的 `duration`（秒）累加，传给时间轴（语义见 `features/timeline`）。
- `currentIndex` — 时间轴回调的当前图片下标（针对 `located`）。
- **`mode: 'overview' | 'playback' | 'collections'`**（默认 `overview`）：
  - `overview` → 全部 located 标记 + FitBounds，无高亮。
  - `playback` → `located[0..currentIndex]` + 高亮当前 + FocusOnMarkers（用当前图 `zoom`）。
  - `collections` → 可见组合（`selectedCollectionId` 单个或全部）的图片并集 + 凸包多边形 + FitBounds。
  - 「总览」/「组合」按钮切 `mode` 并 `timelineRef.pause()`；时间轴 `onUserInteract` → `playback`。
- `selectedIds: Set` — 列表勾选集（用于成组）；`selectedCollectionId` — 聚焦单个组合；`advanced` — 高级选项开关。

## 功能与处理器

- 选择图片（多选累加）、删除全部、**删除单张**（`handleDeleteOne`，含 `revokeObjectURL`，并从所有组合移除该 id）。
- **排序**：`PhotoList` 拖拽重排（`onReorder`）；「按时间排序」（无时间的沉底）。
- **每张时长**：列表数字框 `onDurationChange`，影响时间轴总长。
- **每张缩放（高级选项）**：`advanced` 开启后列表出现 zoom 框 `onZoomChange`，播放聚焦时生效。
- **描述**：地图弹窗内编辑（`handleDescriptionChange`，见 `features/map`），显示在弹窗图片下方。
- **组合**：列表勾选 → `用选中创建组合`；`加入选中`/`移除选中`/`重命名`/`备注(commit)`/`删除`/`聚焦`；点地图多边形也可聚焦。
- **两种保存模式**：
  - 完整 `.zip`（`导出(.zip)` → `exportProject`，`压缩` 开关）；`打开项目` → `importProject`，无需重选文件夹。
  - 仅引用 `.json`（`导出引用(.json)` → `exportReference`，不含图片）；`打开引用` → 选 `.json` 后**自动弹出第二个隐藏文件输入**让用户重选原图片，`applyReference` 按路径/文件名匹配恢复。

## 布局

`Container` + 多个 `Paper` 卡片：地图、控制条（底图切换、总览/组合、选择图片、打开项目/引用、导出 zip/引用、压缩开关、按时间排序、高级选项、删除全部、计数 `Chip`）、时间轴、`PhotoList`、`CollectionsPanel`。提示用非阻塞 `Snackbar`。
