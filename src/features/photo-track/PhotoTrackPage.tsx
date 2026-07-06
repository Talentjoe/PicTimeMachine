import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Paper,
  Stack,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Typography,
  Snackbar,
  Box,
  Switch,
  FormControlLabel,
  Avatar,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Alert,
} from '@mui/material';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import SortIcon from '@mui/icons-material/Sort';
import PublicIcon from '@mui/icons-material/Public';
import LinkIcon from '@mui/icons-material/Link';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import MapView, { type ViewTarget } from '../map/MapView';
import PhotoOverlay from '../map/PhotoOverlay';
import { overlayFocusOffset } from '../map/overlayLayout';
import type { ChinaProvider } from '../map/tileSources';
import Timeline, {
  type TimelineHandle,
  type ClipInfo,
  CLIP_DND_PREFIX,
  TIMELINE_TRACK_DROP_ID,
} from '../timeline/Timeline';
import MediaBin, { BIN_DND_PREFIX } from './MediaBin';
import ClipInspector from './ClipInspector';
import CollectionsPanel from './CollectionsPanel';
import { readPhotosFromFiles, DEFAULT_DURATION } from '../../lib/exif';
import {
  exportProject,
  exportReference,
  importProject,
  parseReferenceJson,
  applyReference,
  type ProjectSettings,
  type Manifest,
} from '../../lib/project';
import {
  isLocated,
  DEFAULT_ZOOM,
  type PhotoPoint,
  type PhotoOverlaySetting,
} from '../../types/photo';
import {
  newCollectionId,
  nextCollectionColor,
  type Collection,
} from '../../types/collection';
import {
  deriveSchedule,
  photoClip,
  collectionClip,
  gapClip,
  newClipId,
  type TimelineClip,
} from '../../types/timeline';
import { moveSelectedBlock, chronological } from '../../lib/binOps';
import {
  saveProjectCache,
  loadProjectCache,
  clearProjectCache,
} from '../../lib/projectCache';
import { useContextMenu } from './useContextMenu';
import ResizeHandle from '../layout/ResizeHandle';
import useElementSize from '../layout/useElementSize';
import { computeLetterbox, clamp, ASPECT_OPTIONS, type AspectId } from '../../lib/layout';
import {
  loadUiPrefs,
  saveUiPrefs,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  BOTTOM_AREA_HEIGHT_MIN,
  BOTTOM_AREA_HEIGHT_MAX,
  INSPECTOR_WIDTH_MIN,
  INSPECTOR_WIDTH_MAX,
  type OverlayMode,
  type SmallOverlayPos,
} from '../../lib/uiPrefs';

