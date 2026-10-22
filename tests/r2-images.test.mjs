import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { transformSync } from 'esbuild';

import {
  VENDOR_DIR,
  validateEntryShape,
  verifyLocalFile,
} from '../scripts/import-r2-images.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'r2-images.manifest.json');
const VENDOR_ROOT = path.join(ROOT, VENDOR_DIR);
const DIST = path.join(ROOT, 'dist');
const R2_ORIGIN = 'img-gen.hagicode.com';
const POOL_KEY_PATTERN = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\.avif$/;
const PICKER_PATH = path.join(ROOT, 'src/scripts/r2-random-image.ts');

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
const entries = manifest.entries;

async function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      found.push(...(await listFiles(full)));
    } else {
      found.push(full);
    }
  }
  return found;
}

async function readText(relative) {
  return readFile(path.join(ROOT, relative), 'utf8');
}

function componentPath(entryOrSurface) {
  return entryOrSurface.component;
}

test('manifest has a schema version, budgets and well-formed entries', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.source.origin, 'https://img-gen.hagicode.com');
  assert.ok(Number.isInteger(manifest.budgets.perImageBytes) && manifest.budgets.perImageBytes > 0);
  assert.ok(Number.isInteger(manifest.budgets.totalBytes) && manifest.budgets.totalBytes > 0);
  assert.ok(entries.length > 0, 'the manifest lists at least one entry');
  assert.deepEqual(entries.flatMap(validateEntryShape), []);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length, 'entry ids are unique');
  assert.equal(new Set(entries.map((entry) => entry.file)).size, entries.length, 'files are unique');
});

test('every manifest entry matches its vendored file in bytes, hash, dimensions and AVIF brand', async () => {
  for (const entry of entries) {
    assert.deepEqual(await verifyLocalFile(entry, ROOT), [], `${entry.id} differs from ${entry.file}`);
  }
});

test('no vendored file is an orphan: every file under src/assets/r2 has a manifest entry', async () => {
  const expected = new Set(entries.map((entry) => path.join(ROOT, entry.file)));
  const found = await listFiles(VENDOR_ROOT);
  const orphans = found.filter((file) => !expected.has(file)).map((file) => path.relative(ROOT, file));
  assert.deepEqual(orphans, [], `orphan vendored file(s) with no manifest entry: ${orphans.join(', ')}`);
  const missing = [...expected].filter((file) => !found.includes(file)).map((file) => path.relative(ROOT, file));
  assert.deepEqual(missing, [], `manifest entries with no file: ${missing.join(', ')}`);
});

test('budgets hold: each vendored image and the total stay within the recorded caps', () => {
  const total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  for (const entry of entries) {
    assert.ok(
      entry.bytes <= manifest.budgets.perImageBytes,
      `${entry.id} is ${entry.bytes} bytes, perImageBytes is ${manifest.budgets.perImageBytes}`,
    );
  }
  assert.ok(total <= manifest.budgets.totalBytes, `total ${total} bytes exceeds totalBytes ${manifest.budgets.totalBytes}`);
});

test('pools: decorative only, 12 to 200 unique keys, within the cap and excluding the default', () => {
  for (const entry of entries) {
    if (!entry.pool) continue;
    assert.equal(entry.decorative, true, `${entry.id}: only a decorative slot may declare a pool`);
    assert.equal(entry.pool.album, entry.album, `${entry.id}: pool album must match the entry album`);
    assert.ok(entry.pool.keys.length >= 12 && entry.pool.keys.length <= 200, `${entry.id}: pool holds ${entry.pool.keys.length} keys`);
    assert.equal(new Set(entry.pool.keys).size, entry.pool.keys.length, `${entry.id}: pool keys are unique`);
    assert.ok(entry.pool.maxBytes <= manifest.budgets.perImageBytes, `${entry.id}: pool cap exceeds perImageBytes`);
    const defaultKey = entry.objectKey.slice(`${entry.album}/`.length).replace(/\.avif$/, '');
    assert.ok(!entry.pool.keys.includes(defaultKey), `${entry.id}: pool contains the vendored default`);
    for (const key of entry.pool.keys) {
      assert.match(`${entry.pool.album}/${key}.avif`, POOL_KEY_PATTERN, `${entry.id}: malformed pool key ${key}`);
    }
  }
});

test('meaningful images never get a pool and carry alt text for every Docs locale', async () => {
  const { DOCS_LOCALES } = await import('../src/i18n/generated/docs-locale-resources.mjs');
  const locales = Object.keys(DOCS_LOCALES).sort();
  for (const entry of entries) {
    if (entry.decorative) {
      assert.equal(entry.alt, null, `${entry.id}: a decorative image has no alt text`);
      continue;
    }
    assert.equal(entry.pool, undefined, `${entry.id}: a meaningful image must not declare a pool`);
    assert.deepEqual(Object.keys(entry.alt).sort(), locales, `${entry.id}: alt text must cover every Docs locale`);
    for (const locale of locales) {
      assert.ok(entry.alt[locale].trim().length > 0, `${entry.id}: empty alt for ${locale}`);
    }
  }
});

