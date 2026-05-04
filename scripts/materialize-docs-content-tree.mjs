import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DOCS_BASELINE_AUTHORING_ROOT,
  DOCS_GENERATED_CONTENT_ROOT,
  DOCS_MARKDOWN_EXTENSIONS,
  DOCS_ROUTE_LOCALE_OPTIONS,
  DOCS_SOURCE_TO_ROUTE_LOCALE,
  DOCS_TRANSLATIONS_AUTHORING_ROOT,
  buildGeneratedContentPath,
  getLegacyLocalizedDirectories,
  getTranslationDirectoryByRouteLocale,
  isDocsLocaleDirectory,
  isMarkdownFile,
  normalizeLocaleKey,
  normalizeDocRoutePathFromRelativePath,
  toPosixPath,
} from '../src/lib/docs-content-paths.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(scriptDirectory, '..');

function splitTargetSuffix(target) {
  const hashIndex = target.indexOf('#');
  const searchIndex = target.indexOf('?');
  const cutIndex = [hashIndex, searchIndex]
    .filter((value) => value >= 0)
    .reduce((smallest, value) => Math.min(smallest, value), Number.POSITIVE_INFINITY);

  if (!Number.isFinite(cutIndex)) {
    return { target, suffix: '' };
  }

  return {
    target: target.slice(0, cutIndex),
    suffix: target.slice(cutIndex),
  };
}

function ensureRelativePath(filePath) {
  if (filePath.startsWith('.') || filePath.startsWith('/')) {
    return filePath;
  }

  return `./${filePath}`;
}

function isRelativeSpecifier(value) {
  return value.startsWith('./') || value.startsWith('../');
}

function buildLocalizedRoutePath(routeLocale, routePath) {
  if (routeLocale === 'root') {
    return routePath;
  }

  return routePath === '/' ? `/${routeLocale}/` : `/${routeLocale}${routePath}`;
}

function createBaselineDocResolver(relativeMarkdownFiles) {
  const byRelativeTarget = new Map();

  for (const relativeFilePath of relativeMarkdownFiles) {
    const posixPath = toPosixPath(relativeFilePath);
    const routePath = normalizeDocRoutePathFromRelativePath(posixPath);
    const withoutExtension = posixPath.replace(/\.[^./]+$/u, '');

    byRelativeTarget.set(posixPath, routePath);
    byRelativeTarget.set(withoutExtension, routePath);

    if (withoutExtension.endsWith('/index')) {
      byRelativeTarget.set(withoutExtension.slice(0, -'/index'.length), routePath);
      byRelativeTarget.set(`${withoutExtension.slice(0, -'/index'.length)}/`, routePath);
    }
  }

  return (targetPath) => {
    const normalizedTarget = toPosixPath(path.posix.normalize(targetPath)).replace(/^\/+/u, '');
    const directHit = byRelativeTarget.get(normalizedTarget);
    if (directHit) {
      return directHit;
    }

    for (const extension of DOCS_MARKDOWN_EXTENSIONS) {
      const byFile = byRelativeTarget.get(`${normalizedTarget}${extension}`);
      if (byFile) {
        return byFile;
      }
    }

    for (const extension of DOCS_MARKDOWN_EXTENSIONS) {
      const byIndex = byRelativeTarget.get(`${normalizedTarget}/index${extension}`);
      if (byIndex) {
        return byIndex;
      }
    }

    return null;
  };
}

