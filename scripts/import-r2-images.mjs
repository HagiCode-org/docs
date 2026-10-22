#!/usr/bin/env node
/**
 * Imports the R2 images named in r2-images.manifest.json into src/assets/r2/.
 *
 * Every object is downloaded first and checked against the manifest (content type,
 * AVIF brand, byte length, SHA-256 and the ispe width/height). Pool keys are checked
 * against the album index. Files are written only after every check passes, through a
 * temp file and a rename, so a failed run leaves the vendored files untouched.
 *
 * Usage (from repos/docs):
 *   npm run import:r2-images
 *   node ./scripts/import-r2-images.mjs --check      # offline: compare files with the manifest
 *   node ./scripts/import-r2-images.mjs --manifest <path> --origin <url>
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_MANIFEST_PATH = path.join(ROOT, 'r2-images.manifest.json');
export const VENDOR_DIR = 'src/assets/r2/';
/** Albums this repository may vendor from; any other album is refused before a download starts. */
export const ALLOWED_ALBUMS = ['cat-head-gallery'];
const FETCH_TIMEOUT_MS = 30_000;

/** Reads the boxes between start and end of an ISOBMFF buffer. */
function readBoxes(buf, start, end) {
  const boxes = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) {
      throw new Error(`malformed ${type} box at byte ${offset}`);
    }
    boxes.push({ type, bodyStart: offset + header, end: offset + size });
    offset += size;
  }
  return boxes;
}

function findBox(boxes, type) {
  return boxes.find((box) => box.type === type);
}

/**
 * Returns the brands of an AVIF file and the width and height of its primary item,
 * read from the ispe property linked to that item in iprp/ipma. Falls back to the first
 * ispe when the association cannot be read. Throws when the bytes are not AVIF.
 */
export function parseAvif(buf) {
  const top = readBoxes(buf, 0, buf.length);
  const ftyp = findBox(top, 'ftyp');
  if (!ftyp) throw new Error('no ftyp box');
  const brands = [];
  for (let offset = ftyp.bodyStart; offset + 4 <= ftyp.end; offset += 4) {
    brands.push(buf.toString('latin1', offset, offset + 4));
  }
  if (!brands.includes('avif') && !brands.includes('avis')) {
    throw new Error(`not an AVIF file (brands: ${brands.join(', ') || 'none'})`);
  }

  const meta = findBox(top, 'meta');
  if (!meta) throw new Error('no meta box');
  const metaChildren = readBoxes(buf, meta.bodyStart + 4, meta.end);
  const iprp = findBox(metaChildren, 'iprp');
  if (!iprp) throw new Error('no iprp box');
  const iprpChildren = readBoxes(buf, iprp.bodyStart, iprp.end);
  const ipco = findBox(iprpChildren, 'ipco');
  if (!ipco) throw new Error('no ipco box');
  const properties = readBoxes(buf, ipco.bodyStart, ipco.end);
  const ispeAt = (index) => {
    const box = properties[index - 1];
    if (!box || box.type !== 'ispe') return null;
    return { width: buf.readUInt32BE(box.bodyStart + 4), height: buf.readUInt32BE(box.bodyStart + 8) };
  };

  const pitm = findBox(metaChildren, 'pitm');
  const ipma = findBox(iprpChildren, 'ipma');
  if (pitm && ipma) {
    const primaryVersion = buf.readUInt8(pitm.bodyStart);
    const primaryId = primaryVersion === 0
      ? buf.readUInt16BE(pitm.bodyStart + 4)
      : buf.readUInt32BE(pitm.bodyStart + 4);
    const ipmaVersion = buf.readUInt8(ipma.bodyStart);
    const ipmaFlags = buf.readUIntBE(ipma.bodyStart + 1, 3);
    let offset = ipma.bodyStart + 4;
    const entryCount = buf.readUInt32BE(offset);
    offset += 4;
    for (let entry = 0; entry < entryCount; entry += 1) {
      let itemId;
      if (ipmaVersion < 1) {
        itemId = buf.readUInt16BE(offset);
        offset += 2;
      } else {
        itemId = buf.readUInt32BE(offset);
        offset += 4;
      }
      const associationCount = buf.readUInt8(offset);
      offset += 1;
      for (let association = 0; association < associationCount; association += 1) {
        let index;
        if (ipmaFlags & 1) {
          index = buf.readUInt16BE(offset) & 0x7fff;
          offset += 2;
        } else {
          index = buf.readUInt8(offset) & 0x7f;
          offset += 1;
        }
        if (itemId === primaryId) {
          const size = ispeAt(index);
          if (size) return { brands, ...size };
        }
      }
    }
  }

  const fallback = properties.findIndex((box) => box.type === 'ispe');
  if (fallback < 0) throw new Error('no ispe box');
  return { brands, ...ispeAt(fallback + 1) };
}

