import { useCallback, useMemo, useRef, useState } from 'react';
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
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import SortIcon from '@mui/icons-material/Sort';
import PublicIcon from '@mui/icons-material/Public';
import LinkIcon from '@mui/icons-material/Link';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import MapView, { type ViewTarget } from '../map/MapView';
import PhotoOverlay from '../map/PhotoOverlay';
import type { ChinaProvider } from '../map/tileSources';
import Timeline, { type TimelineHandle, type ClipInfo } from '../timeline/Timeline';
import MediaBin from './MediaBin';
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
import { isLocated, DEFAULT_ZOOM, type PhotoPoint } from '../../types/photo';
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
  type TimelineClip,
} from '../../types/timeline';

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** false = overview framing; true = follow the current clip. */
  const [preview, setPreview] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isChina, setIsChina] = useState(false);
  const [provider, setProvider] = useState<ChinaProvider>('amap');
  const [compress, setCompress] = useState(true);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const timelineRef = useRef<TimelineHandle>(null);
  const refImagesInputRef = useRef<HTMLInputElement>(null);
  const pendingReference = useRef<Manifest | null>(null);

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

  const target: ViewTarget =
    preview && timeline.length ? resolveTarget(clampedIndex) : { kind: 'overview' };

  // The photo to showcase in the overlay (only on a photo clip while previewing).
  const overlayPhoto =
    preview && currentClip && currentClip.kind === 'photo' && currentClip.refId
      ? photoById.get(currentClip.refId) ?? null
      : null;

  // WGS-84 target of the next clip, to warm tiles ahead of arrival.
  const prefetch = useMemo(() => {
    if (!preview) return null;
    const clip = timeline[clampedIndex + 1];
    if (!clip) return null;
    if (clip.kind === 'photo' && clip.refId) {
      const p = photoById.get(clip.refId);
      if (p && isLocated(p)) return { lat: p.lat, lng: p.lng, zoom: clip.zoom ?? p.zoom ?? DEFAULT_ZOOM };
    }
    if (clip.kind === 'collection' && clip.refId) {
      const c = collectionById.get(clip.refId);
      const first = c?.photoIds.map((id) => photoById.get(id)).find((p) => p && isLocated(p));
      if (first && isLocated(first)) return { lat: first.lat, lng: first.lng, zoom: DEFAULT_ZOOM };
    }
    return null;
  }, [preview, timeline, clampedIndex, photoById, collectionById]);

  const selectedClipLabel = selectedClip ? clipInfos[timeline.indexOf(selectedClip)]?.label ?? '' : '';

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
    setSelectedClipId(null);
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
    setSelectedClipId(null);
    setCurrentIndex(0);
    setPreview(false);
  };

  const handleDeleteOne = (id: string) => {
    setImages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
    setCollections((prev) => prev.map((c) => ({ ...c, photoIds: c.photoIds.filter((p) => p !== id) })));
    // Drop any timeline clips that referenced this photo.
    setTimeline((prev) => prev.filter((c) => !(c.kind === 'photo' && c.refId === id)));
  };

  const handleDescriptionChange = useCallback((id: string, description: string) => {
    setImages((prev) => prev.map((p) => (p.id === id ? { ...p, description } : p)));
  }, []);

  const handleSortByTime = () =>
    setImages((prev) =>
      [...prev].sort((a, b) => {
        const ta = a.date ? a.date.getTime() : Infinity;
        const tb = b.date ? b.date.getTime() : Infinity;
        return ta - tb;
      })
    );

  // ---- timeline edits ----

  const addPhotoToTimeline = (id: string) => {
    const p = photoById.get(id);
    if (!p || !isLocated(p)) return;
    const clip = photoClip(id, p.zoom ?? DEFAULT_ZOOM);
    setTimeline((prev) => [...prev, clip]);
    setSelectedClipId(clip.id);
    setSnackbar(`已加入时间线：${p.name}`);
  };

  const addCollectionToTimeline = (id: string) => {
    const c = collectionById.get(id);
    if (!c) return;
    const clip = collectionClip(id);
    setTimeline((prev) => [...prev, clip]);
    setSelectedClipId(clip.id);
    setSnackbar(`已加入组合片段：${c.name}`);
  };

  const addGapToTimeline = () => {
    const clip = gapClip();
    setTimeline((prev) => [...prev, clip]);
    setSelectedClipId(clip.id);
  };

  const handleReorderClips = (next: TimelineClip[]) => setTimeline(next);

  const deleteClip = (id: string) => {
    setTimeline((prev) => prev.filter((c) => c.id !== id));
    setSelectedClipId((cur) => (cur === id ? null : cur));
  };

  const setClipMove = (id: string, seconds: number) =>
    setTimeline((prev) => prev.map((c) => (c.id === id ? { ...c, moveDuration: seconds } : c)));
  const setClipHold = (id: string, seconds: number) =>
    setTimeline((prev) => prev.map((c) => (c.id === id ? { ...c, holdDuration: seconds } : c)));
  const setClipZoom = (id: string, zoom: number) =>
    setTimeline((prev) => prev.map((c) => (c.id === id ? { ...c, zoom } : c)));

  // ---- collections ----

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  const addSelectedTo = (id: string) =>
    setCollections((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, photoIds: Array.from(new Set([...c.photoIds, ...selectedIds])) } : c
      )
    );

  const removeSelectedFrom = (id: string) =>
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, photoIds: c.photoIds.filter((p) => !selectedIds.has(p)) } : c))
    );

  // ---- playback / framing ----

  const enterOverview = () => {
    setPreview(false);
    timelineRef.current?.pause();
  };

  const enterPreview = useCallback(() => setPreview(true), []);

  return (
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

      {/* Middle: media bin + map */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Box
          sx={{
            width: 320,
            flexShrink: 0,
            p: 1.5,
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <MediaBin
            photos={images}
            collections={collections}
            selectedIds={selectedIds}
            onImport={handleFolderSelect}
            onAddToTimeline={addPhotoToTimeline}
            onDeleteOne={handleDeleteOne}
            onToggleSelect={toggleSelect}
          />
        </Box>

        <Box sx={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <MapView
            images={located}
            target={target}
            isChina={isChina}
            provider={provider}
            onDescriptionChange={handleDescriptionChange}
            collections={collections}
            prefetch={prefetch}
          />
          <PhotoOverlay photo={overlayPhoto} />
        </Box>
      </Box>

      {/* Timeline track */}
      <Box sx={{ px: 2, pt: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            时间线（拖动片段排序，点选片段可调时长）
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
          selectedClipId={selectedClipId}
          onClipChange={setCurrentIndex}
          onSelectClip={setSelectedClipId}
          onReorder={handleReorderClips}
          onUserInteract={enterPreview}
          onPlayStateChange={setPlaying}
        />
      </Box>

      {/* Bottom: clip inspector + collections */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{ p: 2, pt: 1, maxHeight: '32vh', overflowY: 'auto' }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ClipInspector
            clip={selectedClip}
            label={selectedClipLabel}
            onMoveChange={setClipMove}
            onHoldChange={setClipHold}
            onZoomChange={setClipZoom}
            onDelete={deleteClip}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              图片组合
            </Typography>
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
            />
          </Paper>
        </Box>
      </Stack>

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

export default PhotoTrackPage;
