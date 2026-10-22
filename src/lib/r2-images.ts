/**
 * Lookups for the R2 image manifest (r2-images.manifest.json), the single record of which
 * vendored image each Docs surface uses and which decorative pool it may swap to.
 */
import manifest from '../../r2-images.manifest.json';

export interface R2ManifestEntry {
  id: string;
  surface: string;
  component: string;
  album: string;
  objectKey: string;
  file: string;
  width: number;
  height: number;
  bytes: number;
  decorative: boolean;
  pool?: {
    album: string;
    maxBytes: number;
    keys: string[];
  };
}

const entries = manifest.entries as R2ManifestEntry[];

export function getR2Entry(id: string): R2ManifestEntry {
  const entry = entries.find((item) => item.id === id);
  if (!entry) {
    throw new Error(`No R2 image entry with id "${id}" in r2-images.manifest.json.`);
  }
  return entry;
}

/** Object keys of the decorative pool, as the browser requests them from the R2 origin. */
export function getR2PoolObjectKeys(entry: R2ManifestEntry): string[] {
  if (!entry.pool) return [];
  return entry.pool.keys.map((key) => `${entry.pool!.album}/${key}.avif`);
}
