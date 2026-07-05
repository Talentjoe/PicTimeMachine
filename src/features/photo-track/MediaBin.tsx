import { useMemo, useState, memo } from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Avatar,
  Checkbox,
  Chip,
  Button,
  Tooltip,
  Menu,
  MenuItem,
  ListItemText,
} from '@mui/material';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddToQueueIcon from '@mui/icons-material/AddToQueue';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RoomIcon from '@mui/icons-material/Room';
import LocationOffIcon from '@mui/icons-material/LocationOff';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PlaylistRemoveIcon from '@mui/icons-material/PlaylistRemove';
import ClearIcon from '@mui/icons-material/Clear';
import { isLocated, type PhotoPoint } from '../../types/photo';
import type { Collection } from '../../types/collection';

/** Sortable id prefix shared with the page-level DndContext. */
export const BIN_DND_PREFIX = 'bin:';

interface MediaBinProps {
  photos: PhotoPoint[];
  collections: Collection[];
  selectedIds: Set<string>;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Append a photo clip for this photo to the timeline. */
  onAddToTimeline: (id: string) => void;
  onDeleteOne: (id: string) => void;
  /** Toggle a photo's selection; `e` carries shift state for range select. */
  onToggleSelect: (id: string, e?: React.MouseEvent | React.ChangeEvent) => void;
  /** Right-click on a photo row (context menu). */
  onPhotoContextMenu?: (e: React.MouseEvent, photoId: string) => void;
  // ---- batch actions on the current selection ----
  onDeleteSelected: () => void;
  /** Append all located selected photos to the timeline in capture order. */
  onAddSelectedToTimeline: () => void;
  onAddSelectedToCollection: (collectionId: string) => void;
  onRemoveSelectedFromCollection: (collectionId: string) => void;
  onClearSelection: () => void;
}

interface BinRowProps {
  photo: PhotoPoint;
  memberships: { name: string; color: string }[];
  selected: boolean;
  onAddToTimeline: (id: string) => void;
  onDeleteOne: (id: string) => void;
  onToggleSelect: (id: string, e?: React.MouseEvent | React.ChangeEvent) => void;
  onPhotoContextMenu?: (e: React.MouseEvent, photoId: string) => void;
}

