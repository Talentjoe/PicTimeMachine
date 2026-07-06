import { useEffect, useRef, useState } from 'react';
import {
  Paper,
  Stack,
  Typography,
  TextField,
  IconButton,
  Tooltip,
  Box,
  Button,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { DEFAULT_ZOOM, type PhotoPoint, type PhotoOverlaySetting } from '../../types/photo';
import { clipLength, type TimelineClip } from '../../types/timeline';

interface ClipInspectorProps {
  clip: TimelineClip | null;
  /** Human label for the selected clip (photo name / collection name / 空白). */
  label: string;
  /** The referenced photo when `clip.kind === 'photo'` (for description editing). */
  photo: PhotoPoint | null;
  onMoveChange: (id: string, seconds: number) => void;
  onHoldChange: (id: string, seconds: number) => void;
  onZoomChange: (id: string, zoom: number) => void;
  onDelete: (id: string) => void;
  /** Commits a photo's description (debounced — this rebuilds map markers). */
  onDescriptionChange: (id: string, description: string) => void;
  /** Sets/clears the photo's playback overlay override (saved in the project file). */
  onOverlayChange: (photoId: string, overlay: PhotoOverlaySetting | undefined) => void;
  /** How many clips are selected on the timeline (batch edits hit them all). */
  selectedCount: number;
  /** 格式刷: applies this clip's move/hold/zoom to every selected clip. */
  onApplyToSelection?: (sourceClipId: string) => void;
}

/**
 * Edits a photo's description against a local draft, committing debounced /
 * on blur. Committing rewrites `images`, which rebuilds the marker cluster —
 * doing that per keystroke would jank the map.
 */
const DescriptionEditor: React.FC<{
  photo: PhotoPoint;
  onDescriptionChange: (id: string, description: string) => void;
}> = ({ photo, onDescriptionChange }) => {
  const [draft, setDraft] = useState(photo.description);
  const timer = useRef<number | undefined>(undefined);

  // Re-seed the draft when another photo is selected.
  useEffect(() => {
    setDraft(photo.description);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = (value: string) => {
    window.clearTimeout(timer.current);
    if (value !== photo.description) onDescriptionChange(photo.id, value);
  };

  return (
    <TextField
      label="描述"
      size="small"
      fullWidth
      multiline
      minRows={1}
      maxRows={4}
      value={draft}
      placeholder="播放到这张图片时显示的说明文字…"
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => commit(v), 400);
      }}
      onBlur={(e) => commit(e.target.value)}
      sx={{ flex: 1, minWidth: 0, flexBasis: '100%' }}
      helperText="展示在照片卡片与标记弹窗中"
    />
  );
};

/** Edits the selected timeline clip's move/hold timing, zoom, and (for photo
 *  clips) the photo's description. */
const ClipInspector: React.FC<ClipInspectorProps> = ({
  clip,
  label,
  photo,
  onMoveChange,
  onHoldChange,
  onZoomChange,
  onDelete,
  onDescriptionChange,
  onOverlayChange,
  selectedCount,
  onApplyToSelection,
}) => {
  if (!clip) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          在时间线点选一个片段以编辑其移动/停留时间与描述。
        </Typography>
      </Paper>
    );
  }

  const kindLabel = clip.kind === 'photo' ? '图片' : clip.kind === 'collection' ? '组合' : '空白';

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ flex: 1 }} noWrap title={label}>
          片段：{kindLabel} · {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          共 {clipLength(clip).toFixed(1)}s
        </Typography>
        <Tooltip title="删除该片段">
          <IconButton size="small" color="secondary" onClick={() => onDelete(clip.id)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {selectedCount > 1 && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="caption" color="primary.main" sx={{ flex: 1 }}>
            已选 {selectedCount} 个片段，修改将同步应用
          </Typography>
          <Tooltip title="将此片段的移动/停留/缩放应用到所有选中片段">
            <Button size="small" variant="outlined" onClick={() => onApplyToSelection?.(clip.id)}>
              应用到所选
            </Button>
          </Tooltip>
        </Stack>
      )}

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <TextField
          label="移动 (秒)"
          type="number"
          size="small"
          value={clip.moveDuration}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v) && v >= 0) onMoveChange(clip.id, v);
          }}
          inputProps={{ step: 0.5, min: 0 }}
          sx={{ width: 120 }}
          helperText="地图飞行动画时长"
        />
        <TextField
          label="停留 (秒)"
          type="number"
          size="small"
          value={clip.holdDuration}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v) && v >= 0) onHoldChange(clip.id, v);
          }}
          inputProps={{ step: 0.5, min: 0 }}
          sx={{ width: 120 }}
          helperText="到达后停留时长"
        />
        {clip.kind === 'photo' && (
          <TextField
            label="缩放"
            type="number"
            size="small"
            value={clip.zoom ?? DEFAULT_ZOOM}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!Number.isNaN(v)) onZoomChange(clip.id, Math.min(19, Math.max(1, v)));
            }}
            inputProps={{ step: 1, min: 1, max: 19 }}
            sx={{ width: 100 }}
            helperText="地图缩放级别"
          />
        )}
        {clip.kind === 'photo' && photo && (
          <Box>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.25 }}>
              预览卡片（此照片专属，随项目保存）
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              color="primary"
              value={photo.overlay ?? 'default'}
              onChange={(_e, v: PhotoOverlaySetting | 'default' | null) => {
                if (v) onOverlayChange(photo.id, v === 'default' ? undefined : v);
              }}
            >
              <ToggleButton value="default">默认</ToggleButton>
              <ToggleButton value="center">居中</ToggleButton>
              <ToggleButton value="side">侧边</ToggleButton>
              <ToggleButton value="small">小图</ToggleButton>
              <ToggleButton value="hidden">隐藏</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}
        {clip.kind === 'photo' && photo && (
          <DescriptionEditor photo={photo} onDescriptionChange={onDescriptionChange} />
        )}
        {clip.kind === 'collection' && (
          <Box sx={{ alignSelf: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              组合片段会自动框选该组合的全部范围。
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default ClipInspector;
