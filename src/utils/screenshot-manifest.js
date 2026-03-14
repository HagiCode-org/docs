import path from 'node:path';
import manifestData from '../content/docs/img/screenshots/manifest.json' with { type: 'json' };

export function createScreenshotManifestHelpers(manifest = manifestData) {
  const items = Array.isArray(manifest?.items) ? manifest.items : [];
  const entryMap = new Map(items.map((entry) => [entryKey(entry.category, entry.slug), entry]));

  function list() {
    return items.slice();
  }

  function getByKey(category, slug) {
    return entryMap.get(entryKey(category, slug));
  }

  function resolveMarkdownImagePath(entry, fromDocument = '') {
    const sourceDirectory = normalizeSourceDirectory(fromDocument);
    const relativePath = path.posix.relative(sourceDirectory, entry.relativeImagePath);
    return ensureRelativePrefix(relativePath);
  }

  function resolveReference({ category = '', slug, fromDocument = '' }) {
    const entry = getByKey(category, slug);
    if (!entry) {
      return undefined;
    }

    return {
      ...entry,
      markdownImagePath: resolveMarkdownImagePath(entry, fromDocument)
    };
  }

  return {
    manifest,
    list,
    getByKey,
    resolveMarkdownImagePath,
    resolveReference
  };
}

export const screenshotManifest = createScreenshotManifestHelpers(manifestData);

export function listManagedScreenshots() {
  return screenshotManifest.list();
}

export function getManagedScreenshot(category, slug) {
  return screenshotManifest.getByKey(category, slug);
}

export function getManagedScreenshotReference(input) {
  return screenshotManifest.resolveReference(input);
}

function normalizeSourceDirectory(fromDocument) {
  const normalized = String(fromDocument ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    return '.';
  }
  return normalized.endsWith('.md') || normalized.endsWith('.mdx')
    ? path.posix.dirname(normalized)
    : normalized;
}

function ensureRelativePrefix(value) {
  if (!value || value === '') {
    return './';
  }
  if (value.startsWith('.')) {
    return value;
  }
  return `./${value}`;
}

function entryKey(category, slug) {
  const normalizedCategory = String(category ?? '').replace(/^\/+|\/+$/g, '');
  return `${normalizedCategory}::${slug}`;
}
