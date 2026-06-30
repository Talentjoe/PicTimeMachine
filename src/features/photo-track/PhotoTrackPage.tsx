import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Container,
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
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import SortIcon from '@mui/icons-material/Sort';
import PublicIcon from '@mui/icons-material/Public';
import LayersIcon from '@mui/icons-material/Layers';
import LinkIcon from '@mui/icons-material/Link';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import MapView from '../map/MapView';
import type { ChinaProvider } from '../map/tileSources';
import Timeline, { type TimelineHandle } from '../timeline/Timeline';
import PhotoList from './PhotoList';
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
import { isLocated, type PhotoPoint } from '../../types/photo';
import {
  newCollectionId,
  nextCollectionColor,
  type Collection,
} from '../../types/collection';

type Mode = 'overview' | 'playback' | 'collections';

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('overview');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [isChina, setIsChina] = useState(false);
  const [provider, setProvider] = useState<ChinaProvider>('amap');
  const [compress, setCompress] = useState(true);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const timelineRef = useRef<TimelineHandle>(null);
  const refImagesInputRef = useRef<HTMLInputElement>(null);
  const pendingReference = useRef<Manifest | null>(null);

  const located = useMemo(() => images.filter(isLocated), [images]);

  // Per-photo start offsets (seconds) and total length, over the located set.
  const { boundaries, total } = useMemo(() => {
    const b: number[] = [];
    let acc = 0;
    for (const p of located) {
      b.push(acc);
      acc += p.duration;
    }
    return { boundaries: b, total: acc };
  }, [located]);

  const clampedIndex = located.length
    ? Math.max(0, Math.min(currentIndex, located.length - 1))
    : 0;

  // Which collections drive the map in collections mode (one focused, or all).
  const mapCollections = useMemo(
    () => (selectedCollectionId ? collections.filter((c) => c.id === selectedCollectionId) : collections),
    [collections, selectedCollectionId]
  );

  const visibleImages = useMemo(() => {
    if (mode === 'playback') {
      return located.length === 0 ? [] : located.slice(0, clampedIndex + 1);
    }
    if (mode === 'collections') {
      const set = new Set<string>();
      mapCollections.forEach((c) => c.photoIds.forEach((id) => set.add(id)));
      if (set.size === 0) return located; // nothing grouped yet → show all
      return located.filter((p) => set.has(p.id));
    }
    return located; // overview
  }, [mode, located, clampedIndex, mapCollections]);

  const focusImages = useMemo(
    () => (mode === 'playback' && located.length ? located.slice(clampedIndex, clampedIndex + 1) : []),
    [mode, located, clampedIndex]
  );

  // ---- photo import / project I/O ----

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const merged = await readPhotosFromFiles(files, images);
    setImages(merged);
    setSnackbar(`总共有 ${merged.filter(isLocated).length} 张有效图片`);
    e.target.value = '';
  };

  const replaceProject = (photos: PhotoPoint[], cols: Collection[], msg: string) => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages(photos);
    setCollections(cols);
    setSelectedIds(new Set());
    setSelectedCollectionId(null);
    setCurrentIndex(0);
    setMode('overview');
    setSnackbar(msg);
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { photos, collections: cols } = await importProject(file);
      replaceProject(photos, cols, `已载入项目：${photos.length} 张图片`);
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
    const { photos, collections: cols } = applyReference(manifest, files);
    const total = manifest.photos.length;
    replaceProject(photos, cols, `已按引用恢复 ${photos.length}/${total} 张图片`);
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
      const blob = await exportProject(images, settingsOf(), collections, { compress });
      downloadBlob(blob, `pic-time-machine-${Date.now()}.zip`);
      setSnackbar('完整项目已导出');
    } catch (err) {
      console.error(err);
      setSnackbar('导出失败');
    }
  };

  const handleExportReference = () => {
    if (images.length === 0) return setSnackbar('没有可导出的图片');
    const blob = exportReference(images, settingsOf(), collections);
    downloadBlob(blob, `pic-time-machine-ref-${Date.now()}.json`);
    setSnackbar('引用文件已导出（不含图片）');
  };

  // ---- photo edits ----

  const handleDeleteAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    setCollections([]);
    setSelectedIds(new Set());
    setSelectedCollectionId(null);
    setCurrentIndex(0);
    setMode('overview');
  };

  const handleDeleteOne = (id: string) => {
    setImages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
    setCollections((prev) => prev.map((c) => ({ ...c, photoIds: c.photoIds.filter((p) => p !== id) })));
  };

  const handleReorder = (next: PhotoPoint[]) => setImages(next);

  const handleDurationChange = (id: string, seconds: number) =>
    setImages((prev) => prev.map((p) => (p.id === id ? { ...p, duration: seconds } : p)));

  const handleZoomChange = (id: string, zoom: number) =>
    setImages((prev) => prev.map((p) => (p.id === id ? { ...p, zoom } : p)));

  const handleDescriptionChange = useCallback((id: string, description: string) => {
    setImages((prev) => prev.map((p) => (p.id === id ? { ...p, description } : p)));
  }, []);

  const handleSortByTime = () =>
    setImages((prev) =>
      [...prev].sort((a, b) => {
        const ta = a.date ? a.date.getTime() : Infinity; // undated photos sink to the end
        const tb = b.date ? b.date.getTime() : Infinity;
        return ta - tb;
      })
    );

  // ---- collections ----

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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
    setMode('collections');
    setSelectedCollectionId(null);
    setSnackbar(`已创建组合（${collection.photoIds.length} 张）`);
  };

  const deleteCollection = (id: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id));
    setSelectedCollectionId((cur) => (cur === id ? null : cur));
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

  const focusCollection = (id: string) => {
    setSelectedCollectionId(id);
    setMode('collections');
    timelineRef.current?.pause();
  };

  // ---- mode switching ----

  const enterOverview = () => {
    setMode('overview');
    setSelectedCollectionId(null);
    timelineRef.current?.pause();
  };

  const enterCollections = () => {
    setMode('collections');
    setSelectedCollectionId(null);
    timelineRef.current?.pause();
  };

  const exitToPlayback = useCallback(() => setMode('playback'), []);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h5" gutterBottom>
        图片时光机
      </Typography>

      <Paper variant="outlined" sx={{ overflow: 'hidden', mb: 2 }}>
        <Box sx={{ height: '70vh' }}>
          <MapView
            images={visibleImages}
            focusImages={focusImages}
            highlight={mode === 'playback'}
            showAll={mode !== 'playback'}
            isChina={isChina}
            provider={provider}
            onDescriptionChange={handleDescriptionChange}
            collections={mapCollections}
            showCollections={mode === 'collections'}
            onSelectCollection={focusCollection}
          />
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          flexWrap="wrap"
          useFlexGap
        >
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
            variant={mode === 'overview' ? 'contained' : 'outlined'}
            startIcon={<PublicIcon />}
            onClick={enterOverview}
          >
            总览
          </Button>

          <Button
            variant={mode === 'collections' ? 'contained' : 'outlined'}
            startIcon={<LayersIcon />}
            onClick={enterCollections}
          >
            组合
          </Button>

          <Button variant="contained" component="label" startIcon={<UploadFileIcon />}>
            选择图片
            <input type="file" hidden multiple accept="image/*" onChange={handleFolderSelect} />
          </Button>

          <Button variant="outlined" component="label" startIcon={<FolderOpenIcon />}>
            打开项目
            <input type="file" hidden accept=".zip" onChange={handleImportZip} />
          </Button>

          <Button variant="outlined" component="label" startIcon={<LinkIcon />}>
            打开引用
            <input type="file" hidden accept=".json" onChange={handleReferenceJson} />
          </Button>
          {/* second step of reference import: re-select the original images */}
          <input
            type="file"
            hidden
            multiple
            accept="image/*"
            ref={refImagesInputRef}
            onChange={handleReferenceImages}
          />

          <Button variant="outlined" startIcon={<SaveAltIcon />} onClick={handleExportFull}>
            导出(.zip)
          </Button>

          <Button variant="outlined" startIcon={<DescriptionOutlinedIcon />} onClick={handleExportReference}>
            导出引用(.json)
          </Button>

          <FormControlLabel
            control={<Switch checked={compress} onChange={(e) => setCompress(e.target.checked)} />}
            label="压缩"
          />

          <Button variant="outlined" startIcon={<SortIcon />} onClick={handleSortByTime}>
            按时间排序
          </Button>

          <FormControlLabel
            control={<Switch checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />}
            label="高级选项"
          />

          <Button
            variant="outlined"
            color="secondary"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleDeleteAll}
          >
            删除全部
          </Button>

          <Chip label={`共 ${images.length} 张 · 地图 ${located.length} 张`} variant="outlined" />
        </Stack>
      </Paper>

      <Box sx={{ mb: 2 }}>
        <Timeline
          ref={timelineRef}
          totalDuration={total}
          boundaries={boundaries}
          onIndexChange={setCurrentIndex}
          onUserInteract={exitToPlayback}
        />
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          图片（拖动排序，勾选可成组，可调时长{advanced ? '/缩放' : ''}/删除）
        </Typography>
        <PhotoList
          photos={images}
          collections={collections}
          selectedIds={selectedIds}
          advanced={advanced}
          onReorder={handleReorder}
          onDeleteOne={handleDeleteOne}
          onDurationChange={handleDurationChange}
          onZoomChange={handleZoomChange}
          onToggleSelect={toggleSelect}
        />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          图片组合
        </Typography>
        <CollectionsPanel
          collections={collections}
          selectedCount={selectedIds.size}
          selectedCollectionId={selectedCollectionId}
          onCreateFromSelection={createCollectionFromSelection}
          onDeleteCollection={deleteCollection}
          onRenameCollection={renameCollection}
          onCommentChange={setCollectionComment}
          onAddSelectedTo={addSelectedTo}
          onRemoveSelectedFrom={removeSelectedFrom}
          onFocusCollection={focusCollection}
        />
      </Paper>

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
}

export default PhotoTrackPage;