test('every entry is used by its surface component through the Astro asset pipeline', async () => {
  for (const entry of entries) {
    const source = await readText(componentPath(entry));
    const importPath = `@/assets/r2/${entry.file.slice(VENDOR_DIR.length)}`;
    assert.ok(source.includes(`from '${importPath}'`), `${entry.surface} does not import ${importPath}`);
    assert.ok(source.includes(`getR2Entry('${entry.id}')`), `${entry.surface} does not read manifest entry ${entry.id}`);
    assert.match(source, /<Picture\b/, `${entry.surface} must render the image with <Picture>`);
    assert.match(source, /formats=\{\['avif',\s*'webp'\]\}/, `${entry.surface} must render AVIF and WebP`);
    assert.match(source, /loading="(lazy|eager)"/, `${entry.surface} must set loading explicitly`);
    if (entry.pool) {
      assert.ok(source.includes("'data-r2-pool'"), `${entry.surface} must bake its pool list`);
      assert.ok(source.includes("from '@/scripts/r2-random-image'"), `${entry.surface} must run the picker`);
    }
  }
});

test('unchanged surfaces import no R2 asset and every manifest reason is recorded', async () => {
  const usedSurfaces = new Set(entries.map((entry) => entry.surface));
  for (const surface of manifest.unchangedSurfaces) {
    assert.ok(surface.reason && surface.reason.length > 0, `${surface.surface} needs a one-line reason`);
    assert.ok(!usedSurfaces.has(surface.surface), `${surface.surface} is both used and unchanged`);
    if (!surface.component.startsWith('src/')) continue;
    const source = await readText(surface.component);
    assert.ok(!source.includes('@/assets/r2/'), `${surface.surface} is unchanged but imports an R2 asset`);
  }
});

test('the picker is a dependency-free script of at most 2 KiB minified', async () => {
  const source = await readFile(PICKER_PATH, 'utf8');
  assert.doesNotMatch(source, /^import\s+[^']*from\s+'(?!\.)/m, 'the picker imports no library');
  assert.doesNotMatch(source, /\bfetch\s*\(/, 'the picker must not call fetch');
  const { code } = transformSync(source, { loader: 'ts', minify: true, format: 'esm' });
  assert.ok(Buffer.byteLength(code, 'utf8') <= 2048, `minified picker is ${Buffer.byteLength(code, 'utf8')} bytes`);
});

test('built pages reference only local renditions for R2 images and the pool lists are allow-listed', async (t) => {
  if (!existsSync(DIST)) {
    t.skip('dist/ is not built; run npm run build, then this check');
    return;
  }
  const pages = (await listFiles(DIST)).filter((file) => file.endsWith('.html'));
  assert.ok(pages.length > 0, 'dist has HTML pages');

  const poolLists = [];
  const offenders = [];
  const pooledPictures = [];
  const pageHtml = new Map();
  for (const page of pages) {
    const html = await readFile(page, 'utf8');
    pageHtml.set(page, html);
    const decoded = html.replace(/data-r2-pool="([^"]*)"/g, (_, value) => {
      poolLists.push(value.replace(/&quot;/g, '"'));
      return 'data-r2-pool=""';
    });
    if (decoded.includes(R2_ORIGIN)) offenders.push(path.relative(ROOT, page));
    for (const match of html.matchAll(/<picture[^>]*data-r2-pool="[^"]*"[^>]*>([\s\S]*?)<\/picture>/g)) {
      pooledPictures.push({ page, inner: match[1] });
    }
  }
  assert.deepEqual(offenders, [], 'static HTML must not reference the R2 origin outside pool lists');

  for (const list of poolLists) {
    const keys = JSON.parse(list);
    for (const key of keys) assert.match(key, POOL_KEY_PATTERN, `pool key ${key} is not an allow-listed object key`);
  }

  for (const { page, inner } of pooledPictures) {
    const sources = [...inner.matchAll(/(?:src|srcset)="([^"]+)"/g)].map((match) => match[1]);
    for (const url of sources) {
      for (const candidate of url.split(',').map((part) => part.trim().split(' ')[0])) {
        assert.ok(candidate.startsWith('/_astro/'), `${path.relative(ROOT, page)} pooled slot uses ${candidate}, not a local _astro asset`);
      }
    }
  }

  for (const entry of entries) {
    const name = path.basename(entry.file, '.avif');
    const referenced = [...pageHtml.values()].some((html) => html.includes(`/_astro/${name}.`));
    assert.ok(referenced, `no built page references the vendored default for ${entry.id}`);
  }
});