async function pathExists(targetPath) {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyBaselineTree(currentSource, currentTarget, isTopLevel = false) {
  const entries = await readdir(currentSource, { withFileTypes: true });

  for (const entry of entries) {
    if (isTopLevel && entry.isDirectory() && isDocsLocaleDirectory(entry.name)) {
      continue;
    }

    const sourcePath = path.join(currentSource, entry.name);
    const targetPath = path.join(currentTarget, entry.name);

    if (entry.isDirectory()) {
      await mkdir(targetPath, { recursive: true });
      await copyBaselineTree(sourcePath, targetPath, false);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }
}

async function collectBaselineMarkdownFiles(currentDirectory, relativeDirectory = '', isTopLevel = true) {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const markdownFiles = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (isTopLevel && entry.isDirectory() && isDocsLocaleDirectory(entry.name)) {
      continue;
    }

    const sourcePath = path.join(currentDirectory, entry.name);
    const nextRelativePath = relativeDirectory
      ? path.posix.join(relativeDirectory, entry.name)
      : entry.name;

    if (entry.isDirectory()) {
      markdownFiles.push(
        ...await collectBaselineMarkdownFiles(sourcePath, nextRelativePath, false),
      );
      continue;
    }

    if (entry.isFile() && isMarkdownFile(entry.name)) {
      markdownFiles.push(nextRelativePath);
    }
  }

  return markdownFiles;
}

async function findLocalizedSource(routeLocale, relativeFilePath, { baselineRoot, translationsRoot }) {
  const translationDirectory = getTranslationDirectoryByRouteLocale(routeLocale);
  if (translationDirectory) {
    const translationPath = path.join(translationsRoot, translationDirectory, relativeFilePath);
    if (await pathExists(translationPath)) {
      return translationPath;
    }
  }

  for (const legacyDirectory of getLegacyLocalizedDirectories(routeLocale)) {
    const legacyPath = path.join(baselineRoot, legacyDirectory, relativeFilePath);
    if (await pathExists(legacyPath)) {
      return legacyPath;
    }
  }

  return null;
}

function createDocsContentRewriter({
  authoringPath,
  outputPath,
  routeLocale,
  resolveBaselineDocRoute,
  baselineRoot,
  translationsRoot,
  generatedRoot,
}) {
  const outputDirectory = path.dirname(outputPath);

  function toCanonicalDocRelativePath(resolvedTargetPath) {
    const normalizedTarget = path.resolve(resolvedTargetPath);
    const baselineRelative = path.relative(baselineRoot, normalizedTarget);
    if (!baselineRelative.startsWith('..') && baselineRelative !== '.') {
      const baselinePosix = toPosixPath(baselineRelative);
      const [firstSegment, ...remainingSegments] = baselinePosix.split('/');
      return isDocsLocaleDirectory(firstSegment) ? remainingSegments.join('/') : baselinePosix;
    }

    const translationRelative = path.relative(translationsRoot, normalizedTarget);
    if (!translationRelative.startsWith('..') && translationRelative !== '.') {
      const translationPosix = toPosixPath(translationRelative);
      const [, ...remainingSegments] = translationPosix.split('/');
      return remainingSegments.join('/');
    }

    return null;
  }

  function mapResolvedTargetToGeneratedPath(resolvedTargetPath) {
    const normalizedTarget = path.resolve(resolvedTargetPath);
    const baselineRelative = path.relative(baselineRoot, normalizedTarget);
    if (!baselineRelative.startsWith('..') && baselineRelative !== '.') {
      return path.join(generatedRoot, baselineRelative);
    }

    const translationRelative = path.relative(translationsRoot, normalizedTarget);
    if (!translationRelative.startsWith('..') && translationRelative !== '.') {
      const [sourceLocale, ...remainingSegments] = translationRelative.split(path.sep);
      const mappedRouteLocale =
        DOCS_SOURCE_TO_ROUTE_LOCALE[normalizeLocaleKey(sourceLocale)] ?? sourceLocale;
      return path.join(
        generatedRoot,
        mappedRouteLocale === 'root' ? '' : mappedRouteLocale,
        ...remainingSegments,
      );
    }

    return normalizedTarget;
  }

  function rewriteImportTarget(target) {
    if (!isRelativeSpecifier(target)) {
      return target;
    }

    const { target: cleanTarget, suffix } = splitTargetSuffix(target);
    const resolvedTargetPath = path.resolve(path.dirname(authoringPath), cleanTarget);
    const generatedTargetPath = mapResolvedTargetToGeneratedPath(resolvedTargetPath);
    const relativeTarget = ensureRelativePath(
      toPosixPath(path.relative(outputDirectory, generatedTargetPath)),
    );
    return `${relativeTarget}${suffix}`;
  }

  function rewriteLinkedTarget(target) {
    if (!isRelativeSpecifier(target)) {
      return target;
    }

    const { target: cleanTarget, suffix } = splitTargetSuffix(target);
    const resolvedTargetPath = path.resolve(path.dirname(authoringPath), cleanTarget);
    const canonicalDocTarget = toCanonicalDocRelativePath(resolvedTargetPath);
    const docsRoutePath = canonicalDocTarget
      ? resolveBaselineDocRoute(canonicalDocTarget)
      : null;
    if (docsRoutePath) {
      return `${buildLocalizedRoutePath(routeLocale, docsRoutePath)}${suffix}`;
    }

    const generatedTargetPath = mapResolvedTargetToGeneratedPath(resolvedTargetPath);
    const relativeTarget = ensureRelativePath(
      toPosixPath(path.relative(outputDirectory, generatedTargetPath)),
    );
    return `${relativeTarget}${suffix}`;
  }

  return (source) =>
    source
      .replace(
        /^(\s*import\s+[^'"\n]+from\s+['"])([^'"]+)(['"]\s*;?\s*)$/gmu,
        (_match, prefix, target, suffix) => `${prefix}${rewriteImportTarget(target)}${suffix}`,
      )
      .replace(
        /^(\s*import\s+['"])([^'"]+)(['"]\s*;?\s*)$/gmu,
        (_match, prefix, target, suffix) => `${prefix}${rewriteImportTarget(target)}${suffix}`,
      )
      .replace(
        /^(\s*export\s+[^'"\n]+from\s+['"])([^'"]+)(['"]\s*;?\s*)$/gmu,
        (_match, prefix, target, suffix) => `${prefix}${rewriteImportTarget(target)}${suffix}`,
      )
      .replace(/(!?\[[^\]]*\]\()([^)]+)(\))/gu, (_match, prefix, target, suffix) => {
        return `${prefix}${rewriteLinkedTarget(target)}${suffix}`;
      })
      .replace(/\b(href|src)=["']([^"']+)["']/gu, (_match, attribute, target) => {
        return `${attribute}="${rewriteLinkedTarget(target)}"`;
      });
}

export async function materializeDocsContentTree(options = {}) {
  const docsRepoRoot = path.resolve(options.docsRoot ?? docsRoot);
  const baselineRoot = path.join(docsRepoRoot, DOCS_BASELINE_AUTHORING_ROOT);
  const translationsRoot = path.join(docsRepoRoot, DOCS_TRANSLATIONS_AUTHORING_ROOT);
  const generatedRoot = path.join(docsRepoRoot, DOCS_GENERATED_CONTENT_ROOT);

  await rm(generatedRoot, { recursive: true, force: true });
  await mkdir(generatedRoot, { recursive: true });
  await copyBaselineTree(baselineRoot, generatedRoot, true);

  const baselineMarkdownFiles = await collectBaselineMarkdownFiles(baselineRoot);
  const resolveBaselineDocRoute = createBaselineDocResolver(baselineMarkdownFiles);

  for (const relativeFilePath of baselineMarkdownFiles) {
    const sourcePath = path.join(baselineRoot, relativeFilePath);
    const outputPath = path.join(generatedRoot, relativeFilePath);
    const content = await readFile(sourcePath, 'utf8');
    const rewriteContent = createDocsContentRewriter({
      authoringPath: sourcePath,
      outputPath,
      routeLocale: 'root',
      resolveBaselineDocRoute,
      baselineRoot,
      translationsRoot,
      generatedRoot,
    });

    await writeFile(outputPath, rewriteContent(content), 'utf8');
  }

  for (const routeLocale of DOCS_ROUTE_LOCALE_OPTIONS.map((locale) => locale.code)) {
    if (routeLocale === 'root') {
      continue;
    }

    for (const relativeFilePath of baselineMarkdownFiles) {
      const baselineSourcePath = path.join(baselineRoot, relativeFilePath);
      const sourcePath =
        (await findLocalizedSource(routeLocale, relativeFilePath, { baselineRoot, translationsRoot }))
        ?? baselineSourcePath;
      const outputPath = path.join(
        docsRepoRoot,
        buildGeneratedContentPath(routeLocale, relativeFilePath),
      );

      let content = await readFile(sourcePath, 'utf8');
      const rewriteContent = createDocsContentRewriter({
        authoringPath:
          sourcePath === baselineSourcePath
            ? baselineSourcePath
            : path.join(baselineRoot, routeLocale, relativeFilePath),
        outputPath,
        routeLocale,
        resolveBaselineDocRoute,
        baselineRoot,
        translationsRoot,
        generatedRoot,
      });
      content = rewriteContent(content);

      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content, 'utf8');
    }
  }

  return {
    generatedRoot: DOCS_GENERATED_CONTENT_ROOT,
    baselineDocs: baselineMarkdownFiles.length,
    locales: DOCS_ROUTE_LOCALE_OPTIONS.length,
  };
}

async function main() {
  const result = await materializeDocsContentTree();
  console.log(
    `Materialized docs content tree at ${result.generatedRoot} from ${result.baselineDocs} baseline docs across ${result.locales} locales.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
