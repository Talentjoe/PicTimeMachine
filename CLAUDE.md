# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A pure client-side React + TypeScript app (Create React App) that reads EXIF GPS + timestamp data from user-selected images and replays the user's trajectory on a Leaflet map. The UI is a **video-editor (NLE)**: a media bin of imported photos, a center map, and a bottom **timeline of clips** the user builds. Nothing is uploaded — images are read in-browser via `URL.createObjectURL` and `EXIF.readFromBinaryFile`. The UI is in Chinese and uses MUI (Material UI). Demo: app.talentjoe.fun. See `README.md` for the author's blog write-up.

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
- `types/photo.ts` — the shared data model `PhotoPoint` (`id`, `path`, `description`, `duration` *(default-only)*, optional `zoom`, nullable `lat/lng/date`), `LocatedPhoto`, the `isLocated` guard, `newId`/`newPhotoId`, `DEFAULT_ZOOM`. `images` is now the **media bin** — its order is bin order, independent of the timeline. `types/timeline.ts` — the **`TimelineClip`** model (`kind: 'photo'|'collection'|'gap'`, `refId`, `moveDuration`, `holdDuration`, `zoom?`) + pure helpers `deriveSchedule`/`clipIndexAt`/`clipLength`/`photoClip`/`collectionClip`/`gapClip`. `types/collection.ts` — `Collection` (many-to-many `photoIds`, `comment`, `color`) + palette helpers. `types/*.d.ts` declare untyped modules; `react-app-env.d.ts` brings in CRA's asset-module types.
- `lib/` — React-free pure logic. `exif.ts#readPhotosFromFiles` parses files into de-duplicated, date-sorted `PhotoPoint[]`. `geo.ts#wgs84ToGcj02` converts coordinates (see gotchas). `hull.ts#convexHull` for collection regions. `tilePrefetch.ts#prefetchTiles` warms tiles for the next clip. `project.ts` reads/writes project files (JSZip).
- `features/photo-track/` — `PhotoTrackPage.tsx` (central state container + full-screen layout), `MediaBin.tsx` (imported-photo sidebar: import, select, add-to-timeline, delete, collection chips), `ClipInspector.tsx` (edit the selected clip's move/hold/zoom), `CollectionsPanel.tsx` (create/edit/delete collections + comment + add-to-timeline).
- `features/map/` — all Leaflet rendering; exports `MapView`, `PhotoOverlay`, and the `ViewTarget` type. `tileSources.ts` holds the three basemaps + `selectTileSource`; `CollectionsLayer.tsx` draws collection hull polygons; `PhotoOverlay.tsx` is the themed photo card during playback.
- `features/timeline/Timeline.tsx` — the clip-track scrubber (rAF playback + dnd-kit reorder).

Each `features/*` and `lib/` directory has a `README.md` describing its responsibility and data flow — read those when working in a module.

**The timeline is an ordered list of clips, each with a move + hold phase.** This is the key concept:
- A `TimelineClip` is a **photo**, a **collection**, or an empty **gap** (`types/timeline.ts`). A photo may appear zero, one, or many times; gaps repeat freely. The bin order does NOT define the timeline.
- Each clip's length = `moveDuration` (the Leaflet `flyTo` animation time) + `holdDuration` (dwell). `PhotoTrackPage` derives `boundaries` + `total` via `deriveSchedule(timeline)` and passes them to `Timeline`.
- `Timeline.tsx` smoothly advances `currentTime` (float seconds) via `requestAnimationFrame` × `rate`, resolves the active clip via `clipIndexAt`, and fires `onClipChange(index)` **only when the index changes** (not per frame). Time advance never waits on the map animation — playback is non-blocking. It also fires `onUserInteract()` (→ preview) and `onPlayStateChange(playing)` (→ map `animate`). `TimelineHandle.pause()` lets the parent stop playback.
**The map is driven by a `ViewTarget`** (`resolveTarget` in `PhotoTrackPage`), not implicit endpoints. `preview` state: `false` → overview (FitBounds all located), `true` → follow the current clip:
- photo clip → `FocusOnMarkers` flies to it over `moveDuration` at `clip.zoom ?? photo.zoom ?? DEFAULT_ZOOM`.
- collection clip → `FitBounds` over members + `CollectionsLayer` hull.
- gap clip → carry the previous non-gap view forward (no new fly).
The 总览 button sets `preview=false` + pause; `onUserInteract` sets `preview=true`. The next clip's coords are passed as `prefetch` to warm tiles.

Map-effect components (each calls `useMap()`, renders `null`, does imperative Leaflet work in `useEffect`), composed by `MapView`:
- `MarkerClusterLayer.tsx` — `L.markerClusterGroup`; popups are built as **DOM elements** (`buildPopup`) with an editable description `textarea` + save button wired through `onDescriptionChange(id, text)`. The photo named by `highlightId` gets a larger red icon (popup auto-open gated by `openHighlightPopup`, off during playback — `PhotoOverlay` shows instead).
- `FocusOnMarkers.tsx` — `flyTo(point, zoom, {duration: moveDuration})` when `animate`, else instant `setView` (snappy/interruptible scrubbing).
- `FitBounds.tsx` — fits the map to given positions (optional animation `duration`).
- `CollectionsLayer.tsx` — draws each collection's convex-hull polygon (skipped when < 3 located members) with a name/comment popup.

**Project file** (`lib/project.ts`, manifest **v3**): two save modes sharing one schema (photos, descriptions, durations, zoom, coords, ISO dates, **collections**, the **`timeline`** of clips, and each photo's persisted `id`). **v1/v2 are no longer supported** (rejected on load).
- **Full** = self-contained `.zip` (`exportProject` with `compress` DEFLATE/STORE toggle) + `importProject` — round-trips with no folder re-pick.
- **Reference** = metadata-only `.json` (`exportReference`) + `parseReferenceJson` then `applyReference(manifest, files)` — the user re-selects the original files and entries match by `path` then `name`.
- Photo/collection `id`s are persisted so clips' `refId` and `collection.photoIds` stay linked; `importProject`/`applyReference` prune clips whose target is missing. If a manifest has no `timeline`, `parseManifest` generates one photo clip per located photo. Keep manifest (de)serialization (`buildManifest`/`parseManifest`) pure and separate from zip/blob I/O so it stays unit-testable (`project.test.ts`, `timeline.test.ts`, `hull.test.ts`).

## Conventions & gotchas

- **Coordinate conversion**: EXIF GPS is WGS-84. Chinese basemaps (Amap/Tianditu) render in GCJ-02, so `MapView` applies `wgs84ToGcj02` to all marker/focus/bounds coordinates when the active `TileSource.gcj02` is true. OSM uses WGS-84 directly. Do conversion once in `MapView` so all layers stay aligned.
- The Tianditu tile layer uses a hardcoded `tk` API key in its URL (`tileSources.ts`).
- `mapbox-gl` / `react-map-gl` are in `package.json` but the map is Leaflet-only; don't assume Mapbox is wired up.
- EXIF parsing is best-effort per file inside a try/catch; images without GPS/date are filtered off the map (`isLocated`) but still shown in the list.
- User-facing strings are Chinese; keep new UI text consistent. Use MUI components (not raw HTML controls) and `Snackbar`/`Dialog` instead of `alert()`.
- TypeScript `strict` is on (root `tsconfig.json`). Imports omit extensions; don't write explicit `.tsx`/`.js` in import paths.