const BinRow = memo<BinRowProps>(
  ({ photo, memberships, selected, onAddToTimeline, onDeleteOne, onToggleSelect, onPhotoContextMenu }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: `${BIN_DND_PREFIX}${photo.id}`,
    });
    const located = isLocated(photo);

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.4 : 1,
    };

    return (
      <Stack
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        direction="row"
        spacing={1}
        alignItems="center"
        onContextMenu={onPhotoContextMenu ? (e) => onPhotoContextMenu(e, photo.id) : undefined}
        sx={{
          py: 0.75,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: selected ? 'action.selected' : 'transparent',
          cursor: 'grab',
        }}
      >
        <Checkbox
          size="small"
          checked={selected}
          onClick={(e) => onToggleSelect(photo.id, e)}
          sx={{ p: 0.25 }}
          inputProps={{ 'aria-label': '选择' }}
        />
        <Avatar variant="rounded" src={photo.url} alt={photo.name} sx={{ width: 40, height: 40 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap title={photo.name}>
            {photo.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {photo.date ? photo.date.toLocaleString() : '无时间信息'}
          </Typography>
          {memberships.length > 0 && (
            <Stack direction="row" sx={{ mt: 0.25, flexWrap: 'wrap', gap: 0.5 }}>
              {memberships.map((m) => (
                <Chip
                  key={m.name}
                  label={m.name}
                  size="small"
                  sx={{
                    bgcolor: m.color,
                    color: '#fff',
                    height: 16,
                    '& .MuiChip-label': { px: 0.5, fontSize: 10 },
                  }}
                />
              ))}
            </Stack>
          )}
        </Box>
        {located ? (
          <RoomIcon fontSize="small" color="action" titleAccess="含位置信息" />
        ) : (
          <LocationOffIcon fontSize="small" color="disabled" titleAccess="无位置信息（不能加入时间线）" />
        )}
        <Tooltip title={located ? '加入时间线' : '无位置，不能加入时间线'}>
          <span>
            <IconButton
              size="small"
              color="primary"
              disabled={!located}
              onClick={() => onAddToTimeline(photo.id)}
              aria-label="加入时间线"
            >
              <AddToQueueIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <IconButton
          size="small"
          color="secondary"
          onClick={() => onDeleteOne(photo.id)}
          aria-label="删除这张"
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Stack>
    );
  }
);

/**
 * The media bin: every imported photo, independent of the timeline. From here a
 * photo can be added to the timeline (click, or drag it onto the clip track),
 * checked for collection building, reordered by drag, or deleted (which also
 * strips its clips upstream). Rows are sortable items (`bin:<photoId>`) under
 * the page-level DndContext.
 */
const MediaBin: React.FC<MediaBinProps> = ({
  photos,
  collections,
  selectedIds,
  onImport,
  onAddToTimeline,
  onDeleteOne,
  onToggleSelect,
  onPhotoContextMenu,
  onDeleteSelected,
  onAddSelectedToTimeline,
  onAddSelectedToCollection,
  onRemoveSelectedFromCollection,
  onClearSelection,
}) => {
  // Anchors of the 加入组合 / 移出组合 dropdowns in the batch toolbar.
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const [removeMenuAnchor, setRemoveMenuAnchor] = useState<HTMLElement | null>(null);
  // photoId -> the collections it belongs to (for chips).
  const membershipByPhoto = useMemo(() => {
    const map = new Map<string, { name: string; color: string }[]>();
    for (const c of collections) {
      for (const id of c.photoIds) {
        const list = map.get(id) ?? [];
        list.push({ name: c.name, color: c.color });
        map.set(id, list);
      }
    }
    return map;
  }, [collections]);

  const locatedCount = photos.filter(isLocated).length;
  const rowIds = useMemo(() => photos.map((p) => `${BIN_DND_PREFIX}${p.id}`), [photos]);
  const EMPTY_MEMBERSHIPS = useMemo(() => [] as { name: string; color: string }[], []);

  return (
    <Stack sx={{ height: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          素材库
        </Typography>
        <Button variant="contained" size="small" component="label" startIcon={<UploadFileIcon />}>
          导入
          <input type="file" hidden multiple accept="image/*" onChange={onImport} />
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
        共 {photos.length} 张 · 含位置 {locatedCount} 张 · 按住 Shift 点击可范围多选
      </Typography>

      {selectedIds.size > 0 && (
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{
            mb: 1,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: 'action.selected',
          }}
        >
          <Typography variant="caption" sx={{ mr: 0.5 }}>
            已选 {selectedIds.size} 张
          </Typography>
          <Tooltip title="按拍摄时间加入时间线">
            <IconButton size="small" color="primary" onClick={onAddSelectedToTimeline}>
              <AddToQueueIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="加入组合…">
            <IconButton size="small" onClick={(e) => setAddMenuAnchor(e.currentTarget)}>
              <PlaylistAddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="移出组合…">
            <IconButton size="small" onClick={(e) => setRemoveMenuAnchor(e.currentTarget)}>
              <PlaylistRemoveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="删除所选">
            <IconButton size="small" color="secondary" onClick={onDeleteSelected}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="取消选择">
            <IconButton size="small" onClick={onClearSelection}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Menu
            open={addMenuAnchor !== null}
            anchorEl={addMenuAnchor}
            onClose={() => setAddMenuAnchor(null)}
          >
            {collections.length === 0 ? (
              <MenuItem disabled>暂无组合</MenuItem>
            ) : (
              collections.map((c) => (
                <MenuItem
                  key={c.id}
                  onClick={() => {
                    onAddSelectedToCollection(c.id);
                    setAddMenuAnchor(null);
                  }}
                >
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color, mr: 1 }} />
                  <ListItemText>{c.name}</ListItemText>
                </MenuItem>
              ))
            )}
          </Menu>
          <Menu
            open={removeMenuAnchor !== null}
            anchorEl={removeMenuAnchor}
            onClose={() => setRemoveMenuAnchor(null)}
          >
            {collections.length === 0 ? (
              <MenuItem disabled>暂无组合</MenuItem>
            ) : (
              collections.map((c) => (
                <MenuItem
                  key={c.id}
                  onClick={() => {
                    onRemoveSelectedFromCollection(c.id);
                    setRemoveMenuAnchor(null);
                  }}
                >
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color, mr: 1 }} />
                  <ListItemText>{c.name}</ListItemText>
                </MenuItem>
              ))
            )}
          </Menu>
        </Stack>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {photos.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            暂无图片，点击「导入」选择图片或打开项目。
          </Typography>
        ) : (
          <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
            {photos.map((photo) => (
              <BinRow
                key={photo.id}
                photo={photo}
                memberships={membershipByPhoto.get(photo.id) ?? EMPTY_MEMBERSHIPS}
                selected={selectedIds.has(photo.id)}
                onAddToTimeline={onAddToTimeline}
                onDeleteOne={onDeleteOne}
                onToggleSelect={onToggleSelect}
                onPhotoContextMenu={onPhotoContextMenu}
              />
            ))}
          </SortableContext>
        )}
      </Box>
    </Stack>
  );
};

export default MediaBin;