/** Triggers a browser download for a Blob. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PhotoTrackPage() {
  const [images, setImages] = useState<PhotoPoint[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [timeline, setTimeline] = useState<TimelineClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  /** All selected clips (Ctrl/Cmd toggle, Shift range); superset of selectedClipId. */
  const [selectedClipIds, setSelectedClipIds] = useState<ReadonlySet<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** Current clip's move/hold phase (drives the 'auto' overlay mode). */
  const [phase, setPhase] = useState<'move' | 'hold'>('hold');
  /** false = overview framing; true = follow the current clip. */
  const [preview, setPreview] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Photo being located on the map via 右键 → 在地图上定位 (overrides framing). */
  const [focusPhotoId, setFocusPhotoId] = useState<string | null>(null);
  const [isChina, setIsChina] = useState(false);
  const [provider, setProvider] = useState<ChinaProvider>('amap');
  const [compress, setCompress] = useState(true);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  /** The item currently being dragged (drives the DragOverlay preview). */
  const [activeDrag, setActiveDrag] = useState<{ type: 'bin' | 'clip'; id: string } | null>(null);

  // ---- device-local UI layout preferences (localStorage-backed) ----
  const [initialPrefs] = useState(loadUiPrefs);
  const [sidebarWidth, setSidebarWidth] = useState(initialPrefs.sidebarWidth);
  const [sidebarSide, setSidebarSide] = useState(initialPrefs.sidebarSide);
  const [bottomAreaHeight, setBottomAreaHeight] = useState(initialPrefs.bottomAreaHeight);
  const [inspectorWidth, setInspectorWidth] = useState(initialPrefs.inspectorWidth);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>(initialPrefs.overlayMode);
  const [aspect, setAspect] = useState<AspectId>(initialPrefs.aspect);
  const [smallOverlayPos, setSmallOverlayPos] = useState<SmallOverlayPos | null>(
    initialPrefs.smallOverlayPos
  );
  const [sidebarTab, setSidebarTab] = useState<'bin' | 'collections'>('bin');
  const [mapFullscreen, setMapFullscreen] = useState(false);

  // Persist layout prefs (debounced; best-effort).
  useEffect(() => {
    const t = window.setTimeout(
      () =>
        saveUiPrefs({
          sidebarWidth,
          sidebarSide,
          bottomAreaHeight,
          inspectorWidth,
          overlayMode,
          aspect,
          smallOverlayPos,
        }),
      300
    );
    return () => window.clearTimeout(t);
  }, [sidebarWidth, sidebarSide, bottomAreaHeight, inspectorWidth, overlayMode, aspect, smallOverlayPos]);

  // The map area is the fullscreen target and the letterbox reference frame.
  const mapAreaRef = useRef<HTMLDivElement | null>(null);
  const [mapAreaSizeRef, mapAreaSize] = useElementSize<HTMLDivElement>();
  const setMapAreaEl = useCallback(
    (el: HTMLDivElement | null) => {
      mapAreaRef.current = el;
      mapAreaSizeRef(el);
    },
    [mapAreaSizeRef]
  );
  const letterbox = computeLetterbox(mapAreaSize.width, mapAreaSize.height, aspect);

  useEffect(() => {
    const onFullscreenChange = () =>
      setMapFullscreen(
        document.fullscreenElement !== null && document.fullscreenElement === mapAreaRef.current
      );
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleMapFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void mapAreaRef.current?.requestFullscreen();
  };

  const timelineRef = useRef<TimelineHandle>(null);
  const refImagesInputRef = useRef<HTMLInputElement>(null);
  const pendingReference = useRef<Manifest | null>(null);

  /** Last session's auto-cached project (metadata only — no image data). */
  const [cachedProject, setCachedProject] = useState(loadProjectCache);

  const located = useMemo(() => images.filter(isLocated), [images]);
  const photoById = useMemo(() => new Map(images.map((p) => [p.id, p])), [images]);
  const collectionById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);

  const { boundaries, total } = useMemo(() => deriveSchedule(timeline), [timeline]);

  const clampedIndex = timeline.length
    ? Math.max(0, Math.min(currentIndex, timeline.length - 1))
    : 0;
  const currentClip = timeline.length ? timeline[clampedIndex] : null;
  const selectedClip = useMemo(
    () => timeline.find((c) => c.id === selectedClipId) ?? null,
    [timeline, selectedClipId]
  );

  // Per-clip presentation for the timeline track.
  const clipInfos = useMemo<ClipInfo[]>(
    () =>
      timeline.map((clip) => {
        if (clip.kind === 'photo') {
          const p = clip.refId ? photoById.get(clip.refId) : undefined;
          return { kind: 'photo', label: p ? p.name : '(已删除)', color: '#2e7d6b', thumbUrl: p?.url };
        }
        if (clip.kind === 'collection') {
          const c = clip.refId ? collectionById.get(clip.refId) : undefined;
          return { kind: 'collection', label: c ? c.name : '(已删除)', color: c ? c.color : '#888' };
        }
        return { kind: 'gap', label: '空白', color: '#dfe3e8' };
      }),
    [timeline, photoById, collectionById]
  );

  // Resolve the map framing target from the current clip (gaps carry the
  // previous non-gap view forward; animate only on the active clip while playing).
  const resolveTarget = useCallback(
    (index: number): ViewTarget => {
      for (let i = index; i >= 0; i--) {
        const clip = timeline[i];
        if (!clip || clip.kind === 'gap') continue;
        if (clip.kind === 'photo') {
          const p = clip.refId ? photoById.get(clip.refId) : undefined;
          if (p && isLocated(p)) {
            return {
              kind: 'photo',
              photoId: p.id,
              zoom: clip.zoom ?? p.zoom ?? DEFAULT_ZOOM,
              moveDuration: clip.moveDuration,
              animate: playing && i === index,
            };
          }
          continue;
        }
        if (clip.kind === 'collection') {
          const c = clip.refId ? collectionById.get(clip.refId) : undefined;
          if (c) {
            return {
              kind: 'collection',
              collectionId: c.id,
              moveDuration: clip.moveDuration,
              animate: playing && i === index,
            };
          }
        }
      }
      return { kind: 'overview' };
    },
    [timeline, photoById, collectionById, playing]
  );

  // 右键 → 在地图上定位 takes precedence over the timeline-driven framing.
  // Memoized so the (memoized) MapView doesn't reconcile on unrelated renders.
  const focusPhoto = focusPhotoId ? photoById.get(focusPhotoId) : undefined;
  const hasTimeline = timeline.length > 0;
  const target: ViewTarget = useMemo(
    () =>
      focusPhoto && isLocated(focusPhoto)
        ? {
            kind: 'photo',
            photoId: focusPhoto.id,
            zoom: focusPhoto.zoom ?? DEFAULT_ZOOM,
            moveDuration: 0.8,
            animate: true,
          }
        : preview && hasTimeline
        ? resolveTarget(clampedIndex)
        : { kind: 'overview' },
    [focusPhoto, preview, hasTimeline, clampedIndex, resolveTarget]
  );

  // The photo to showcase in the overlay (only on a photo clip while previewing).
  const overlayPhoto =
    !focusPhotoId && preview && currentClip && currentClip.kind === 'photo' && currentClip.refId
      ? photoById.get(currentClip.refId) ?? null
      : null;

  // Paused = presentation state: always show the large ("hold") layout.
  const effectivePhase = playing ? phase : 'hold';

  // Per-photo overlay override: 'hidden' shows no card, other values replace
  // the global mode for this photo only.
  const photoOverlaySetting = overlayPhoto?.overlay;
  const effectiveOverlayMode: OverlayMode =
    photoOverlaySetting && photoOverlaySetting !== 'hidden' ? photoOverlaySetting : overlayMode;
  const shownOverlayPhoto = photoOverlaySetting === 'hidden' ? null : overlayPhoto;

  // Shift the focused marker clear of the overlay (sized from the letterboxed
  // viewport so the framing is proportional on every device).
  const focusOffset = useMemo(
    () =>
      overlayFocusOffset(
        shownOverlayPhoto ? effectiveOverlayMode : 'none',
        letterbox.width,
        letterbox.height
      ),
    [shownOverlayPhoto, effectiveOverlayMode, letterbox.width, letterbox.height]
  );

  // WGS-84 targets of the upcoming clips (skipping gaps), to warm tiles ahead
  // of arrival. Looks ahead up to two real targets.
  const prefetch = useMemo(() => {
    if (!preview) return null;
    const targets: { lat: number; lng: number; zoom: number }[] = [];
    for (let i = clampedIndex + 1; i < timeline.length && targets.length < 2; i++) {
      const clip = timeline[i];
      if (clip.kind === 'photo' && clip.refId) {
        const p = photoById.get(clip.refId);
        if (p && isLocated(p)) {
          targets.push({ lat: p.lat, lng: p.lng, zoom: clip.zoom ?? p.zoom ?? DEFAULT_ZOOM });
        }
      } else if (clip.kind === 'collection' && clip.refId) {
        const c = collectionById.get(clip.refId);
        const first = c?.photoIds.map((id) => photoById.get(id)).find((p) => p && isLocated(p));
        if (first && isLocated(first)) {
          targets.push({ lat: first.lat, lng: first.lng, zoom: DEFAULT_ZOOM });
        }
      }
    }
    return targets.length ? targets : null;
  }, [preview, timeline, clampedIndex, photoById, collectionById]);

  // Warm the next photo clips' images (cache + decoder) so the overlay paints
  // instantly on clip switch instead of loading the blob mid-transition.
  const nextPhotoUrls = useMemo(() => {
    if (!preview) return [];
    const urls: string[] = [];
    for (let i = clampedIndex + 1; i < timeline.length && urls.length < 2; i++) {
      const clip = timeline[i];
      if (clip.kind !== 'photo' || !clip.refId) continue;
      const p = photoById.get(clip.refId);
      if (p) urls.push(p.url);
    }
    return urls;
  }, [preview, timeline, clampedIndex, photoById]);
  const warmedImagesRef = useRef<HTMLImageElement[]>([]);
  useEffect(() => {
    // Hold the elements until the lookahead changes so the decode isn't discarded.
    warmedImagesRef.current = nextPhotoUrls.map((u) => {
      const img = new Image();
      img.src = u;
      img.decode?.().catch(() => {});
      return img;
    });
  }, [nextPhotoUrls]);

  const selectedClipLabel = selectedClip ? clipInfos[timeline.indexOf(selectedClip)]?.label ?? '' : '';

  // ---- clip selection (multi-select: Ctrl/Cmd toggle, Shift range) ----

  const clipSelectAnchor = useRef<string | null>(null);

  /** Single-selects a clip (or clears when null), keeping both states in sync. */
  const selectOnlyClip = useCallback((id: string | null) => {
    setSelectedClipId(id);
    setSelectedClipIds(id ? new Set([id]) : new Set());
    clipSelectAnchor.current = id;
  }, []);

  const handleSelectClip = useCallback(
    (id: string, e?: React.MouseEvent) => {
      const toggle = !!e && (e.ctrlKey || e.metaKey);
      const shift = !!e && e.shiftKey;
      if (shift && clipSelectAnchor.current && clipSelectAnchor.current !== id) {
        const ids = timeline.map((c) => c.id);
        const a = ids.indexOf(clipSelectAnchor.current);
        const b = ids.indexOf(id);
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          const next = new Set(selectedClipIds);
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
          setSelectedClipIds(next);
          setSelectedClipId(id);
          return;
        }
      }
      if (toggle) {
        clipSelectAnchor.current = id;
        const next = new Set(selectedClipIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedClipIds(next);
        setSelectedClipId(next.has(id) ? id : next.values().next().value ?? null);
        return;
      }
      selectOnlyClip(id);
    },
    [timeline, selectedClipIds, selectOnlyClip]
  );

  // Prune the clip selection when clips disappear (delete, project load, …).
  useEffect(() => {
    const ids = new Set(timeline.map((c) => c.id));
    setSelectedClipIds((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
    setSelectedClipId((cur) => (cur && !ids.has(cur) ? null : cur));
  }, [timeline]);

  // ---- photo import / project I/O ----

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const merged = await readPhotosFromFiles(files, images);
    setImages(merged);
    setSnackbar(`素材库共有 ${merged.filter(isLocated).length} 张有效图片`);
    e.target.value = '';
  };

  const replaceProject = (
    photos: PhotoPoint[],
    cols: Collection[],
    clips: TimelineClip[],
    msg: string
  ) => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages(photos);
    setCollections(cols);
    setTimeline(clips);
    setSelectedIds(new Set());
    selectOnlyClip(null);
    setCurrentIndex(0);
    setPreview(false);
    setSnackbar(msg);
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { photos, collections: cols, timeline: clips } = await importProject(file);
      replaceProject(photos, cols, clips, `已载入项目：${photos.length} 张图片，${clips.length} 个片段`);
    } catch (err) {
      console.error(err);
      setSnackbar(err instanceof Error ? err.message : '项目文件载入失败');
    }
  };

  const handleReferenceJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      pendingReference.current = await parseReferenceJson(file);
      setSnackbar('请选择原始图片所在的文件/文件夹以恢复');
      refImagesInputRef.current?.click();
    } catch (err) {
      console.error(err);
      setSnackbar('引用文件无法解析');
    }
  };

  const handleReferenceImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const manifest = pendingReference.current;
    pendingReference.current = null;
    if (!manifest) return;
    const { photos, collections: cols, timeline: clips } = applyReference(manifest, files);
    const totalPhotos = manifest.photos.length;
    replaceProject(photos, cols, clips, `已按引用恢复 ${photos.length}/${totalPhotos} 张图片`);
  };

  const settingsOf = (): ProjectSettings => ({
    defaultDuration: DEFAULT_DURATION,
    isChina,
    provider,
  });

  const handleExportFull = async () => {
    if (images.length === 0) return setSnackbar('没有可导出的图片');
    setSnackbar('正在打包…');
    try {
      const blob = await exportProject(images, settingsOf(), collections, timeline, { compress });
      downloadBlob(blob, `pic-time-machine-${Date.now()}.zip`);
      setSnackbar('完整项目已导出');
    } catch (err) {
      console.error(err);
      setSnackbar('导出失败');
    }
  };

  const handleExportReference = () => {
    if (images.length === 0) return setSnackbar('没有可导出的图片');
    const blob = exportReference(images, settingsOf(), collections, timeline);
    downloadBlob(blob, `pic-time-machine-ref-${Date.now()}.json`);
    setSnackbar('引用文件已导出（不含图片）');
  };

  // ---- photo (bin) edits ----

  const handleDeleteAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    setCollections([]);
    setTimeline([]);
    setSelectedIds(new Set());
    selectOnlyClip(null);
    setCurrentIndex(0);
    setPreview(false);
    // 清空 is an explicit reset — drop the session cache too.
    clearProjectCache();
    setCachedProject(null);
  };

  // Auto-cache the project metadata locally (debounced; never the image bytes).
  // Skips empty states so a fresh page load doesn't wipe a restorable cache.
  useEffect(() => {
    if (images.length === 0) return;
    const t = window.setTimeout(
      () =>
        saveProjectCache(
          images,
          { defaultDuration: DEFAULT_DURATION, isChina, provider },
          collections,
          timeline
        ),
      1000
    );
    return () => window.clearTimeout(t);
  }, [images, collections, timeline, isChina, provider]);

  /** Restore banner action: re-select the original image files. */
  const restoreFromCache = () => {
    if (!cachedProject) return;
    pendingReference.current = cachedProject.manifest;
    refImagesInputRef.current?.click();
  };

  /** Deletes a set of photos: revokes URLs, strips collections & clips, clears selection. */
  const deletePhotos = useCallback((ids: ReadonlySet<string>) => {
    setImages((prev) => {
      prev.filter((p) => ids.has(p.id)).forEach((p) => URL.revokeObjectURL(p.url));
      return prev.filter((p) => !ids.has(p.id));
    });
    setCollections((prev) =>
      prev.map((c) => ({ ...c, photoIds: c.photoIds.filter((p) => !ids.has(p)) }))
    );
    setTimeline((prev) => prev.filter((c) => !(c.kind === 'photo' && c.refId && ids.has(c.refId))));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setFocusPhotoId((cur) => (cur && ids.has(cur) ? null : cur));
  }, []);

  const handleDeleteOne = useCallback((id: string) => deletePhotos(new Set([id])), [deletePhotos]);

  const handleDescriptionChange = useCallback((id: string, description: string) => {
    setImages((prev) => prev.map((p) => (p.id === id ? { ...p, description } : p)));
  }, []);

  /** Sets/clears a photo's playback overlay override (saved into the project file). */
  const setPhotoOverlay = useCallback((id: string, overlay: PhotoOverlaySetting | undefined) => {
    setImages((prev) => prev.map((p) => (p.id === id ? { ...p, overlay } : p)));
  }, []);

  const handleSortByTime = () => setImages((prev) => chronological(prev));

  // ---- timeline edits ----

  const addPhotoToTimeline = (id: string) => {
    const p = photoById.get(id);
    if (!p || !isLocated(p)) return;
    const clip = photoClip(id, p.zoom ?? DEFAULT_ZOOM);
    setTimeline((prev) => [...prev, clip]);
    selectOnlyClip(clip.id);
    setSnackbar(`已加入时间线：${p.name}`);
  };

  const addCollectionToTimeline = (id: string) => {
    const c = collectionById.get(id);
    if (!c) return;
    const clip = collectionClip(id);
    setTimeline((prev) => [...prev, clip]);
    selectOnlyClip(clip.id);
    setSnackbar(`已加入组合片段：${c.name}`);
  };

  const addGapToTimeline = () => {
    const clip = gapClip();
    setTimeline((prev) => [...prev, clip]);
    selectOnlyClip(clip.id);
  };

  /** Appends the given photos (located ones, capture-time order) as clips. */
  const addPhotosToTimeline = useCallback(
    (ids: ReadonlySet<string>) => {
      const photos = chronological(
        images.filter((p) => ids.has(p.id) && isLocated(p))
      );
      if (photos.length === 0) {
        setSnackbar('所选图片没有位置信息，不能加入时间线');
        return;
      }
      const clips = photos.map((p) => photoClip(p.id, p.zoom ?? DEFAULT_ZOOM));
      setTimeline((prev) => [...prev, ...clips]);
      selectOnlyClip(clips[clips.length - 1].id);
      setSnackbar(`已按时间加入 ${clips.length} 个片段`);
    },
    [images, selectOnlyClip]
  );

  const duplicateClip = useCallback((id: string) => {
    setTimeline((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], id: newClipId() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const insertGapAt = useCallback((id: string, where: 'before' | 'after') => {
    setTimeline((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(where === 'before' ? idx : idx + 1, 0, gapClip());
      return next;
    });
  }, []);

  // ---- drag & drop (single page-level DndContext: bin reorder, clip reorder,
  // and dragging a bin photo onto the clip track to insert a clip) ----

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Prefer what's directly under the pointer; fall back to nearest centers so
  // dragging from the bin over the thin clip strip still resolves a target.
  // Clip drags only ever target other clips — never the whole-track droppable —
  // so releases over connector gaps / trailing space resolve to the nearest clip
  // instead of silently cancelling.
  const dndCollision: CollisionDetection = useCallback((args) => {
    if (String(args.active.id).startsWith(CLIP_DND_PREFIX)) {
      const clipContainers = args.droppableContainers.filter((c) =>
        String(c.id).startsWith(CLIP_DND_PREFIX)
      );
      return closestCenter({ ...args, droppableContainers: clipContainers });
    }
    const within = pointerWithin(args);
    return within.length > 0 ? within : closestCenter(args);
  }, []);

  type DndTarget = { type: 'bin' | 'clip' | 'track'; id: string } | null;
  const parseDndId = (raw: string | number): DndTarget => {
    const s = String(raw);
    if (s.startsWith(BIN_DND_PREFIX)) return { type: 'bin', id: s.slice(BIN_DND_PREFIX.length) };
    if (s.startsWith(CLIP_DND_PREFIX)) return { type: 'clip', id: s.slice(CLIP_DND_PREFIX.length) };
    if (s === TIMELINE_TRACK_DROP_ID) return { type: 'track', id: s };
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const a = parseDndId(event.active.id);
    if (a && a.type !== 'track') setActiveDrag({ type: a.type, id: a.id });
  };

  const insertPhotoClipAt = useCallback(
    (photoId: string, beforeClipId: string | null) => {
      const p = photoById.get(photoId);
      if (!p || !isLocated(p)) {
        setSnackbar('该图片没有位置信息，不能加入时间线');
        return;
      }
      const clip = photoClip(p.id, p.zoom ?? DEFAULT_ZOOM);
      setTimeline((prev) => {
        if (beforeClipId) {
          const idx = prev.findIndex((c) => c.id === beforeClipId);
          if (idx >= 0) {
            const next = [...prev];
            next.splice(idx, 0, clip);
            return next;
          }
        }
        return [...prev, clip];
      });
      selectOnlyClip(clip.id);
      setSnackbar(`已加入时间线：${p.name}`);
    },
    [photoById, selectOnlyClip]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const a = parseDndId(active.id);
    const o = parseDndId(over.id);
    if (!a || !o) return;

    if (a.type === 'clip') {
      if (o.type === 'clip' && a.id !== o.id) {
        setTimeline((prev) => {
          const from = prev.findIndex((c) => c.id === a.id);
          const to = prev.findIndex((c) => c.id === o.id);
          if (from === -1 || to === -1) return prev;
          return arrayMove(prev, from, to);
        });
      } else if (o.type === 'track') {
        // Shouldn't happen with the clip-only collision above, but if the drop
        // still resolves to the bare track, move the clip to the end.
        setTimeline((prev) => {
          const from = prev.findIndex((c) => c.id === a.id);
          if (from === -1) return prev;
          return arrayMove(prev, from, prev.length - 1);
        });
      }
      return;
    }

    // a.type === 'bin'
    if (o.type === 'bin') {
      if (a.id === o.id) return;
      // Dragging a selected photo carries the whole selection as one block.
      setImages((prev) => moveSelectedBlock(prev, selectedIds, a.id, o.id));
      return;
    }
    if (o.type === 'clip' || o.type === 'track') {
      insertPhotoClipAt(a.id, o.type === 'clip' ? o.id : null);
    }
  };

  const dragPreviewPhoto = activeDrag?.type === 'bin' ? photoById.get(activeDrag.id) : undefined;
  const dragPreviewClipInfo =
    activeDrag?.type === 'clip'
      ? clipInfos[timeline.findIndex((c) => c.id === activeDrag.id)]
      : undefined;

  const deleteClip = (id: string) => {
    setTimeline((prev) => prev.filter((c) => c.id !== id));
  };

  /** Editing a clip that is part of a multi-selection edits the whole selection. */
  const editTargets = useCallback(
    (id: string): ReadonlySet<string> =>
      selectedClipIds.has(id) && selectedClipIds.size > 1 ? selectedClipIds : new Set([id]),
    [selectedClipIds]
  );

  const setClipMove = (id: string, seconds: number) => {
    const targets = editTargets(id);
    setTimeline((prev) =>
      prev.map((c) => (targets.has(c.id) ? { ...c, moveDuration: seconds } : c))
    );
  };
  const setClipHold = (id: string, seconds: number) => {
    const targets = editTargets(id);
    setTimeline((prev) =>
      prev.map((c) => (targets.has(c.id) ? { ...c, holdDuration: seconds } : c))
    );
  };
  const setClipZoom = (id: string, zoom: number) => {
    const targets = editTargets(id);
    setTimeline((prev) =>
      prev.map((c) => (targets.has(c.id) && c.kind === 'photo' ? { ...c, zoom } : c))
    );
  };

  /** 格式刷: copies the source clip's move/hold/zoom onto the target clips. */
  const applyClipStyle = useCallback((sourceId: string, targetIds: ReadonlySet<string>) => {
    setTimeline((prev) => {
      const src = prev.find((c) => c.id === sourceId);
      if (!src) return prev;
      return prev.map((c) => {
        if (c.id === sourceId || !targetIds.has(c.id)) return c;
        return {
          ...c,
          moveDuration: src.moveDuration,
          holdDuration: src.holdDuration,
          // zoom only applies to photo clips; keep the target's own zoom
          // when the source has none.
          ...(c.kind === 'photo' && src.zoom !== undefined ? { zoom: src.zoom } : {}),
        };
      });
    });
    const count = [...targetIds].filter((t) => t !== sourceId).length;
    setSnackbar(`已将片段设置应用到 ${count} 个片段`);
  }, []);

  // ---- selection (multi-select with shift range) ----

  const selectAnchor = useRef<string | null>(null);

  const toggleSelect = useCallback(
    (id: string, e?: React.MouseEvent | React.ChangeEvent) => {
      const shift = !!e && 'shiftKey' in e && (e as React.MouseEvent).shiftKey;
      if (shift && selectAnchor.current && selectAnchor.current !== id) {
        const ids = images.map((p) => p.id);
        const a = ids.indexOf(selectAnchor.current);
        const b = ids.indexOf(id);
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          setSelectedIds((prev) => {
            const next = new Set(prev);
            for (let i = lo; i <= hi; i++) next.add(ids[i]);
            return next;
          });
          return;
        }
      }
      selectAnchor.current = id;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [images]
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ---- collections ----

  const createCollectionFromSelection = () => {
    if (selectedIds.size === 0) return;
    const collection: Collection = {
      id: newCollectionId(),
      name: `组合 ${collections.length + 1}`,
      comment: '',
      color: nextCollectionColor(collections.length),
      photoIds: [...selectedIds],
    };
    setCollections((prev) => [...prev, collection]);
    setSelectedIds(new Set());
    setSnackbar(`已创建组合（${collection.photoIds.length} 张）`);
  };

  const deleteCollection = (id: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id));
    setTimeline((prev) => prev.filter((c) => !(c.kind === 'collection' && c.refId === id)));
  };

  const renameCollection = (id: string, name: string) =>
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));

  const setCollectionComment = (id: string, comment: string) =>
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, comment } : c)));

  const addPhotosToCollection = useCallback((collectionId: string, ids: ReadonlySet<string>) => {
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId
          ? { ...c, photoIds: Array.from(new Set([...c.photoIds, ...ids])) }
          : c
      )
    );
  }, []);

  const removePhotosFromCollection = useCallback((collectionId: string, ids: ReadonlySet<string>) => {
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId ? { ...c, photoIds: c.photoIds.filter((p) => !ids.has(p)) } : c
      )
    );
  }, []);

  const addSelectedTo = (id: string) => addPhotosToCollection(id, selectedIds);
  const removeSelectedFrom = (id: string) => removePhotosFromCollection(id, selectedIds);

  // ---- playback / framing ----

  const enterOverview = () => {
    setPreview(false);
    setFocusPhotoId(null);
    timelineRef.current?.pause();
  };

  const enterPreview = useCallback(() => {
    setPreview(true);
    setFocusPhotoId(null);
  }, []);

  /** 右键 → 在地图上定位: pause playback and frame this photo. */
  const locatePhoto = useCallback((id: string) => {
    timelineRef.current?.pause();
    setFocusPhotoId(id);
  }, []);

  // ---- context menus (bin photo / timeline clip / collection card) ----

  const binMenu = useContextMenu<string>();
  const clipMenu = useContextMenu<string>();
  const collectionMenu = useContextMenu<string>();
  /** Second-level state of the bin menu (choose a collection to add/remove). */
  const [binMenuStage, setBinMenuStage] = useState<'root' | 'add' | 'remove'>('root');

  const openBinMenu = useCallback(
    (e: React.MouseEvent, photoId: string) => {
      setBinMenuStage('root');
      binMenu.open(e, photoId);
    },
    [binMenu]
  );

  // Right-clicking a selected row acts on the whole selection; otherwise just
  // on the clicked photo.
  const binMenuTargets = useMemo<ReadonlySet<string>>(() => {
    if (!binMenu.state) return new Set<string>();
    const id = binMenu.state.payload;
    return selectedIds.has(id) ? selectedIds : new Set([id]);
  }, [binMenu.state, selectedIds]);
  const binMenuPhoto = binMenu.state ? photoById.get(binMenu.state.payload) : undefined;

  /** 格式刷 targets: the selected clips minus the right-clicked source clip. */
  const clipMenuApplyTargets = useMemo<ReadonlySet<string>>(() => {
    if (!clipMenu.state) return new Set<string>();
    const next = new Set(selectedClipIds);
    next.delete(clipMenu.state.payload);
    return next;
  }, [clipMenu.state, selectedClipIds]);

  return (
    <DndContext
      sensors={dndSensors}
      collisionDetection={dndCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Top toolbar */}
      <Paper square elevation={0} sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h6" sx={{ mr: 1 }}>
            图片时光机
          </Typography>

          <ToggleButtonGroup
            exclusive
            size="small"
            color="primary"
            value={isChina ? 'china' : 'world'}
            onChange={(_e, v) => v && setIsChina(v === 'china')}
          >
            <ToggleButton value="world">外国 (OSM)</ToggleButton>
            <ToggleButton value="china">中国</ToggleButton>
          </ToggleButtonGroup>

          {isChina && (
            <ToggleButtonGroup
              exclusive
              size="small"
              color="primary"
              value={provider}
              onChange={(_e, v: ChinaProvider | null) => v && setProvider(v)}
            >
              <ToggleButton value="amap">高德地图</ToggleButton>
              <ToggleButton value="tianditu">天地图</ToggleButton>
            </ToggleButtonGroup>
          )}

          <Button
            variant={preview ? 'outlined' : 'contained'}
            size="small"
            startIcon={<PublicIcon />}
            onClick={enterOverview}
          >
            总览
          </Button>

          <Tooltip title="画面比例（固定后居中留边，便于录屏）">
            <ToggleButtonGroup
              exclusive
              size="small"
              color="primary"
              value={aspect}
              onChange={(_e, v: AspectId | null) => v && setAspect(v)}
            >
              {ASPECT_OPTIONS.map((o) => (
                <ToggleButton key={o.id} value={o.id}>
                  {o.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Tooltip>

          <Tooltip title="播放时照片的展示方式（自动 = 飞行时小图、停留时大图；小图卡片可拖动摆放）">
            <ToggleButtonGroup
              exclusive
              size="small"
              color="primary"
              value={overlayMode}
              onChange={(_e, v: OverlayMode | null) => v && setOverlayMode(v)}
            >
              <ToggleButton value="center">居中大图</ToggleButton>
              <ToggleButton value="side">侧边大图</ToggleButton>
              <ToggleButton value="small">常驻小图</ToggleButton>
              <ToggleButton value="auto">自动</ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          <Button variant="outlined" size="small" component="label" startIcon={<FolderOpenIcon />}>
            打开项目
            <input type="file" hidden accept=".zip" onChange={handleImportZip} />
          </Button>
          <Button variant="outlined" size="small" component="label" startIcon={<LinkIcon />}>
            打开引用
            <input type="file" hidden accept=".json" onChange={handleReferenceJson} />
          </Button>
          <input
            type="file"
            hidden
            multiple
            accept="image/*"
            ref={refImagesInputRef}
            onChange={handleReferenceImages}
          />
          <Button variant="outlined" size="small" startIcon={<SaveAltIcon />} onClick={handleExportFull}>
            导出(.zip)
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DescriptionOutlinedIcon />}
            onClick={handleExportReference}
          >
            导出引用(.json)
          </Button>
          <FormControlLabel
            control={<Switch size="small" checked={compress} onChange={(e) => setCompress(e.target.checked)} />}
            label="压缩"
          />
          <Button variant="outlined" size="small" startIcon={<SortIcon />} onClick={handleSortByTime}>
            按时间排序
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="secondary"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleDeleteAll}
          >
            清空
          </Button>
          <Chip label={`素材 ${images.length} · 片段 ${timeline.length}`} size="small" variant="outlined" />
        </Stack>
      </Paper>

      {/* Restore banner for the auto-cached project (metadata only) */}
      {cachedProject && images.length === 0 && (
        <Alert
          severity="info"
          sx={{ borderRadius: 0, alignItems: 'center' }}
          action={
            <Stack direction="row" spacing={1}>
              <Button color="inherit" size="small" variant="outlined" onClick={restoreFromCache}>
                恢复（重新选择图片）
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  clearProjectCache();
                  setCachedProject(null);
                }}
              >
                清除缓存
              </Button>
            </Stack>
          }
        >
          检测到上次的项目缓存：{cachedProject.manifest.photos.length} 张图片、
          {cachedProject.manifest.timeline.length} 个片段
          {cachedProject.savedAt ? `（${cachedProject.savedAt.toLocaleString()}）` : ''}
          。图片本身不会被缓存，恢复时请重新选择原图片文件。
        </Alert>
      )}

      {/* Middle: sidebar (bin / collections tabs) + resizable divider + map */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: sidebarSide === 'left' ? 'row' : 'row-reverse',
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            width: sidebarWidth,
            flexShrink: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            sx={{ borderBottom: '1px solid', borderColor: 'divider', pr: 0.5 }}
          >
            <Tabs
              value={sidebarTab}
              onChange={(_e, v) => setSidebarTab(v)}
              sx={{ flex: 1, minHeight: 40 }}
            >
              <Tab value="bin" label="素材库" sx={{ minHeight: 40 }} />
              <Tab value="collections" label={`组合 (${collections.length})`} sx={{ minHeight: 40 }} />
            </Tabs>
            <Tooltip title="切换侧边栏左右位置">
              <IconButton
                size="small"
                onClick={() => setSidebarSide((s) => (s === 'left' ? 'right' : 'left'))}
                aria-label="切换侧边栏位置"
              >
                <SwapHorizIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              p: 1.5,
              overflowY: sidebarTab === 'collections' ? 'auto' : 'hidden',
            }}
          >
            {sidebarTab === 'bin' ? (
              <MediaBin
                photos={images}
                collections={collections}
                selectedIds={selectedIds}
                onImport={handleFolderSelect}
                onAddToTimeline={addPhotoToTimeline}
                onDeleteOne={handleDeleteOne}
                onToggleSelect={toggleSelect}
                onPhotoContextMenu={openBinMenu}
                onDeleteSelected={() => deletePhotos(selectedIds)}
                onAddSelectedToTimeline={() => addPhotosToTimeline(selectedIds)}
                onAddSelectedToCollection={addSelectedTo}
                onRemoveSelectedFromCollection={removeSelectedFrom}
                onClearSelection={clearSelection}
              />
            ) : (
              <CollectionsPanel
                collections={collections}
                selectedCount={selectedIds.size}
                selectedCollectionId={null}
                onCreateFromSelection={createCollectionFromSelection}
                onDeleteCollection={deleteCollection}
                onRenameCollection={renameCollection}
                onCommentChange={setCollectionComment}
                onAddSelectedTo={addSelectedTo}
                onRemoveSelectedFrom={removeSelectedFrom}
                onAddToTimeline={addCollectionToTimeline}
                onCollectionContextMenu={collectionMenu.open}
              />
            )}
          </Box>
        </Box>

        <ResizeHandle
          orientation="vertical"
          onResize={(delta) =>
            setSidebarWidth((w) =>
              clamp(w + (sidebarSide === 'left' ? delta : -delta), SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX)
            )
          }
        />

        <Box
          ref={setMapAreaEl}
          sx={{
            flex: 1,
            minWidth: 0,
            position: 'relative',
            bgcolor: '#101418',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* The letterboxed map viewport — also the container-query frame the
              photo overlay scales against. */}
          <Box
            sx={{
              position: 'relative',
              width: aspect === 'auto' ? '100%' : Math.round(letterbox.width),
              height: aspect === 'auto' ? '100%' : Math.round(letterbox.height),
              containerType: 'size',
            }}
          >
            <MapView
              images={located}
              target={target}
              isChina={isChina}
              provider={provider}
              collections={collections}
              prefetch={prefetch}
              focusOffset={focusOffset}
            />
            <PhotoOverlay
              photo={shownOverlayPhoto}
              mode={effectiveOverlayMode}
              phase={effectivePhase}
              smallPos={smallOverlayPos}
              onSmallPosChange={setSmallOverlayPos}
            />
          </Box>

          {/* Floating map controls — rendered in-tree (no portal) so they stay
              visible while the map area is fullscreen. */}
          <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1200 }}>
            <Tooltip title={mapFullscreen ? '退出全屏' : '地图全屏'}>
              <IconButton
                size="small"
                onClick={toggleMapFullscreen}
                aria-label={mapFullscreen ? '退出全屏' : '地图全屏'}
                sx={{ bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}
              >
                {mapFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Stack>

          {mapFullscreen && (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1200,
                bgcolor: 'rgba(255,255,255,0.92)',
                borderRadius: 2,
                boxShadow: 3,
                px: 1.5,
                py: 0.5,
              }}
            >
              <IconButton
                size="small"
                color="primary"
                onClick={() => timelineRef.current?.togglePlay()}
                disabled={timeline.length === 0}
                aria-label={playing ? '暂停' : '播放'}
              >
                {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
              </IconButton>
              <IconButton size="small" onClick={toggleMapFullscreen} aria-label="退出全屏">
                <FullscreenExitIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}
        </Box>
      </Box>

      {/* Resizable divider between the map area (above) and the bottom block */}
      <ResizeHandle
        orientation="horizontal"
        onResize={(delta) =>
          setBottomAreaHeight((h) => clamp(h - delta, BOTTOM_AREA_HEIGHT_MIN, BOTTOM_AREA_HEIGHT_MAX))
        }
      />

      {/* Bottom block: timeline track | clip inspector, side by side (NLE style) */}
      <Box sx={{ height: bottomAreaHeight, flexShrink: 0, display: 'flex', minHeight: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', px: 2, pt: 1, pb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              时间线（拖动片段排序，Ctrl/Shift 点选可多选）
            </Typography>
            <Button size="small" startIcon={<AddBoxOutlinedIcon />} onClick={addGapToTimeline}>
              添加空白片段
            </Button>
          </Stack>
          <Timeline
            ref={timelineRef}
            clips={timeline}
            infos={clipInfos}
            boundaries={boundaries}
            total={total}
            selectedClipIds={selectedClipIds}
            onClipChange={setCurrentIndex}
            onPhaseChange={setPhase}
            onSelectClip={handleSelectClip}
            onUserInteract={enterPreview}
            onPlayStateChange={setPlaying}
            onClipContextMenu={clipMenu.open}
          />
        </Box>

        <ResizeHandle
          orientation="vertical"
          onResize={(delta) =>
            setInspectorWidth((w) => clamp(w - delta, INSPECTOR_WIDTH_MIN, INSPECTOR_WIDTH_MAX))
          }
        />

        {/* Clip inspector column */}
        <Box sx={{ width: inspectorWidth, flexShrink: 0, overflowY: 'auto', p: 1.5 }}>
          <ClipInspector
            clip={selectedClip}
            label={selectedClipLabel}
            photo={
              selectedClip?.kind === 'photo' && selectedClip.refId
                ? photoById.get(selectedClip.refId) ?? null
                : null
            }
            onMoveChange={setClipMove}
            onHoldChange={setClipHold}
            onZoomChange={setClipZoom}
            onDelete={deleteClip}
            onDescriptionChange={handleDescriptionChange}
            onOverlayChange={setPhotoOverlay}
            selectedCount={selectedClipIds.size}
            onApplyToSelection={(sourceId) => applyClipStyle(sourceId, selectedClipIds)}
          />
        </Box>
      </Box>

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* 素材库右键菜单（root → 选择组合的二级列表） */}
      <Menu
        open={binMenu.state !== null}
        onClose={binMenu.close}
        anchorReference="anchorPosition"
        anchorPosition={
          binMenu.state ? { top: binMenu.state.mouseY, left: binMenu.state.mouseX } : undefined
        }
      >
        {binMenuStage === 'root'
          ? [
              <MenuItem
                key="timeline"
                onClick={() => {
                  addPhotosToTimeline(binMenuTargets);
                  binMenu.close();
                }}
              >
                加入时间线{binMenuTargets.size > 1 ? `（${binMenuTargets.size} 张）` : ''}
              </MenuItem>,
              <MenuItem
                key="locate"
                disabled={!binMenuPhoto || !isLocated(binMenuPhoto)}
                onClick={() => {
                  if (binMenu.state) locatePhoto(binMenu.state.payload);
                  binMenu.close();
                }}
              >
                在地图上定位
              </MenuItem>,
              <Divider key="d1" />,
              <MenuItem
                key="addcol"
                disabled={collections.length === 0}
                onClick={() => setBinMenuStage('add')}
              >
                加入组合…
              </MenuItem>,
              <MenuItem
                key="removecol"
                disabled={collections.length === 0}
                onClick={() => setBinMenuStage('remove')}
              >
                移出组合…
              </MenuItem>,
              <Divider key="d2" />,
              <MenuItem
                key="delete"
                sx={{ color: 'secondary.main' }}
                onClick={() => {
                  deletePhotos(binMenuTargets);
                  binMenu.close();
                }}
              >
                删除{binMenuTargets.size > 1 ? `所选（${binMenuTargets.size} 张）` : ''}
              </MenuItem>,
            ]
          : collections.map((c) => (
              <MenuItem
                key={c.id}
                onClick={() => {
                  if (binMenuStage === 'add') addPhotosToCollection(c.id, binMenuTargets);
                  else removePhotosFromCollection(c.id, binMenuTargets);
                  binMenu.close();
                }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color, mr: 1 }} />
                {c.name}
              </MenuItem>
            ))}
      </Menu>

      {/* 时间线片段右键菜单 */}
      <Menu
        open={clipMenu.state !== null}
        onClose={clipMenu.close}
        anchorReference="anchorPosition"
        anchorPosition={
          clipMenu.state ? { top: clipMenu.state.mouseY, left: clipMenu.state.mouseX } : undefined
        }
      >
        <MenuItem
          onClick={() => {
            if (clipMenu.state) duplicateClip(clipMenu.state.payload);
            clipMenu.close();
          }}
        >
          复制片段
        </MenuItem>
        <MenuItem
          disabled={clipMenuApplyTargets.size === 0}
          onClick={() => {
            if (clipMenu.state) applyClipStyle(clipMenu.state.payload, clipMenuApplyTargets);
            clipMenu.close();
          }}
        >
          将设置应用到所选{clipMenuApplyTargets.size > 0 ? `（${clipMenuApplyTargets.size} 个）` : ''}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (clipMenu.state) insertGapAt(clipMenu.state.payload, 'before');
            clipMenu.close();
          }}
        >
          在前插入空白
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (clipMenu.state) insertGapAt(clipMenu.state.payload, 'after');
            clipMenu.close();
          }}
        >
          在后插入空白
        </MenuItem>
        <Divider />
        <MenuItem
          sx={{ color: 'secondary.main' }}
          onClick={() => {
            if (clipMenu.state) deleteClip(clipMenu.state.payload);
            clipMenu.close();
          }}
        >
          删除片段
        </MenuItem>
      </Menu>

      {/* 组合右键菜单 */}
      <Menu
        open={collectionMenu.state !== null}
        onClose={collectionMenu.close}
        anchorReference="anchorPosition"
        anchorPosition={
          collectionMenu.state
            ? { top: collectionMenu.state.mouseY, left: collectionMenu.state.mouseX }
            : undefined
        }
      >
        <MenuItem
          onClick={() => {
            if (collectionMenu.state) addCollectionToTimeline(collectionMenu.state.payload);
            collectionMenu.close();
          }}
        >
          加入时间线
        </MenuItem>
        <Divider />
        <MenuItem
          sx={{ color: 'secondary.main' }}
          onClick={() => {
            if (collectionMenu.state) deleteCollection(collectionMenu.state.payload);
            collectionMenu.close();
          }}
        >
          删除组合
        </MenuItem>
      </Menu>
    </Box>

    {/* Drag preview shown while dragging a bin photo or a clip. */}
    <DragOverlay dropAnimation={null}>
      {dragPreviewPhoto ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ px: 1, py: 0.5, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 4, opacity: 0.9 }}
        >
          <Avatar variant="rounded" src={dragPreviewPhoto.url} sx={{ width: 32, height: 32 }} />
          <Typography variant="caption" noWrap sx={{ maxWidth: 140 }}>
            {dragPreviewPhoto.name}
          </Typography>
          {activeDrag && selectedIds.has(activeDrag.id) && selectedIds.size > 1 && (
            <Chip size="small" color="primary" label={`共 ${selectedIds.size} 张`} sx={{ height: 18 }} />
          )}
        </Stack>
      ) : dragPreviewClipInfo ? (
        <Box
          sx={{
            width: 76,
            height: 48,
            borderRadius: 1,
            boxShadow: 4,
            opacity: 0.9,
            bgcolor: dragPreviewClipInfo.thumbUrl ? undefined : dragPreviewClipInfo.color,
            backgroundImage: dragPreviewClipInfo.thumbUrl
              ? `url(${dragPreviewClipInfo.thumbUrl})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      ) : null}
    </DragOverlay>
    </DndContext>
  );
}

export default PhotoTrackPage;
