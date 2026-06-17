import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARTICLES_SNAPSHOT_ROOT = path.resolve(process.cwd(), 'src', 'data', 'articles.snapshot');
const SOURCE_ARTICLES_SNAPSHOT_ROOT = path.resolve(LIB_DIR, '..', 'data', 'articles.snapshot');

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

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveArticlesSnapshotRoot(snapshotRoot) {
  if (snapshotRoot) {
    return path.resolve(snapshotRoot);
  }

  if (fs.existsSync(ARTICLES_SNAPSHOT_ROOT)) {
    return ARTICLES_SNAPSHOT_ROOT;
  }

  return SOURCE_ARTICLES_SNAPSHOT_ROOT;
}

function readJsonFile(filePath, fallback = null) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertNonEmptyString(value, fieldName, sourceLabel) {
  assert(typeof value === 'string' && value.trim().length > 0, `${sourceLabel}: ${fieldName} must be a non-empty string`);
  return value.trim();
}

function assertStringArray(value, fieldName, sourceLabel) {
  assert(Array.isArray(value) && value.length > 0, `${sourceLabel}: ${fieldName} must be a non-empty array`);
  return value.map((entry, index) => assertNonEmptyString(entry, `${fieldName}[${index}]`, sourceLabel));
}

function normalizeCtaLink(value, fieldName, sourceLabel) {
  assert(isRecord(value), `${sourceLabel}: ${fieldName} must be an object`);
  return {
    label: assertNonEmptyString(value.label, `${fieldName}.label`, sourceLabel),
    href: assertNonEmptyString(value.href, `${fieldName}.href`, sourceLabel),
  };
}

function normalizeArticleBlock(block, fieldName, sourceLabel) {
  assert(isRecord(block), `${sourceLabel}: ${fieldName} must be an object`);
  const id = assertNonEmptyString(block.id, `${fieldName}.id`, sourceLabel);
  const type = assertNonEmptyString(block.type, `${fieldName}.type`, sourceLabel);

  switch (type) {
    case 'rich-text':
      return { id, type, content: assertStringArray(block.content, `${fieldName}.content`, sourceLabel) };
    case 'bullet-list':
      return { id, type, items: assertStringArray(block.items, `${fieldName}.items`, sourceLabel) };
    case 'capability-list':
      assert(Array.isArray(block.items) && block.items.length > 0, `${sourceLabel}: ${fieldName}.items must be a non-empty array`);
      return {
        id,
        type,
        items: block.items.map((item, index) => {
          const itemField = `${fieldName}.items[${index}]`;
          assert(isRecord(item), `${sourceLabel}: ${itemField} must be an object`);
          return {
            id: assertNonEmptyString(item.id, `${itemField}.id`, sourceLabel),
            title: assertNonEmptyString(item.title, `${itemField}.title`, sourceLabel),
            content: assertStringArray(item.content, `${itemField}.content`, sourceLabel),
            ...(item.bullets === undefined ? {} : { bullets: assertStringArray(item.bullets, `${itemField}.bullets`, sourceLabel) }),
          };
        }),
      };
    case 'comparison-grid':
      assert(Array.isArray(block.items) && block.items.length > 0, `${sourceLabel}: ${fieldName}.items must be a non-empty array`);
      return {
        id,
        type,
        items: block.items.map((item, index) => {
          const itemField = `${fieldName}.items[${index}]`;
          assert(isRecord(item), `${sourceLabel}: ${itemField} must be an object`);
          return {
            id: assertNonEmptyString(item.id, `${itemField}.id`, sourceLabel),
            label: assertNonEmptyString(item.label, `${itemField}.label`, sourceLabel),
            agent: assertNonEmptyString(item.agent, `${itemField}.agent`, sourceLabel),
            hagicode: assertNonEmptyString(item.hagicode, `${itemField}.hagicode`, sourceLabel),
            ...(item.combinedValue === undefined ? {} : { combinedValue: assertNonEmptyString(item.combinedValue, `${itemField}.combinedValue`, sourceLabel) }),
          };
        }),
      };
    case 'callout': {
      const tone = assertNonEmptyString(block.tone, `${fieldName}.tone`, sourceLabel);
      assert(['info', 'success', 'warning'].includes(tone), `${sourceLabel}: ${fieldName}.tone must be info, success, or warning`);
      return {
        id,
        type,
        tone,
        ...(block.title === undefined ? {} : { title: assertNonEmptyString(block.title, `${fieldName}.title`, sourceLabel) }),
        content: assertStringArray(block.content, `${fieldName}.content`, sourceLabel),
      };
    }
    case 'cta-group':
      assert(Array.isArray(block.items) && block.items.length > 0, `${sourceLabel}: ${fieldName}.items must be a non-empty array`);
      return {
        id,
        type,
        items: block.items.map((item, index) => {
          const itemField = `${fieldName}.items[${index}]`;
          const normalized = normalizeCtaLink(item, itemField, sourceLabel);
          const variant = item?.variant;
          if (variant === undefined) {
            return normalized;
          }
          const variantValue = assertNonEmptyString(variant, `${itemField}.variant`, sourceLabel);
          assert(['primary', 'secondary'].includes(variantValue), `${sourceLabel}: ${itemField}.variant must be primary or secondary`);
          return { ...normalized, variant: variantValue };
        }),
      };
    default:
      throw new Error(`${sourceLabel}: unsupported structured article block type ${type}`);
  }
}

