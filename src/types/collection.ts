import { newId } from './photo';

/**
 * A user-defined group of photos. Membership is many-to-many: a photo id may
 * appear in multiple collections' `photoIds`.
 *
 * On the map a collection is drawn as a convex-hull polygon over its located
 * members (see features/map/CollectionsLayer.tsx); `comment` is free-text
 * persisted in the project file.
 */
export interface Collection {
  id: string;
  name: string;
  /** Free-text note ("commit"), shown in the polygon popup and the panel. */
  comment: string;
  /** Polygon / chip colour, assigned from COLLECTION_PALETTE on creation. */
  color: string;
  /** Member photo ids (many-to-many). */
  photoIds: string[];
}

/** Distinct colours cycled through as collections are created. */
export const COLLECTION_PALETTE = [
  '#e0533d',
  '#2e7d6b',
  '#3d6be0',
  '#d39b00',
  '#8e44ad',
  '#16a085',
  '#c0392b',
  '#2c82c9',
];

export function newCollectionId(): string {
  return newId('col');
}

/** Picks the next palette colour based on how many collections already exist. */
export function nextCollectionColor(existingCount: number): string {
  return COLLECTION_PALETTE[existingCount % COLLECTION_PALETTE.length];
}
