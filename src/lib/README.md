# lib — 纯函数工具层

无 React 依赖的纯逻辑，供 features 复用。

- **`exif.ts`** — EXIF 解析。
  - `readPhotosFromFiles(files, existing?)`：读取每个图片的 GPS+时间，返回按日期升序、按 `path|date` 去重的 `PhotoPoint[]`（补全 `id`/`path`/`description`/`duration`）。
  - `dmsToDecimal(dms, ref)` / `parseCustomTime(str)`：底层换算；`DEFAULT_DURATION` 默认每张时长。
- **`geo.ts`** — `wgs84ToGcj02(lat, lng)`：WGS-84 → GCJ-02 火星坐标转换。EXIF 坐标是 WGS-84，但高德/天地图底图是 GCJ-02，仅在中国底图渲染时对标记坐标应用（见 `features/map/MapView.tsx`）。中国境外坐标原样返回。
- **`project.ts`** — 自包含 `.zip` 项目文件读写（JSZip）。
  - `buildManifest` / `serializeManifest` / `parseManifest`：纯函数，`manifest.json`（路径/描述/顺序/时长/坐标/ISO 日期），有 round-trip 单测。
  - `exportProject(photos, settings, {compress})`：打包 `manifest.json` + 全部图片本体为 `Blob`，`compress` 切换 DEFLATE/STORE。
  - `importProject(file)`：解包重建 `PhotoPoint[]`（新 object URL），**无需重选文件夹**。

数据模型 `PhotoPoint` / `LocatedPhoto` / `isLocated` / `newPhotoId` 定义在 [`src/types/photo.ts`](../types/photo.ts)。
