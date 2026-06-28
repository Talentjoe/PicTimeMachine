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
- `types/photo.ts` — the shared data model `PhotoPoint` (`id`, `path`, `description`, `duration`, nullable `lat/lng/date`), `LocatedPhoto`, the `isLocated` guard, and `newPhotoId()`. **The position of a photo in the `images` array IS its display order** (drag-reorder / sort-by-time just reorder the array). `types/*.d.ts` declare untyped modules (`exif-js`, `react-cookies`); `react-app-env.d.ts` brings in CRA's asset-module types.
- `lib/` — React-free pure logic. `exif.ts#readPhotosFromFiles` parses files into de-duplicated, date-sorted `PhotoPoint[]`. `geo.ts#wgs84ToGcj02` converts coordinates (see gotchas). `project.ts` reads/writes the self-contained `.zip` project file (JSZip).
- `features/photo-track/` — `PhotoTrackPage.tsx` (central state container + MUI layout) and `PhotoList.tsx` (drag-to-reorder list via `@dnd-kit`, with per-photo duration + delete).
- `features/map/` — all Leaflet rendering; only `MapView` is exported. `tileSources.ts` holds the three basemaps + `selectTileSource`.
- `features/timeline/Timeline.tsx` — the animated scrubber.

Each `features/*` and `lib/` directory has a `README.md` describing its responsibility and data flow — read those when working in a module.

**The timeline is continuous wall-clock seconds with per-photo durations.** This is the key concept:
- Each `PhotoPoint` has a `duration` (seconds, default 1 — "一秒一张"), editable in `PhotoList` and saved in the project file.
- `PhotoTrackPage` derives, over the **located** photos, `boundaries` (each photo's cumulative start offset) and `total` (sum of durations), and passes them to `Timeline`.
- `Timeline.tsx` smoothly advances `currentTime` (float seconds) via `requestAnimationFrame` × `rate`, resolves the current photo from `boundaries`, and fires `onIndexChange(index)` **only when the index changes** (not per frame — otherwise the map rebuilds layers every frame). It also fires `onUserInteract()` on play/scrub. `TimelineHandle.pause()` lets the parent stop playback.
- **Overview is an explicit, separate mode** (`overview` state, default true), not a timeline endpoint. Overview → show all markers + FitBounds, no highlight. Playback (overview off) → show `located[0..currentIndex]`, highlight current, FocusOnMarkers. The 总览 button enters overview + pauses; `onUserInteract` exits it.

Map-effect components (each calls `useMap()`, renders `null`, does imperative Leaflet work in `useEffect`), composed by `MapView`:
- `MarkerClusterLayer.tsx` — `L.markerClusterGroup`; popups are built as **DOM elements** (`buildPopup`) with an editable description `textarea` + save button wired through `onDescriptionChange(id, text)`. When `highlight`, the most recent image gets a larger red icon + auto-opened popup.
- `FocusOnMarkers.tsx` — during playback, pans/zooms to the current point (single) or fits bounds (multiple).
- `FitBounds.tsx` — fits the map to all visible markers (the overview/`showAll` state).

**Project file** (`lib/project.ts`): a self-contained `.zip` = `manifest.json` (paths, descriptions, order, per-photo durations, coords, ISO dates) + every image's bytes. `exportProject` (with a `compress` DEFLATE/STORE toggle) and `importProject` round-trip a session with no folder re-pick. Keep manifest (de)serialization (`buildManifest`/`parseManifest`) pure and separate from the zip/blob I/O so it stays unit-testable (`project.test.ts`).

## Conventions & gotchas

- **Coordinate conversion**: EXIF GPS is WGS-84. Chinese basemaps (Amap/Tianditu) render in GCJ-02, so `MapView` applies `wgs84ToGcj02` to all marker/focus/bounds coordinates when the active `TileSource.gcj02` is true. OSM uses WGS-84 directly. Do conversion once in `MapView` so all layers stay aligned.
- The Tianditu tile layer uses a hardcoded `tk` API key in its URL (`tileSources.ts`).
- `mapbox-gl` / `react-map-gl` are in `package.json` but the map is Leaflet-only; don't assume Mapbox is wired up.
- EXIF parsing is best-effort per file inside a try/catch; images without GPS/date are filtered off the map (`isLocated`) but still shown in the list.
- User-facing strings are Chinese; keep new UI text consistent. Use MUI components (not raw HTML controls) and `Snackbar`/`Dialog` instead of `alert()`.
- TypeScript `strict` is on (root `tsconfig.json`). Imports omit extensions; don't write explicit `.tsx`/`.js` in import paths.
