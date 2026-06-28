import { useMemo, useRef, useState } from 'react';
import {
  Container,
  Paper,
  Stack,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Typography,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Box,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MapView from '../map/MapView';
import type { ChinaProvider } from '../map/tileSources';
import Timeline, { type TimelineHandle } from '../timeline/Timeline';
import { readPhotosFromFiles } from '../../lib/exif';
import { isLocated, type PhotoPoint } from '../../types/photo';

function PhotoTrackPage() {
  const [currentSecond, setCurrentSecond] = useState(0);
  const [images, setImages] = useState<PhotoPoint[]>([]);
  const [isChina, setIsChina] = useState(false);
  const [provider, setProvider] = useState<ChinaProvider>('amap');
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const timelineRef = useRef<TimelineHandle>(null);

  const located = useMemo(() => images.filter(isLocated), [images]);

  const showAll = currentSecond === 0 || currentSecond === images.length + 1;
  const visibleImages = useMemo(
    () => (showAll ? located : located.slice(0, currentSecond)),
    [located, showAll, currentSecond]
  );
  const focusImages = useMemo(
    () => located.slice(Math.max(currentSecond - 1, 0), currentSecond),
    [located, currentSecond]
  );

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const merged = await readPhotosFromFiles(files, images);
    setImages(merged);
    setSnackbar(`总共有 ${merged.filter(isLocated).length} 张有效图片`);
    e.target.value = ''; // allow re-selecting the same folder
  };

  const handleDelete = () => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    setCurrentSecond(0);
  };

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
            highlight={!showAll}
            showAll={showAll}
            isChina={isChina}
            provider={provider}
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

          <Button variant="contained" component="label" startIcon={<UploadFileIcon />}>
            选择图片
            <input type="file" hidden multiple accept="image/*" onChange={handleFolderSelect} />
          </Button>

          <Button
            variant="outlined"
            color="secondary"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleDelete}
          >
            删除全部
          </Button>

          <Chip label={`当前有 ${images.length} 张图片`} variant="outlined" />
        </Stack>
      </Paper>

      <Box sx={{ mb: 2 }}>
        <Timeline
          ref={timelineRef}
          startTime={0}
          endTime={images.length + 1}
          onSecondChange={setCurrentSecond}
        />
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          图片
        </Typography>
        <List dense>
          {images.map((img, i) => (
            <ListItem key={`${img.name}-${i}`} divider>
              <ListItemText
                primary={img.name}
                secondary={img.date ? img.date.toLocaleString() : '无时间信息'}
              />
            </ListItem>
          ))}
        </List>
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
