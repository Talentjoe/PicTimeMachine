/**
 * Pure helpers for media-bin batch operations (React-free, unit-testable).
 */

/**
 * Reorders `items` after a drag: the dragged item — plus, when it is part of
 * the current selection, every selected item — moves as one contiguous block
 * (keeping its internal order) to the drop target `overId`. Dragging an
 * unselected item moves only itself. Returns the original array when the drop
 * is a no-op (target inside the moving block, unknown ids).
 */
export function moveSelectedBlock<T extends { id: string }>(
  items: T[],
  selectedIds: Set<string>,
  activeId: string,
  overId: string
): T[] {
  const movingIds = new Set(
    selectedIds.has(activeId)
      ? items.filter((i) => selectedIds.has(i.id)).map((i) => i.id)
      : [activeId]
  );
  movingIds.add(activeId);
  if (movingIds.has(overId)) return items;

  const activeIndex = items.findIndex((i) => i.id === activeId);
  const overIndex = items.findIndex((i) => i.id === overId);
  if (activeIndex === -1 || overIndex === -1) return items;

  const moving = items.filter((i) => movingIds.has(i.id));
  const rest = items.filter((i) => !movingIds.has(i.id));
  const overIndexInRest = rest.findIndex((i) => i.id === overId);
  // Dragging downward drops the block after the target, upward drops before —
  // matching how a plain two-item swap feels.
  const insertAt = activeIndex < overIndex ? overIndexInRest + 1 : overIndexInRest;
  return [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)];
}

/**
 * Sorts photos by capture time ascending; undated photos sink to the end
 * (stable for equal keys).
 */
export function chronological<T extends { date: Date | null }>(photos: T[]): T[] {
  return [...photos].sort((a, b) => {
    const ta = a.date ? a.date.getTime() : Infinity;
    const tb = b.date ? b.date.getTime() : Infinity;
    return ta - tb;
  });
}
