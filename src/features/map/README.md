# features/map — 地图渲染

封装 Leaflet 地图与所有地图副作用。对外只暴露 `MapView`。

## 组成

- **`MapView.tsx`** — 唯一对外组件。包裹 `MapContainer`，按 `isChina`/`provider` 选底图，并把可见图片坐标交给下面三个图层。**坐标转换在这里完成**：当底图为中国底图（`source.gcj02`）时，对所有坐标应用 `wgs84ToGcj02`（见 `lib/geo.ts`），保证标记与底图对齐。
- **`tileSources.ts`** — OSM / 高德(AMAP) / 天地图(TIANDITU) 底图配置 + `selectTileSource(isChina, provider)`。天地图 `tk` 密钥内嵌于 URL。
- **`icons.ts`** — `defaultIcon`（蓝色）与 `highlightIcon`（红色放大），并设为 Leaflet 默认图标。
- **`markercluster.css`** — 聚类图标与弹窗（`.photo-popup*`）样式。

## 可编辑描述弹窗

`MarkerClusterLayer` 的 popup 由 `buildPopup` **构造 DOM 元素**（非 HTML 字符串）：图片 + 只读描述标题 + 描述 `textarea` + 「保存描述」按钮。点保存调用 `onDescriptionChange(id, text)`（经 `MapView` 透传到 `PhotoTrackPage`）并关闭弹窗。描述随项目文件保存。

## 三个 `useMap` 副作用图层（均渲染 null，逻辑在 `useEffect`）

数据流：`MapView` 根据当前状态选择渲染哪些图层。

| 组件 | 职责 | 触发条件 |
| --- | --- | --- |
| `MarkerClusterLayer` | 聚类渲染全部可见标记（含可编辑描述弹窗）；`highlight` 时把最后一张单独画成红色大图标并自动开 popup | 始终渲染 |
| `FitBounds` | 把视口框定到全部可见标记 | 总览状态（`showAll`） |
| `FocusOnMarkers` | 播放时平移/缩放到当前图片（单点居中带偏移，多点 fitBounds） | 播放状态（非 `showAll`） |

`showAll`（= 总览模式）/ `highlight` 由父组件 `features/photo-track/PhotoTrackPage.tsx` 根据总览开关与时间轴位置计算（时间轴以秒为单位，语义见 `features/timeline`）。
