import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REQUIRED_BLOG_LOCALES = [
  { code: 'zh-CN', routeLocale: 'root', contentPrefix: '', blogDir: 'blog' },
  { code: 'zh-Hant', routeLocale: 'zh-Hant', contentPrefix: 'zh-Hant', blogDir: 'zh-Hant/blog' },
  { code: 'en-US', routeLocale: 'en-US', contentPrefix: 'en-US', blogDir: 'en-US/blog' },
  { code: 'ja-JP', routeLocale: 'ja-JP', contentPrefix: 'ja-JP', blogDir: 'ja-JP/blog' },
  { code: 'ko-KR', routeLocale: 'ko-KR', contentPrefix: 'ko-KR', blogDir: 'ko-KR/blog' },
  { code: 'de-DE', routeLocale: 'de-DE', contentPrefix: 'de-DE', blogDir: 'de-DE/blog' },
  { code: 'fr-FR', routeLocale: 'fr-FR', contentPrefix: 'fr-FR', blogDir: 'fr-FR/blog' },
  { code: 'es-ES', routeLocale: 'es-ES', contentPrefix: 'es-ES', blogDir: 'es-ES/blog' },
  { code: 'pt-BR', routeLocale: 'pt-BR', contentPrefix: 'pt-BR', blogDir: 'pt-BR/blog' },
  { code: 'ru-RU', routeLocale: 'ru-RU', contentPrefix: 'ru-RU', blogDir: 'ru-RU/blog' },
];

export const SUPPORTED_LANGUAGE_VALUES = [
  ...REQUIRED_BLOG_LOCALES.map((locale) => locale.code),
  'zh',
  'zh-Hans',
  'zh-TW',
  'zh-HK',
  'zh-MO',
  'en',
  'ja',
  'ko',
  'de',
  'fr',
  'es',
  'pt',
  'ru',
];

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentRoot = path.join(docsRoot, 'src/content/docs');
const postFilePattern = /\.(?:md|mdx)$/u;
const supportFileNames = new Set(['authors.yml', 'authors.yaml', 'index.yml', 'index.yaml']);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function relativePath(filePath, base = docsRoot) {
  return toPosixPath(path.relative(base, filePath));
}

function canonicalizeLocale(locale) {
  const candidate = String(locale ?? '').trim().replace(/_/g, '-');
  if (!candidate) {
    return '';
  }

  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? candidate;
  } catch {
    return candidate;
  }
}