export function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Returns the list of problems with a downloaded or local AVIF against its manifest entry. */
export function verifyBytes(entry, buf, contentType) {
  const problems = [];
  if (contentType !== undefined && contentType !== 'image/avif') {
    problems.push(`content type is "${contentType}", expected image/avif`);
  }
  if (buf.length !== entry.bytes) {
    problems.push(`${buf.length} bytes, manifest records ${entry.bytes}`);
  }
  if (sha256Hex(buf) !== entry.sha256) {
    problems.push('sha256 differs from the manifest');
  }
  try {
    const size = parseAvif(buf);
    if (size.width !== entry.width || size.height !== entry.height) {
      problems.push(`${size.width}x${size.height}, manifest records ${entry.width}x${entry.height}`);
    }
  } catch (error) {
    problems.push(error.message);
  }
  return problems;
}

/** Checks a manifest entry's paths and fields without touching the network. */
export function validateEntryShape(entry) {
  const problems = [];
  const required = ['id', 'surface', 'component', 'album', 'objectKey', 'file', 'width', 'height', 'bytes', 'sha256'];
  for (const field of required) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
      problems.push(`${entry.id ?? '(no id)'}: missing ${field}`);
    }
  }
  if (typeof entry.file === 'string') {
    const normalized = path.posix.normalize(entry.file);
    if (!normalized.startsWith(VENDOR_DIR) || normalized.includes('..')) {
      problems.push(`${entry.id}: file must sit under ${VENDOR_DIR}`);
    }
  }
  if (!ALLOWED_ALBUMS.includes(entry.album)) {
    problems.push(`${entry.id}: album ${entry.album} is not on the allowlist (${ALLOWED_ALBUMS.join(', ')})`);
  }
  if (typeof entry.objectKey === 'string' && !entry.objectKey.startsWith(`${entry.album}/`)) {
    problems.push(`${entry.id}: objectKey must start with ${entry.album}/`);
  }
  if (entry.decorative !== true && (!entry.alt || typeof entry.alt !== 'object')) {
    problems.push(`${entry.id}: a meaningful image needs alt text per locale`);
  }
  return problems;
}

/** Offline check of one vendored file against its entry; returns problems (empty when it matches). */
export async function verifyLocalFile(entry, rootDir = ROOT) {
  let buf;
  try {
    buf = await readFile(path.join(rootDir, entry.file));
  } catch {
    return [`${entry.file} is missing`];
  }
  return verifyBytes(entry, buf);
}

