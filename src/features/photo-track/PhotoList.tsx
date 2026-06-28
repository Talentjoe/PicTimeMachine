import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Stack, Typography, TextField, IconButton, Avatar } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RoomIcon from '@mui/icons-material/Room';
import LocationOffIcon from '@mui/icons-material/LocationOff';
import { isLocated, type PhotoPoint } from '../../types/photo';

interface PhotoListProps {
  photos: PhotoPoint[];
  onReorder: (photos: PhotoPoint[]) => void;
  onDeleteOne: (id: string) => void;
  onDurationChange: (id: string, seconds: number) => void;
}

interface RowProps {
  photo: PhotoPoint;
  index: number;
  onDeleteOne: (id: string) => void;
  onDurationChange: (id: string, seconds: number) => void;
}

const SortableRow: React.FC<RowProps> = ({ photo, index, onDeleteOne, onDurationChange }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <Stack
      ref={setNodeRef}
      style={style}
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{ py: 1, px: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <IconButton size="small" {...attributes} {...listeners} sx={{ cursor: 'grab' }} aria-label="拖动排序">
        <DragIndicatorIcon fontSize="small" />
      </IconButton>

      <Typography variant="body2" sx={{ width: 24, color: 'text.secondary' }}>
        {index + 1}
      </Typography>

      <Avatar variant="rounded" src={photo.url} alt={photo.name} sx={{ width: 44, height: 44 }} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap title={photo.name}>
          {photo.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {photo.date ? photo.date.toLocaleString() : '无时间信息'}
          {photo.description ? ` · ${photo.description}` : ''}
        </Typography>
      </Box>

      {isLocated(photo) ? (
        <RoomIcon fontSize="small" color="action" titleAccess="含位置信息" />
      ) : (
        <LocationOffIcon fontSize="small" color="disabled" titleAccess="无位置信息（不在地图显示）" />
      )}

      <TextField
        label="秒"
        type="number"
        size="small"
        value={photo.duration}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v) && v > 0) onDurationChange(photo.id, v);
        }}
        inputProps={{ step: 0.5, min: 0.1 }}
        sx={{ width: 80 }}
      />

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
};

/** Drag-to-reorder photo list with per-photo duration and delete controls. */
const PhotoList: React.FC<PhotoListProps> = ({
  photos,
  onReorder,
  onDeleteOne,
  onDurationChange,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = photos.findIndex((p) => p.id === active.id);
    const to = photos.findIndex((p) => p.id === over.id);
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(photos, from, to));
  };

  if (photos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        暂无图片，请先选择图片或打开项目文件。
      </Typography>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={photos.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        {photos.map((photo, i) => (
          <SortableRow
            key={photo.id}
            photo={photo}
            index={i}
            onDeleteOne={onDeleteOne}
            onDurationChange={onDurationChange}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
};

export default PhotoList;