export function normalizeBlogLanguageCode(language) {
  const normalized = canonicalizeLocale(language).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'root' || normalized === 'zh' || normalized.includes('-hans') || ['zh-cn', 'zh-sg'].includes(normalized)) {
    return 'zh-CN';
  }

  if (normalized === 'zh-hant' || normalized.includes('-hant') || ['zh-tw', 'zh-hk', 'zh-mo'].includes(normalized)) {
    return 'zh-Hant';
  }

  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en-US';
  }

  for (const locale of REQUIRED_BLOG_LOCALES) {
    if (locale.code.toLowerCase() === normalized) {
      return locale.code;
    }
  }

  const [languagePart] = normalized.split('-');
  switch (languagePart) {
    case 'ja':
      return 'ja-JP';
    case 'ko':
      return 'ko-KR';
    case 'de':
      return 'de-DE';
    case 'fr':
      return 'fr-FR';
    case 'es':
      return 'es-ES';
    case 'pt':
      return 'pt-BR';
    case 'ru':
      return 'ru-RU';
    default:
      return null;
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readDirectoryFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function isPostFile(fileName) {
  return postFilePattern.test(fileName);
}

function isSupportFile(fileName) {
  return supportFileNames.has(fileName) || !isPostFile(fileName);
}

function extractFrontmatter(raw) {
  if (!raw.startsWith('---')) {
    return {};
  }

  const closeIndex = raw.indexOf('\n---', 3);
  if (closeIndex === -1) {
    return {};
  }

  const frontmatter = raw.slice(3, closeIndex).trim();
  const values = {};
  for (const line of frontmatter.split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    values[key] = rawValue.trim().replace(/^['"]|['"]$/gu, '');
  }

  return values;
}

async function scanLocale(locale, rootDirectory) {
  const directory = path.join(rootDirectory, locale.blogDir);
  const diagnostics = [];

  if (!(await pathExists(directory))) {
    diagnostics.push({
      code: 'missing-language-directory',
      locale: locale.code,
      routeLocale: locale.routeLocale,
      path: relativePath(directory, rootDirectory),
      message: `Missing localized blog directory for ${locale.code}: ${relativePath(directory, rootDirectory)}`,
    });
    return { locale, directory, posts: new Map(), diagnostics };
  }

  const posts = new Map();
  const files = await readDirectoryFiles(directory);

  for (const fileName of files) {
    if (isSupportFile(fileName)) {
      continue;
    }

    const slug = fileName.replace(postFilePattern, '');
    const filePath = path.join(directory, fileName);
    const raw = await fs.readFile(filePath, 'utf8');
    const frontmatter = extractFrontmatter(raw);
    const declaredLanguage = frontmatter.language;
    const normalizedLanguage = declaredLanguage
      ? normalizeBlogLanguageCode(declaredLanguage)
      : locale.code;

    if (declaredLanguage && !normalizedLanguage) {
      diagnostics.push({
        code: 'unsupported-language',
        locale: locale.code,
        slug,
        path: relativePath(filePath, rootDirectory),
        declaredLanguage,
        supportedValues: SUPPORTED_LANGUAGE_VALUES,
        message: `Unsupported language "${declaredLanguage}" in ${relativePath(filePath, rootDirectory)}. Supported values: ${SUPPORTED_LANGUAGE_VALUES.join(', ')}`,
      });
    }

    if (normalizedLanguage && normalizedLanguage !== locale.code) {
      diagnostics.push({
        code: 'route-language-conflict',
        locale: locale.code,
        slug,
        path: relativePath(filePath, rootDirectory),
        routeLanguage: locale.code,
        declaredLanguage,
        normalizedLanguage,
        message: `Language metadata conflict in ${relativePath(filePath, rootDirectory)}: route resolves to ${locale.code}, declared value resolves to ${normalizedLanguage}`,
      });
    }

    posts.set(slug, {
      slug,
      fileName,
      filePath,
      declaredLanguage,
      normalizedLanguage,
    });
  }

  return { locale, directory, posts, diagnostics };
}

export async function validateBlogI18nCompleteness(options = {}) {
  const rootDirectory = path.resolve(options.contentRoot ?? contentRoot);
  const localeResults = await Promise.all(REQUIRED_BLOG_LOCALES.map((locale) => scanLocale(locale, rootDirectory)));
  const diagnostics = localeResults.flatMap((result) => result.diagnostics);
  const allSlugs = new Set();

  for (const result of localeResults) {
    for (const slug of result.posts.keys()) {
      allSlugs.add(slug);
    }
  }

  for (const slug of [...allSlugs].sort((left, right) => left.localeCompare(right))) {
    for (const result of localeResults) {
      if (result.posts.has(slug)) {
        continue;
      }

      const expectedPath = path.join(rootDirectory, result.locale.blogDir, `${slug}.mdx`);
      diagnostics.push({
        code: 'missing-translation',
        locale: result.locale.code,
        routeLocale: result.locale.routeLocale,
        slug,
        expectedPath: relativePath(expectedPath, rootDirectory),
        message: `Missing ${result.locale.code} translation for slug "${slug}": expected ${relativePath(expectedPath, rootDirectory)}`,
      });
    }
  }

  return {
    ok: diagnostics.length === 0,
    locales: localeResults.map((result) => ({
      code: result.locale.code,
      routeLocale: result.locale.routeLocale,
      directory: relativePath(result.directory, rootDirectory),
      postCount: result.posts.size,
    })),
    slugCount: allSlugs.size,
    diagnostics,
  };
}

function printResult(result) {
  if (result.ok) {
    console.log(
      `Blog i18n completeness verified: ${result.slugCount} slugs across ${result.locales.length} desktop languages.`,
    );
    return;
  }

  console.error(`Blog i18n completeness failed with ${result.diagnostics.length} diagnostics:`);
  for (const diagnostic of result.diagnostics) {
    console.error(`- [${diagnostic.code}] ${diagnostic.message}`);
  }
}

export async function main() {
  const result = await validateBlogI18nCompleteness();
  printResult(result);

  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
