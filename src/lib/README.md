# lib — 纯函数工具层

无 React 依赖的纯逻辑，供 features 复用。

- **`exif.ts`** — EXIF 解析。
  - `readPhotosFromFiles(files, existing?)`：读取每个图片的 GPS+时间，返回按日期升序、按 `path|date` 去重的 `PhotoPoint[]`。
  - `dmsToDecimal(dms, ref)` / `parseCustomTime(str)`：底层换算；`DEFAULT_DURATION` 默认每张时长。
- **`geo.ts`** — `wgs84ToGcj02(lat, lng)`：WGS-84 → GCJ-02 火星坐标转换，仅在中国底图渲染时应用（见 `features/map/MapView.tsx`），境外坐标原样返回。
- **`hull.ts`** — `convexHull(points)`：Andrew monotone chain 凸包（`[lat,lng]`）。点数 < 3 原样返回。用于组合地域范围。有单测。
- **`tilePrefetch.ts`** — 尽力而为的瓦片预加载。`lngLatToTileXY` / `fillTileUrl` 做标准 Web Mercator(XYZ) 瓦片换算；`prefetchTiles({url, subdomains, lat, lng, zoom, radius})` 用 `new Image()` 预热目标中心附近瓦片的浏览器缓存，使下一个片段的飞行更顺滑。`MapView` 在片段切换时调用。
- **`project.ts`** — 项目文件读写（JSZip），manifest **v3**。**不再兼容 v1/v2**（旧文件会被拒绝）。
  - 新增 `timeline: ManifestClip[]`（与运行时 `TimelineClip` 同构）。photo 的 `id` 持久化并在导入时复用，以保证 collections 的 `photoIds` 与时间线片段的 `refId` 重载后仍有效。
  - `buildManifest(photos, settings, collections, timeline, mode)` / `serializeManifest` / `parseManifest`：纯函数，有 round-trip 单测（含图片重复出现、空白片段、默认时间线生成）。`parseManifest` 在缺少 `timeline` 时按每张 located 图片生成一个默认图片片段。
  - `exportProject(photos, settings, collections, timeline, {compress})` / `importProject(file)`：**完整 .zip**，返回 `{photos, collections, timeline}`，并修剪引用已失效的片段（`pruneTimeline`）。
  - `exportReference(photos, settings, collections, timeline)` / `parseReferenceJson` + `applyReference(manifest, files)`：**仅引用 .json**，重选原文件按 `path` 后 `name` 匹配恢复，未匹配的连同其片段一并修剪。

数据模型：`PhotoPoint` / `LocatedPhoto` / `isLocated` / `newId` / `newPhotoId` / `DEFAULT_ZOOM` 在 [`src/types/photo.ts`](../types/photo.ts)；`Collection` 等在 [`src/types/collection.ts`](../types/collection.ts)；`TimelineClip` / `ClipKind` / `deriveSchedule` / `clipIndexAt` / `clipLength` / `photoClip` / `collectionClip` / `gapClip` 在 [`src/types/timeline.ts`](../types/timeline.ts)。
