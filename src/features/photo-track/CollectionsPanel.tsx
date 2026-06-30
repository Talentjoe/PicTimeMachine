import {
  Stack,
  Button,
  TextField,
  IconButton,
  Typography,
  Box,
  Paper,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PlaylistRemoveIcon from '@mui/icons-material/PlaylistRemove';
import type { Collection } from '../../types/collection';

interface CollectionsPanelProps {
  collections: Collection[];
  /** Number of photos currently checked in the list. */
  selectedCount: number;
  selectedCollectionId: string | null;
  onCreateFromSelection: () => void;
  onDeleteCollection: (id: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onCommentChange: (id: string, comment: string) => void;
  onAddSelectedTo: (id: string) => void;
  onRemoveSelectedFrom: (id: string) => void;
  onFocusCollection: (id: string) => void;
}

const CollectionsPanel: React.FC<CollectionsPanelProps> = ({
  collections,
  selectedCount,
  selectedCollectionId,
  onCreateFromSelection,
  onDeleteCollection,
  onRenameCollection,
  onCommentChange,
  onAddSelectedTo,
  onRemoveSelectedFrom,
  onFocusCollection,
}) => {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          disabled={selectedCount === 0}
          onClick={onCreateFromSelection}
        >
          用选中创建组合（{selectedCount}）
        </Button>
        <Typography variant="caption" color="text.secondary">
          在上方列表勾选图片后创建；一张图可属于多个组合。
        </Typography>
      </Stack>

      {collections.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          暂无组合。
        </Typography>
      ) : (
        collections.map((c) => (
          <Paper
            key={c.id}
            variant="outlined"
            sx={{
              p: 1.5,
              borderColor: selectedCollectionId === c.id ? c.color : 'divider',
              borderWidth: selectedCollectionId === c.id ? 2 : 1,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: c.color, flexShrink: 0 }} />
              <TextField
                size="small"
                variant="standard"
                value={c.name}
                onChange={(e) => onRenameCollection(c.id, e.target.value)}
                sx={{ flex: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {c.photoIds.length} 张
              </Typography>
              <Tooltip title="在地图聚焦该组合">
                <IconButton size="small" onClick={() => onFocusCollection(c.id)}>
                  <CenterFocusStrongIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="把勾选的图片加入该组合">
                <span>
                  <IconButton
                    size="small"
                    disabled={selectedCount === 0}
                    onClick={() => onAddSelectedTo(c.id)}
                  >
                    <PlaylistAddIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="把勾选的图片移出该组合">
                <span>
                  <IconButton
                    size="small"
                    disabled={selectedCount === 0}
                    onClick={() => onRemoveSelectedFrom(c.id)}
                  >
                    <PlaylistRemoveIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="删除该组合">
                <IconButton size="small" color="secondary" onClick={() => onDeleteCollection(c.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>

            <TextField
              label="备注 (commit)"
              size="small"
              fullWidth
              multiline
              minRows={1}
              value={c.comment}
              onChange={(e) => onCommentChange(c.id, e.target.value)}
              placeholder="为这个组合写点说明…"
            />
          </Paper>
        ))
      )}
    </Stack>
  );
};

export default CollectionsPanel;
