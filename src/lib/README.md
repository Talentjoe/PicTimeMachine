# lib — 纯函数工具层

无 React 依赖的纯逻辑，供 features 复用。

- **`exif.ts`** — EXIF 解析。
  - `readPhotosFromFiles(files, existing?)`：读取每个图片的 GPS+时间，返回按日期升序、按 `path|date` 去重的 `PhotoPoint[]`（补全 `id`/`path`/`description`/`duration`）。
  - `dmsToDecimal(dms, ref)` / `parseCustomTime(str)`：底层换算；`DEFAULT_DURATION` 默认每张时长（zoom 默认 `DEFAULT_ZOOM` 来自 `types/photo`）。
- **`geo.ts`** — `wgs84ToGcj02(lat, lng)`：WGS-84 → GCJ-02 火星坐标转换。EXIF 坐标是 WGS-84，但高德/天地图底图是 GCJ-02，仅在中国底图渲染时对标记坐标应用（见 `features/map/MapView.tsx`）。中国境外坐标原样返回。
- **`hull.ts`** — `convexHull(points)`：Andrew monotone chain 凸包（输入/输出 `[lat,lng]`）。点数 < 3 原样返回，调用方据此跳过画多边形。用于组合的地域范围（`features/map/CollectionsLayer.tsx`）。有单测。
- **`project.ts`** — 项目文件读写（JSZip），manifest **v2**（含 `mode`/`collections`，`ManifestPhoto` 含 `id`/`zoom`；`parseManifest` 兼容 v1）。**为保证 collections 的 photoIds 重载后仍有效，photo 的 `id` 持久化并在导入时复用。**
  - `buildManifest(photos, settings, collections, mode)` / `serializeManifest` / `parseManifest`：纯函数，有 round-trip + v1 兼容单测。
  - `exportProject(photos, settings, collections, {compress})`：**完整模式**——自包含 `.zip`（`manifest.json` + 全部图片本体），`compress` 切换 DEFLATE/STORE；`importProject(file)` 解包重建，返回 `{photos, collections}`，**无需重选文件夹**。
  - `exportReference(photos, settings, collections)`：**仅引用模式**——只导出 `.json`（路径+元数据，不含图片）；`parseReferenceJson(file)` + `applyReference(manifest, files)` 重新选择原文件（按 `path` 后 `name` 匹配）恢复，未匹配的跳过。

数据模型 `PhotoPoint`（含 `zoom?`）/ `LocatedPhoto` / `isLocated` / `newId` / `newPhotoId` / `DEFAULT_ZOOM` 在 [`src/types/photo.ts`](../types/photo.ts)；`Collection` / `newCollectionId` / `nextCollectionColor` 在 [`src/types/collection.ts`](../types/collection.ts)。
