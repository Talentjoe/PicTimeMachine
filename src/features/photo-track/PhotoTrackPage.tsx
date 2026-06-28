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
import MapView from '../map/MapView';
import type { ChinaProvider } from '../map/tileSources';
import Timeline, { type TimelineHandle } from '../timeline/Timeline';
import PhotoList from './PhotoList';
import { readPhotosFromFiles, DEFAULT_DURATION } from '../../lib/exif';
import { exportProject, importProject, type ProjectSettings } from '../../lib/project';
import { isLocated, type PhotoPoint } from '../../types/photo';

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [overview, setOverview] = useState(true);
  const [isChina, setIsChina] = useState(false);
  const [provider, setProvider] = useState<ChinaProvider>('amap');
  const [compress, setCompress] = useState(true);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const timelineRef = useRef<TimelineHandle>(null);

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

  const visibleImages = useMemo(() => {
    if (overview) return located;
    if (located.length === 0) return [];
    return located.slice(0, clampedIndex + 1);
  }, [overview, located, clampedIndex]);

  const focusImages = useMemo(() => {
    if (overview || located.length === 0) return [];
    return located.slice(clampedIndex, clampedIndex + 1);
  }, [overview, located, clampedIndex]);

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const merged = await readPhotosFromFiles(files, images);
    setImages(merged);
    setSnackbar(`总共有 ${merged.filter(isLocated).length} 张有效图片`);
    e.target.value = '';
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const loaded = await importProject(file);
      images.forEach((img) => URL.revokeObjectURL(img.url));
      setImages(loaded);
      setCurrentIndex(0);
      setOverview(true);
      setSnackbar(`已载入项目：${loaded.length} 张图片`);
    } catch (err) {
      console.error(err);
      setSnackbar(err instanceof Error ? err.message : '项目文件载入失败');
    }
  };

  const handleExport = async () => {
    if (images.length === 0) {
      setSnackbar('没有可导出的图片');
      return;
    }
    const settings: ProjectSettings = { defaultDuration: DEFAULT_DURATION, isChina, provider };
    setSnackbar('正在打包…');
    try {
      const blob = await exportProject(images, settings, { compress });
      downloadBlob(blob, `pic-time-machine-${Date.now()}.zip`);
      setSnackbar('项目已导出');
    } catch (err) {
      console.error(err);
      setSnackbar('导出失败');
    }
  };

  const handleDeleteAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    setCurrentIndex(0);
    setOverview(true);
  };

  const handleDeleteOne = (id: string) => {
    setImages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleReorder = (next: PhotoPoint[]) => setImages(next);

  const handleDurationChange = (id: string, seconds: number) => {
    setImages((prev) => prev.map((p) => (p.id === id ? { ...p, duration: seconds } : p)));
  };

  const handleDescriptionChange = useCallback((id: string, description: string) => {
    setImages((prev) => prev.map((p) => (p.id === id ? { ...p, description } : p)));
  }, []);

  const handleSortByTime = () => {
    setImages((prev) =>
      [...prev].sort((a, b) => {
        const ta = a.date ? a.date.getTime() : Infinity; // undated photos sink to the end
        const tb = b.date ? b.date.getTime() : Infinity;
        return ta - tb;
      })
    );
  };

  const handleEnterOverview = () => {
    setOverview(true);
    timelineRef.current?.pause();
  };

  const exitOverview = useCallback(() => setOverview(false), []);

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
            highlight={!overview}
            showAll={overview}
            isChina={isChina}
            provider={provider}
            onDescriptionChange={handleDescriptionChange}
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
            variant={overview ? 'contained' : 'outlined'}
            color="primary"
            startIcon={<PublicIcon />}
            onClick={handleEnterOverview}
          >
            总览
          </Button>

          <Button variant="contained" component="label" startIcon={<UploadFileIcon />}>
            选择图片
            <input type="file" hidden multiple accept="image/*" onChange={handleFolderSelect} />
          </Button>

          <Button variant="outlined" component="label" startIcon={<FolderOpenIcon />}>
            打开项目
            <input type="file" hidden accept=".zip" onChange={handleImport} />
          </Button>

          <Button variant="outlined" startIcon={<SaveAltIcon />} onClick={handleExport}>
            导出项目
          </Button>

          <FormControlLabel
            control={<Switch checked={compress} onChange={(e) => setCompress(e.target.checked)} />}
            label="压缩"
          />

          <Button variant="outlined" startIcon={<SortIcon />} onClick={handleSortByTime}>
            按时间排序
          </Button>

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
          onUserInteract={exitOverview}
        />
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          图片（拖动排序，可调每张时长/删除）
        </Typography>
        <PhotoList
          photos={images}
          onReorder={handleReorder}
          onDeleteOne={handleDeleteOne}
          onDurationChange={handleDurationChange}
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