function normalizeArticleDetail(payload, sourceLabel) {
  assert(isRecord(payload), `${sourceLabel}: root must be an object`);
  assert(Array.isArray(payload.sections) && payload.sections.length > 0, `${sourceLabel}: sections must be a non-empty array`);

  return {
    schemaVersion: assertNonEmptyString(payload.schemaVersion, 'schemaVersion', sourceLabel),
    slug: assertNonEmptyString(payload.slug, 'slug', sourceLabel),
    category: assertNonEmptyString(payload.category, 'category', sourceLabel),
    locale: assertNonEmptyString(payload.locale, 'locale', sourceLabel),
    updatedAt: assertNonEmptyString(payload.updatedAt, 'updatedAt', sourceLabel),
    seo: {
      title: assertNonEmptyString(payload.seo?.title, 'seo.title', sourceLabel),
      description: assertNonEmptyString(payload.seo?.description, 'seo.description', sourceLabel),
    },
    summary: assertNonEmptyString(payload.summary, 'summary', sourceLabel),
    sections: payload.sections.map((section, sectionIndex) => {
      const sectionField = `sections[${sectionIndex}]`;
      assert(isRecord(section), `${sourceLabel}: ${sectionField} must be an object`);
      assert(Array.isArray(section.blocks) && section.blocks.length > 0, `${sourceLabel}: ${sectionField}.blocks must be a non-empty array`);
      return {
        id: assertNonEmptyString(section.id, `${sectionField}.id`, sourceLabel),
        title: assertNonEmptyString(section.title, `${sectionField}.title`, sourceLabel),
        blocks: section.blocks.map((block, blockIndex) => normalizeArticleBlock(block, `${sectionField}.blocks[${blockIndex}]`, sourceLabel)),
      };
    }),
    ...(payload.cta === undefined
      ? {}
      : {
          cta: {
            ...(payload.cta?.primary === undefined ? {} : { primary: normalizeCtaLink(payload.cta.primary, 'cta.primary', sourceLabel) }),
            ...(payload.cta?.secondary === undefined ? {} : { secondary: normalizeCtaLink(payload.cta.secondary, 'cta.secondary', sourceLabel) }),
          },
        }),
  };
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

export function resolveStructuredArticle(slug, locale = 'zh-CN', { snapshotRoot } = {}) {
  const resolvedLocale = resolveArticleLocale(locale);
  const snapshotBase = resolveArticlesSnapshotRoot(snapshotRoot);
  const fallbackLocales = buildArticleLocaleFallbacks(resolvedLocale);

  for (const candidateLocale of fallbackLocales) {
    const candidatePath = path.join(snapshotBase, candidateLocale, `${slug}.json`);
    const payload = readJsonFile(candidatePath);
    if (!payload) {
      continue;
    }

    const detail = normalizeArticleDetail(payload, candidatePath);
    assert(detail.slug === slug, `${candidatePath}: slug must match the requested article slug`);
    assert(detail.locale === candidateLocale, `${candidatePath}: locale must match the snapshot folder name`);

    return {
      requestedLocale: resolvedLocale,
      resolvedLocale: candidateLocale,
      fallbackLocales,
      detail,
      snapshotPath: candidatePath,
      usedFallback: candidateLocale !== resolvedLocale,
    };
  }

  throw new Error(`Structured article ${slug} could not be resolved from snapshot locales ${fallbackLocales.join(', ')}.`);
}

export function getStructuredArticleViewModel(slug, locale = 'zh-CN', options = {}) {
  const { requestedLocale, resolvedLocale, detail, snapshotPath, usedFallback } = resolveStructuredArticle(slug, locale, options);

  return {
    slug: detail.slug,
    title: detail.seo.title,
    description: detail.seo.description,
    summary: detail.summary,
    updatedAt: detail.updatedAt,
    requestedLocale,
    resolvedLocale,
    usedFallback,
    snapshotPath,
    sections: detail.sections,
    toc: detail.sections.map((section) => ({ id: section.id, title: section.title })),
    cta: detail.cta ?? {},
  };
}
