# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A pure client-side React + TypeScript app (Create React App) that reads EXIF GPS + timestamp data from user-selected images and replays the user's trajectory on a Leaflet map over a timeline. Nothing is uploaded — images are read in-browser via `URL.createObjectURL` and `EXIF.readFromBinaryFile`. The UI is in Chinese and uses MUI (Material UI). Demo: app.talentjoe.fun. See `README.md` for the author's blog write-up.

## Commands

- `npm start` — dev server (http://localhost:3000)
- `npm run build` — production build to `build/`
- `npm test` — Jest/RTL in watch mode (CRA defaults)
- `npm test -- src/lib/geo.test.ts` — run a single test file
- `npm test -- -t "wgs84"` — run tests matching a name
- `npx tsc --noEmit` — full type check (CRA's build only type-checks reachable files)
- No lint script; ESLint runs via CRA (`react-app`/`react-app/jest` config in `package.json`).

## Architecture

Everything is TypeScript (`.ts`/`.tsx`). Source is organized by feature under `src/`:

- `App.tsx` — wraps the app in MUI `<ThemeProvider>`/`<CssBaseline>` (theme in `theme.ts`), shows a one-time welcome `<Dialog>` (gated by a `viewed` cookie via `react-cookies`), and renders `PhotoTrackPage`.
- `types/photo.ts` — the shared data model `PhotoPoint` (`id`, `path`, `description`, `duration`, optional `zoom`, nullable `lat/lng/date`), `LocatedPhoto`, the `isLocated` guard, `newId`/`newPhotoId`, `DEFAULT_ZOOM`. **The position of a photo in the `images` array IS its display order** (drag-reorder / sort-by-time just reorder the array). `types/collection.ts` — `Collection` (many-to-many `photoIds`, `comment`, `color`) + palette helpers. `types/*.d.ts` declare untyped modules (`exif-js`, `react-cookies`); `react-app-env.d.ts` brings in CRA's asset-module types.
- `lib/` — React-free pure logic. `exif.ts#readPhotosFromFiles` parses files into de-duplicated, date-sorted `PhotoPoint[]`. `geo.ts#wgs84ToGcj02` converts coordinates (see gotchas). `hull.ts#convexHull` for collection regions. `project.ts` reads/writes project files (JSZip).
- `features/photo-track/` — `PhotoTrackPage.tsx` (central state container + MUI layout), `PhotoList.tsx` (drag-to-reorder list via `@dnd-kit`, with selection checkbox, per-photo duration/zoom, delete, collection chips), `CollectionsPanel.tsx` (create/edit/delete collections + comment).
- `features/map/` — all Leaflet rendering; only `MapView` is exported. `tileSources.ts` holds the three basemaps + `selectTileSource`; `CollectionsLayer.tsx` draws collection hull polygons.
- `features/timeline/Timeline.tsx` — the animated scrubber.

Each `features/*` and `lib/` directory has a `README.md` describing its responsibility and data flow — read those when working in a module.

**The timeline is continuous wall-clock seconds with per-photo durations.** This is the key concept:
- Each `PhotoPoint` has a `duration` (seconds, default 1 — "一秒一张"), editable in `PhotoList` and saved in the project file.
- `PhotoTrackPage` derives, over the **located** photos, `boundaries` (each photo's cumulative start offset) and `total` (sum of durations), and passes them to `Timeline`.
- `Timeline.tsx` smoothly advances `currentTime` (float seconds) via `requestAnimationFrame` × `rate`, resolves the current photo from `boundaries`, and fires `onIndexChange(index)` **only when the index changes** (not per frame — otherwise the map rebuilds layers every frame). It also fires `onUserInteract()` on play/scrub. `TimelineHandle.pause()` lets the parent stop playback.
**The map has three explicit modes** (`mode` state in `PhotoTrackPage`, default `overview`), not implicit timeline endpoints:
- `overview` → all located markers + FitBounds, no highlight.
- `playback` → `located[0..currentIndex]`, highlight current, FocusOnMarkers (at the current photo's `zoom`).
- `collections` → photos of the visible collection(s) + their convex-hull polygons + FitBounds.
The 总览/组合 buttons switch mode + pause; `onUserInteract` switches to `playback`.

Map-effect components (each calls `useMap()`, renders `null`, does imperative Leaflet work in `useEffect`), composed by `MapView`:
- `MarkerClusterLayer.tsx` — `L.markerClusterGroup`; popups are built as **DOM elements** (`buildPopup`) with an editable description `textarea` + save button wired through `onDescriptionChange(id, text)`. When `highlight`, the most recent image gets a larger red icon + auto-opened popup.
- `FocusOnMarkers.tsx` — during playback, pans/zooms to the current point at its `zoom ?? DEFAULT_ZOOM` (single) or fits bounds (multiple).
- `FitBounds.tsx` — fits the map to all visible markers (overview/collections).
- `CollectionsLayer.tsx` — draws each collection's convex-hull polygon (skipped when < 3 located members) with a name/comment popup.

**Project file** (`lib/project.ts`, manifest **v2**): two save modes sharing one manifest schema (paths, descriptions, order, durations, zoom, coords, ISO dates, **collections**, and each photo's persisted `id`).
- **Full** = self-contained `.zip` (`exportProject` with `compress` DEFLATE/STORE toggle) + `importProject` — round-trips with no folder re-pick.
- **Reference** = metadata-only `.json` (`exportReference`) + `parseReferenceJson` then `applyReference(manifest, files)` — the user re-selects the original files and entries match by `path` then `name`.
- Photo `id`s are persisted and reused on import so `collection.photoIds` stay linked. Keep manifest (de)serialization (`buildManifest`/`parseManifest`, with v1 back-compat) pure and separate from zip/blob I/O so it stays unit-testable (`project.test.ts`, `hull.test.ts`).

## Conventions & gotchas

- **Coordinate conversion**: EXIF GPS is WGS-84. Chinese basemaps (Amap/Tianditu) render in GCJ-02, so `MapView` applies `wgs84ToGcj02` to all marker/focus/bounds coordinates when the active `TileSource.gcj02` is true. OSM uses WGS-84 directly. Do conversion once in `MapView` so all layers stay aligned.
- The Tianditu tile layer uses a hardcoded `tk` API key in its URL (`tileSources.ts`).
- `mapbox-gl` / `react-map-gl` are in `package.json` but the map is Leaflet-only; don't assume Mapbox is wired up.
- EXIF parsing is best-effort per file inside a try/catch; images without GPS/date are filtered off the map (`isLocated`) but still shown in the list.
- User-facing strings are Chinese; keep new UI text consistent. Use MUI components (not raw HTML controls) and `Snackbar`/`Dialog` instead of `alert()`.
- TypeScript `strict` is on (root `tsconfig.json`). Imports omit extensions; don't write explicit `.tsx`/`.js` in import paths.
