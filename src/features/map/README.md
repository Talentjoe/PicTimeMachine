# features/map — 地图渲染

封装 Leaflet 地图与所有地图副作用。对外暴露 `MapView`、`PhotoOverlay` 与 `ViewTarget` 类型。

## 组成

- **`MapView.tsx`** — 主组件。包裹 `MapContainer`，按 `isChina`/`provider` 选底图，由 `target: ViewTarget` 驱动取景：
  - `{kind:'overview'}` → `FitBounds` 框定全部 located 标记（编辑/未播放）。
  - `{kind:'photo'}` → `FocusOnMarkers` 在 `moveDuration` 秒内飞到单图（`animate` 控制是否带动画）。
  - `{kind:'collection'}` → `FitBounds` 框选该组合成员 + `CollectionsLayer` 画凸包。
  - **坐标转换在此完成**：中国底图（`source.gcj02`）时对所有坐标（含 `prefetch` 中心）应用 `wgs84ToGcj02`（见 `lib/geo.ts`），保证标记/多边形/预取与底图对齐。
  - `prefetch`（下一个片段的 WGS-84 目标）经 `lib/tilePrefetch.ts#prefetchTiles` 预热瓦片缓存。
- **`PhotoOverlay.tsx`** — 播放图片片段时，在地图上以统一风格（圆角、阴影、主色描边、淡入）展示该图的卡片，替代小弹窗作为「展示」界面。
- **`tileSources.ts`** — OSM / 高德(AMAP) / 天地图(TIANDITU) 底图配置 + `selectTileSource`。天地图 `tk` 密钥内嵌于 URL。
- **`icons.ts`** — `defaultIcon`（蓝）与 `highlightIcon`（红色放大）。
- **`CollectionsLayer.tsx`** — 把组合成员坐标做凸包（`lib/hull.ts`）画成 `L.polygon`，popup 显示名称+备注；成员 < 3 不画。
- **`markercluster.css`** — 聚类图标、图片弹窗（`.photo-popup*`）与组合弹窗（`.collection-popup*`）样式。

## 可编辑描述弹窗

`MarkerClusterLayer` 的 popup 由 `buildPopup` **构造 DOM 元素**：图片 + 只读描述 + `textarea` + 「保存描述」按钮，保存调用 `onDescriptionChange(id, text)`。

## `useMap` 副作用图层（均渲染 null，逻辑在 `useEffect`）

| 组件 | 职责 | 触发条件 |
| --- | --- | --- |
| `MarkerClusterLayer` | 聚类渲染全部 located 标记（含可编辑弹窗）；`highlightId` 指定的图画成红色大图标（播放时 `openHighlightPopup=false`，由 `PhotoOverlay` 展示） | 始终渲染 |
| `FitBounds` | 框定视口（支持可选动画 `duration`） | overview / collection 取景 |
| `FocusOnMarkers` | 在 `moveDuration` 秒内 `flyTo` 当前图（`animate=false` 时 `setView` 瞬移，使拖动跟手、可打断） | photo 取景 |
| `CollectionsLayer` | 画组合凸包多边形 + popup | collection 取景 |

`target`/`prefetch` 由 `features/photo-track/PhotoTrackPage.tsx` 按时间线当前片段计算（语义见 `features/timeline`、`types/timeline`）。
