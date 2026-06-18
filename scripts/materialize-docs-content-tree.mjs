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
import { getStructuredArticleViewModel } from '../src/lib/articles.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(scriptDirectory, '..');
const YAML_FRONTMATTER_KEYS_PATTERN = /^(title|date|description|tags|sidebar):/mu;
const STRUCTURED_ARTICLE_FAQ_DIRECTORY = 'faq';
const STRUCTURED_ARTICLE_SIDEBAR_ORDER_BY_SLUG = new Map([
  ['claude-vs-hagicode', 28],
  ['copilot-vs-hagicode', 29],
  ['codex-vs-hagicode', 30],
  ['gemini-vs-hagicode', 31],
  ['opencode-vs-hagicode', 32],
  ['hermes-vs-hagicode', 33],
  ['deepagents-vs-hagicode', 34],
  ['kimi-vs-hagicode', 35],
  ['codebuddy-vs-hagicode', 36],
  ['qoder-vs-hagicode', 37],
  ['kiro-vs-hagicode', 38],
  ['pi-vs-hagicode', 39],
  ['reasonix-vs-hagicode', 40],
]);

function yamlQuote(value) {
  return JSON.stringify(String(value ?? ''));
}

function buildStructuredArticleShellSource({ slug, locale, title, description, order }) {
  const componentLocale = locale === 'root' ? 'zh-CN' : locale;

  return `---\n`
    + `title: ${yamlQuote(title)}\n`
    + `description: ${yamlQuote(description)}\n`
    + 'sidebar:\n'
    + `  order: ${order}\n`
    + '---\n\n'
    + "import StructuredArticlePage from '@/components/StructuredArticlePage.astro';\n\n"
    + `<StructuredArticlePage slug=${yamlQuote(slug)} locale=${yamlQuote(componentLocale)} />\n`;
}