async function fetchObject(origin, objectKey) {
  const url = `${origin}/${objectKey}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`${objectKey}: HTTP ${response.status}`);
  }
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  return { contentType, buf: Buffer.from(await response.arrayBuffer()) };
}

async function fetchIndex(origin, album) {
  const response = await fetch(`${origin}/${album}/index.json`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`${album}/index.json: HTTP ${response.status}`);
  }
  return response.json();
}

/** Checks each pool key against the album index: it exists, its object matches and its bytes fit the cap. */
export async function verifyPool(entry, origin) {
  const { pool } = entry;
  if (!pool) return [];
  const problems = [];
  if (pool.album !== entry.album) {
    problems.push(`${entry.id}: pool album ${pool.album} differs from entry album ${entry.album}`);
  }
  if (!Array.isArray(pool.keys) || pool.keys.length < 12 || pool.keys.length > 200) {
    problems.push(`${entry.id}: pool must hold 12 to 200 keys`);
    return problems;
  }
  if (new Set(pool.keys).size !== pool.keys.length) {
    problems.push(`${entry.id}: pool keys must be unique`);
  }
  if (pool.keys.includes(entry.objectKey.replace(`${entry.album}/`, '').replace(/\.avif$/, ''))) {
    problems.push(`${entry.id}: pool must not contain the vendored default`);
  }
  const index = await fetchIndex(origin, pool.album);
  const byKey = new Map(index.entries.map((item) => [item.key, item]));
  for (const key of pool.keys) {
    const item = byKey.get(key);
    if (!item) {
      problems.push(`${entry.id}: pool key ${key} is not in the ${pool.album} index`);
    } else if (item.objectKey !== `${pool.album}/${key}.avif`) {
      problems.push(`${entry.id}: pool key ${key} points at ${item.objectKey}`);
    } else if (item.bytes > pool.maxBytes) {
      problems.push(`${entry.id}: pool key ${key} is ${item.bytes} bytes, cap is ${pool.maxBytes}`);
    }
  }
  return problems;
}

function budgetProblems(manifest, sizes) {
  const problems = [];
  for (const [id, bytes] of sizes) {
    if (bytes > manifest.budgets.perImageBytes) {
      problems.push(`${id}: ${bytes} bytes exceeds perImageBytes ${manifest.budgets.perImageBytes}`);
    }
  }
  const total = [...sizes.values()].reduce((sum, bytes) => sum + bytes, 0);
  if (total > manifest.budgets.totalBytes) {
    problems.push(`total ${total} bytes exceeds totalBytes ${manifest.budgets.totalBytes}`);
  }
  return problems;
}

async function importAll({ manifestPath, origin }) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const sourceOrigin = origin ?? manifest.source.origin;
  const problems = manifest.entries.flatMap(validateEntryShape);
  const downloads = new Map();

  for (const entry of manifest.entries) {
    if (problems.some((problem) => problem.startsWith(`${entry.id}:`))) continue;
    try {
      const { contentType, buf } = await fetchObject(sourceOrigin, entry.objectKey);
      const entryProblems = verifyBytes(entry, buf, contentType);
      for (const problem of entryProblems) problems.push(`${entry.id}: ${problem}`);
      downloads.set(entry.id, buf);
    } catch (error) {
      problems.push(`${entry.id}: ${error.message}`);
    }
    try {
      for (const problem of await verifyPool(entry, sourceOrigin)) problems.push(problem);
    } catch (error) {
      problems.push(`${entry.id}: pool check failed: ${error.message}`);
    }
  }

  problems.push(...budgetProblems(manifest, new Map(manifest.entries.map((entry) => [entry.id, entry.bytes]))));

  if (problems.length > 0) {
    return { ok: false, problems, written: [] };
  }

  const written = [];
  const temps = [];
  try {
    for (const entry of manifest.entries) {
      const target = path.join(ROOT, entry.file);
      const temp = `${target}.${process.pid}.tmp`;
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(temp, downloads.get(entry.id));
      temps.push([temp, target]);
    }
    for (const [temp, target] of temps) {
      await rename(temp, target);
      written.push(path.relative(ROOT, target));
    }
  } catch (error) {
    await Promise.all(temps.map(([temp]) => rm(temp, { force: true })));
    return { ok: false, problems: [`write failed: ${error.message}`], written: [] };
  }
  return { ok: true, problems: [], written };
}

async function checkLocal(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const problems = manifest.entries.flatMap(validateEntryShape);
  const sizes = new Map(manifest.entries.map((entry) => [entry.id, entry.bytes]));
  for (const entry of manifest.entries) {
    for (const problem of await verifyLocalFile(entry, ROOT)) problems.push(`${entry.id}: ${problem}`);
  }
  problems.push(...budgetProblems(manifest, sizes));
  return { ok: problems.length === 0, problems, written: [] };
}

function parseArgs(argv) {
  const options = { manifestPath: DEFAULT_MANIFEST_PATH, origin: undefined, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') {
      options.check = true;
    } else if (arg === '--manifest') {
      options.manifestPath = path.resolve(argv[++index] ?? '');
    } else if (arg === '--origin') {
      options.origin = argv[++index];
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  let result;
  try {
    result = options.check
      ? await checkLocal(options.manifestPath)
      : await importAll(options);
  } catch (error) {
    result = { ok: false, problems: [`cannot read the manifest: ${error.message}`], written: [] };
  }
  if (!result.ok) {
    console.error(`R2 image ${options.check ? 'check' : 'import'} failed; no vendored file was changed:`);
    for (const problem of result.problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  if (options.check) {
    console.log('R2 vendored files match the manifest.');
  } else {
    for (const file of result.written) console.log(`wrote ${file}`);
    console.log(`Imported ${result.written.length} R2 image(s).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
