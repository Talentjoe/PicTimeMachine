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
- `types/photo.ts` — the shared data model `PhotoPoint` (nullable `lat/lng/date`), `LocatedPhoto`, and the `isLocated` type guard. `types/*.d.ts` declare untyped modules (`exif-js`, `react-cookies`); `react-app-env.d.ts` brings in CRA's asset-module types.
- `lib/` — React-free pure logic. `exif.ts#readPhotosFromFiles` parses files into de-duplicated, date-sorted `PhotoPoint[]`. `geo.ts#wgs84ToGcj02` converts coordinates (see gotchas).
- `features/photo-track/PhotoTrackPage.tsx` — the central state container + MUI layout.
- `features/map/` — all Leaflet rendering; only `MapView` is exported. `tileSources.ts` holds the three basemaps + `selectTileSource`.
- `features/timeline/Timeline.tsx` — the animated scrubber.

Each `features/*` and `lib/` directory has a `README.md` describing its responsibility and data flow — read those when working in a module.

**The timeline is an image index, not wall-clock time.** This is the key concept:
- `Timeline.tsx` is a generic `0..N` animated scrubber (driven by `requestAnimationFrame`, with play/pause and a speed `rate`). It fires `onSecondChange(flooredInteger)` only when the integer part changes.
- `PhotoTrackPage` passes `endTime={images.length+1}` and treats the emitted integer as `currentSecond`, used as a **slice index into the date-sorted located images**.
- `currentSecond === 0` (or `=== images.length+1`) means "show everything" (`showAll`); any value in between means "show images `[0, currentSecond)`" — the trajectory up to that point. `showAll` also toggles highlight and which map-framing component runs.

Map-effect components (each calls `useMap()`, renders `null`, does imperative Leaflet work in `useEffect`), composed by `MapView`:
- `MarkerClusterLayer.tsx` — `L.markerClusterGroup` with per-marker popup (name/date/thumbnail); when `highlight`, the most recent image gets a larger red icon + auto-opened popup.
- `FocusOnMarkers.tsx` — during playback, pans/zooms to the current point (single) or fits bounds (multiple).
- `FitBounds.tsx` — fits the map to all visible markers (the `showAll` state).

## Conventions & gotchas

- **Coordinate conversion**: EXIF GPS is WGS-84. Chinese basemaps (Amap/Tianditu) render in GCJ-02, so `MapView` applies `wgs84ToGcj02` to all marker/focus/bounds coordinates when the active `TileSource.gcj02` is true. OSM uses WGS-84 directly. Do conversion once in `MapView` so all layers stay aligned.
- The Tianditu tile layer uses a hardcoded `tk` API key in its URL (`tileSources.ts`).
- `mapbox-gl` / `react-map-gl` are in `package.json` but the map is Leaflet-only; don't assume Mapbox is wired up.
- EXIF parsing is best-effort per file inside a try/catch; images without GPS/date are filtered off the map (`isLocated`) but still shown in the list.
- User-facing strings are Chinese; keep new UI text consistent. Use MUI components (not raw HTML controls) and `Snackbar`/`Dialog` instead of `alert()`.
- TypeScript `strict` is on (root `tsconfig.json`). Imports omit extensions; don't write explicit `.tsx`/`.js` in import paths.
