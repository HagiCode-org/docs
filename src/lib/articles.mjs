import fs from 'node:fs';
import path from 'node:path';

export const STRUCTURED_ARTICLE_CORE_MIN_VERSION = '0.9.7';
const CORE_SOURCE_ENTRY = '@hagicode/hagilight-core/comparison-articles-source';
const CORE_VALIDATOR_ENTRY = '@hagicode/hagilight-core/comparison-articles';

export const DOCS_ARTICLE_LOCALES = [
  'zh-CN',
  'zh-Hant',
  'en-US',
  'ja-JP',
  'ko-KR',
  'de-DE',
  'fr-FR',
  'es-ES',
  'pt-BR',
  'ru-RU',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Loads the comparison article data root and validator from the installed core package.
// Older core versions do not export these entry points; the failure names the entry point and the minimum version.
export async function loadStructuredArticleCore({
  importSourceEntry = () => import('@hagicode/hagilight-core/comparison-articles-source'),
  importValidatorEntry = () => import('@hagicode/hagilight-core/comparison-articles'),
} = {}) {
  try {
    const [source, validators] = await Promise.all([importSourceEntry(), importValidatorEntry()]);
    assert(typeof source.STRUCTURED_ARTICLE_SOURCE_ROOT === 'string', `${CORE_SOURCE_ENTRY} does not export STRUCTURED_ARTICLE_SOURCE_ROOT.`);
    assert(typeof validators.validateStructuredArticleDetail === 'function', `${CORE_VALIDATOR_ENTRY} does not export validateStructuredArticleDetail.`);
    return {
      defaultArticleRoot: source.STRUCTURED_ARTICLE_SOURCE_ROOT,
      validateStructuredArticleDetail: validators.validateStructuredArticleDetail,
    };
  } catch (error) {
    throw new Error(
      `Structured articles require ${CORE_SOURCE_ENTRY} from @hagicode/hagilight-core ${STRUCTURED_ARTICLE_CORE_MIN_VERSION} or newer. Update @hagicode/hagilight-core and reinstall. (${error.message})`,
      { cause: error },
    );
  }
}

const structuredArticleCore = await loadStructuredArticleCore();
const DEFAULT_ARTICLE_ROOT = structuredArticleCore.defaultArticleRoot;
const validateStructuredArticleDetail = structuredArticleCore.validateStructuredArticleDetail;

function readJsonFile(filePath, fallback = null) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function canonicalizeLocale(locale) {
  const candidate = String(locale ?? '').trim().replace(/_/gu, '-');
  if (!candidate) {
    return '';
  }

  if (candidate === 'root') {
    return 'zh-CN';
  }

  if (candidate === 'en') {
    return 'en-US';
  }

  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? candidate;
  } catch {
    return candidate;
  }
}

export function resolveArticleLocale(locale) {
  const canonicalLocale = canonicalizeLocale(locale);
  if (DOCS_ARTICLE_LOCALES.includes(canonicalLocale)) {
    return canonicalLocale;
  }

  switch (canonicalLocale.toLowerCase().split('-')[0]) {
    case 'zh':
      return canonicalLocale.includes('hant') ? 'zh-Hant' : 'zh-CN';
    case 'en':
      return 'en-US';
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
      return 'en-US';
  }
}

export function buildArticleLocaleFallbacks(locale) {
  const resolvedLocale = resolveArticleLocale(locale);
  const fallbacks = new Set([resolvedLocale]);

  if (resolvedLocale === 'zh-Hant') {
    fallbacks.add('zh-CN');
  }

  fallbacks.add('en-US');
  fallbacks.add('zh-CN');

  return [...fallbacks];
}

export function localizeDocsHref(href, locale) {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
    return href;
  }

  const resolvedLocale = resolveArticleLocale(locale);
  if (resolvedLocale === 'zh-CN') {
    return href;
  }

  if (href.startsWith(`/${resolvedLocale}/`)) {
    return href;
  }

  return `/${resolvedLocale}${href}`;
}

// Returns the sorted union of article slugs (`*.json` base names) across the locale directories under articleRoot.
export function listStructuredArticleSlugs({ articleRoot = DEFAULT_ARTICLE_ROOT } = {}) {
  const root = path.resolve(articleRoot);
  assert(fs.existsSync(root), `${root}: structured article root does not exist.`);

  const localeDirectories = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert(localeDirectories.length > 0, `${root}: structured article root must contain at least one locale directory.`);

  const slugs = new Set();
  for (const localeDirectory of localeDirectories) {
    for (const entry of fs.readdirSync(path.join(root, localeDirectory.name), { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        slugs.add(entry.name.slice(0, -'.json'.length));
      }
    }
  }

  return [...slugs].sort((left, right) => left.localeCompare(right));
}

export function resolveStructuredArticle(slug, locale = 'zh-CN', { articleRoot = DEFAULT_ARTICLE_ROOT } = {}) {
  const resolvedLocale = resolveArticleLocale(locale);
  const articleBase = path.resolve(articleRoot);
  const fallbackLocales = buildArticleLocaleFallbacks(resolvedLocale);

  for (const candidateLocale of fallbackLocales) {
    const candidatePath = path.join(articleBase, candidateLocale, `${slug}.json`);
    const payload = readJsonFile(candidatePath);
    if (!payload) {
      continue;
    }

    const detail = validateStructuredArticleDetail(payload, candidatePath);
    assert(detail.slug === slug, `${candidatePath}: slug must match the requested article slug`);
    assert(detail.locale === candidateLocale, `${candidatePath}: locale must match the article folder name`);

    return {
      requestedLocale: resolvedLocale,
      resolvedLocale: candidateLocale,
      fallbackLocales,
      detail,
      sourcePath: candidatePath,
      usedFallback: candidateLocale !== resolvedLocale,
    };
  }

  throw new Error(`Structured article ${slug} could not be resolved from article locales ${fallbackLocales.join(', ')} under ${articleBase}.`);
}

export function getStructuredArticleViewModel(slug, locale = 'zh-CN', options = {}) {
  const { requestedLocale, resolvedLocale, detail, sourcePath, usedFallback } = resolveStructuredArticle(slug, locale, options);

  return {
    slug: detail.slug,
    title: detail.seo.title,
    description: detail.seo.description,
    summary: detail.summary,
    updatedAt: detail.updatedAt,
    requestedLocale,
    resolvedLocale,
    usedFallback,
    sourcePath,
    sections: detail.sections,
    toc: detail.sections.map((section) => ({ id: section.id, title: section.title })),
    cta: detail.cta ?? {},
  };
}