function shouldQuoteFrontmatterValue(value) {
  const trimmedValue = value.trim();
  if (!trimmedValue.includes(': ')) {
    return false;
  }

  if (/^['"]/u.test(trimmedValue)) {
    return false;
  }

  if (/^[\[{>|&*!]/u.test(trimmedValue)) {
    return false;
  }

  return true;
}

function extractMetadataFrontmatter(source) {
  const lines = source.split('\n');

  for (let startIndex = 0; startIndex < lines.length; startIndex += 1) {
    if (lines[startIndex] !== '---') {
      continue;
    }

    for (let endIndex = startIndex + 1; endIndex < lines.length; endIndex += 1) {
      if (lines[endIndex] !== '---') {
        continue;
      }

      const frontmatter = lines.slice(startIndex + 1, endIndex).join('\n');
      if (/(^|\n)---(\n|$)/u.test(frontmatter)) {
        continue;
      }

      if (!YAML_FRONTMATTER_KEYS_PATTERN.test(frontmatter)) {
        continue;
      }

      return {
        frontmatter,
        body: lines.slice(endIndex + 1).join('\n'),
      };
    }
  }

  return null;
}

function sanitizeYamlFrontmatter(source) {
  const extractedFrontmatter = extractMetadataFrontmatter(source);
  if (!extractedFrontmatter) {
    return source;
  }

  let changed = false;
  const sanitizedFrontmatter = extractedFrontmatter.frontmatter
    .split('\n')
    .map((line) => {
      if (/^\s/u.test(line)) {
        return line;
      }

      const frontmatterMatch = /^([A-Za-z0-9_-]+):( +)(.+)$/u.exec(line);
      if (!frontmatterMatch) {
        return line;
      }

      const [, key, spacing, value] = frontmatterMatch;
      if (!shouldQuoteFrontmatterValue(value)) {
        return line;
      }

      changed = true;
      return `${key}:${spacing}${JSON.stringify(value.trim())}`;
    })
    .join('\n');

  const normalizedSource = `---\n${sanitizedFrontmatter}\n---\n${extractedFrontmatter.body}`;
  if (changed || normalizedSource !== source) {
    return normalizedSource;
  }

  return source;
}

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

async function readJsonIfPresent(filePath) {
  if (!await pathExists(filePath)) {
    return null;
  }

  return JSON.parse(await readFile(filePath, 'utf8'));
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

async function materializeStructuredArticleShells({ docsRepoRoot }) {
  const snapshotRoot = path.join(docsRepoRoot, 'src', 'data', 'articles.snapshot');
  const rootManifest = await readJsonIfPresent(path.join(snapshotRoot, 'index.json'));
  if (!rootManifest || !Array.isArray(rootManifest.localeIndexes) || rootManifest.localeIndexes.length === 0) {
    return { articles: 0, shells: 0 };
  }

  const articleSlugs = [];
  const seenSlugs = new Set();

  for (const localeEntry of rootManifest.localeIndexes) {
    const localeManifest = await readJsonIfPresent(path.join(snapshotRoot, localeEntry.locale, 'index.json'));
    if (!localeManifest || !Array.isArray(localeManifest.articles)) {
      continue;
    }

    for (const article of localeManifest.articles) {
      if (typeof article?.slug !== 'string' || seenSlugs.has(article.slug)) {
        continue;
      }

      seenSlugs.add(article.slug);
      articleSlugs.push(article.slug);
    }
  }

  articleSlugs.sort((left, right) => {
    const leftOrder = STRUCTURED_ARTICLE_SIDEBAR_ORDER_BY_SLUG.get(left);
    const rightOrder = STRUCTURED_ARTICLE_SIDEBAR_ORDER_BY_SLUG.get(right);

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }

    if (leftOrder !== undefined) {
      return -1;
    }

    if (rightOrder !== undefined) {
      return 1;
    }

    return left.localeCompare(right);
  });

  const routeLocales = ['root', ...DOCS_ROUTE_LOCALE_OPTIONS.map((locale) => locale.code).filter((locale) => locale !== 'root')];
  let shellCount = 0;

  for (const routeLocale of routeLocales) {
    const articleLocale = routeLocale === 'root' ? 'zh-CN' : routeLocale;

    for (const [index, slug] of articleSlugs.entries()) {
      const article = getStructuredArticleViewModel(slug, articleLocale, { snapshotRoot });
      const outputPath = path.join(
        docsRepoRoot,
        buildGeneratedContentPath(routeLocale, path.posix.join(STRUCTURED_ARTICLE_FAQ_DIRECTORY, `${slug}.mdx`)),
      );

      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(
        outputPath,
        buildStructuredArticleShellSource({
          slug,
          locale: routeLocale,
          title: article.title,
          description: article.description,
          order: STRUCTURED_ARTICLE_SIDEBAR_ORDER_BY_SLUG.get(slug) ?? 100 + index,
        }),
        'utf8',
      );
      shellCount += 1;
    }
  }

  return {
    articles: articleSlugs.length,
    shells: shellCount,
  };
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

    await writeFile(outputPath, sanitizeYamlFrontmatter(rewriteContent(content)), 'utf8');
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
      content = sanitizeYamlFrontmatter(rewriteContent(content));

      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content, 'utf8');
    }
  }

  const structuredArticleShellResult = await materializeStructuredArticleShells({
    docsRepoRoot,
  });

  return {
    generatedRoot: DOCS_GENERATED_CONTENT_ROOT,
    baselineDocs: baselineMarkdownFiles.length,
    locales: DOCS_ROUTE_LOCALE_OPTIONS.length,
    structuredArticleArticles: structuredArticleShellResult.articles,
    structuredArticleShells: structuredArticleShellResult.shells,
  };
}

async function main() {
  const result = await materializeDocsContentTree();
  console.log(
    `Materialized docs content tree at ${result.generatedRoot} from ${result.baselineDocs} baseline docs across ${result.locales} locales with ${result.structuredArticleShells} structured article shells.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
