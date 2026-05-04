import path from 'node:path';

import {
  DOCS_LOCALE_RESOURCES,
  DOCS_LOCALE_SELECTOR_OPTIONS,
} from '../i18n/generated/docs-locale-resources.mjs';

export const DOCS_BASELINE_SOURCE_LOCALE = 'zh-CN';
export const DOCS_BASELINE_AUTHORING_ROOT = 'src/content/docs';
export const DOCS_TRANSLATIONS_AUTHORING_ROOT = 'src/content/translations/docs';
export const DOCS_GENERATED_CONTENT_ROOT = 'src/content/.generated/docs';
export const DOCS_MARKDOWN_EXTENSIONS = ['.md', '.mdx'];
export const DOCS_LEGACY_ENGLISH_DIRECTORY = 'en';

export const DOCS_ROUTE_LOCALE_OPTIONS = DOCS_LOCALE_SELECTOR_OPTIONS.map((locale) => ({
  ...locale,
}));

export const DOCS_ROUTE_TO_SOURCE_LOCALE = Object.fromEntries(
  DOCS_ROUTE_LOCALE_OPTIONS.map((locale) => [locale.code, locale.sourceLocale]),
);

export const DOCS_SOURCE_TO_ROUTE_LOCALE = Object.fromEntries(
  Object.entries(DOCS_LOCALE_RESOURCES['en-US'].metadata.aliases).map(([localeLike, routeLocale]) => [
    normalizeLocaleKey(localeLike),
    routeLocale,
  ]),
);

export const DOCS_LOCALE_DIRECTORIES = new Set([
  ...DOCS_ROUTE_LOCALE_OPTIONS.map((locale) => locale.code).filter((locale) => locale !== 'root'),
  DOCS_LEGACY_ENGLISH_DIRECTORY,
]);

export function normalizeLocaleKey(locale) {
  return String(locale ?? '').trim().replace(/_/gu, '-').toLowerCase();
}

export function toPosixPath(filePath) {
  return filePath.split(path.sep).join(path.posix.sep);
}

export function fromPosixPath(filePath) {
  return filePath.split(path.posix.sep).join(path.sep);
}

export function isMarkdownFile(filePath) {
  return DOCS_MARKDOWN_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

export function stripMarkdownExtension(filePath) {
  return toPosixPath(filePath).replace(/\.[^./]+$/u, '');
}

export function normalizeDocKeyFromRelativePath(relativeFilePath) {
  return stripMarkdownExtension(relativeFilePath).replace(/\/index$/u, '');
}

export function normalizeDocRoutePathFromRelativePath(relativeFilePath) {
  const docKey = normalizeDocKeyFromRelativePath(relativeFilePath);
  return docKey.length > 0 ? `/${docKey}/` : '/';
}

export function isDocsLocaleDirectory(directoryName) {
  return DOCS_LOCALE_DIRECTORIES.has(directoryName);
}

export function getGeneratedLocaleDirectory(routeLocale) {
  return routeLocale === 'root' ? '' : routeLocale;
}

export function getSourceLocaleByRouteLocale(routeLocale) {
  return DOCS_ROUTE_TO_SOURCE_LOCALE[routeLocale] ?? null;
}

export function getTranslationDirectoryByRouteLocale(routeLocale) {
  const sourceLocale = getSourceLocaleByRouteLocale(routeLocale);
  if (!sourceLocale || sourceLocale === DOCS_BASELINE_SOURCE_LOCALE) {
    return null;
  }

  return sourceLocale;
}

export function getLegacyLocalizedDirectories(routeLocale) {
  if (routeLocale === 'root') {
    return [];
  }

  const sourceLocale = getSourceLocaleByRouteLocale(routeLocale);
  const directories = new Set([routeLocale]);
  if (sourceLocale && sourceLocale !== DOCS_BASELINE_SOURCE_LOCALE) {
    directories.add(sourceLocale);
  }
  if (routeLocale === 'en-US') {
    directories.add(DOCS_LEGACY_ENGLISH_DIRECTORY);
  }

  return [...directories];
}

export function buildBaselineAuthoringPath(relativeFilePath) {
  return path.join(DOCS_BASELINE_AUTHORING_ROOT, fromPosixPath(relativeFilePath));
}

export function buildTranslationAuthoringPath(sourceLocale, relativeFilePath) {
  return path.join(
    DOCS_TRANSLATIONS_AUTHORING_ROOT,
    sourceLocale,
    fromPosixPath(relativeFilePath),
  );
}

export function buildGeneratedContentPath(routeLocale, relativeFilePath) {
  const localeDirectory = getGeneratedLocaleDirectory(routeLocale);
  if (!localeDirectory) {
    return path.join(DOCS_GENERATED_CONTENT_ROOT, fromPosixPath(relativeFilePath));
  }

  return path.join(
    DOCS_GENERATED_CONTENT_ROOT,
    localeDirectory,
    fromPosixPath(relativeFilePath),
  );
}
