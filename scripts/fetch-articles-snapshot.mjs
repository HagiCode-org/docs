import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ARTICLES_INDEX_ORIGIN = 'https://index.hagicode.com';
export const ARTICLES_SCHEMA_VERSION = '1.0.0';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value, fieldName, sourceLabel) {
  assert(
    typeof value === 'string' && value.trim().length > 0,
    `Invalid structured article payload from ${sourceLabel}: ${fieldName} must be a non-empty string`,
  );
  return value.trim();
}

function assertStringArray(value, fieldName, sourceLabel) {
  assert(Array.isArray(value) && value.length > 0, `Invalid structured article payload from ${sourceLabel}: ${fieldName} must be a non-empty array`);
  return value.map((entry, index) => assertNonEmptyString(entry, `${fieldName}[${index}]`, sourceLabel));
}

function ensureUnique(values, fieldName, sourceLabel) {
  const seen = new Set();
  for (const value of values) {
    assert(!seen.has(value), `Invalid structured article payload from ${sourceLabel}: duplicate ${fieldName} value ${value}`);
    seen.add(value);
  }
}

function normalizeCtaLink(value, fieldName, sourceLabel) {
  assert(isRecord(value), `Invalid structured article payload from ${sourceLabel}: ${fieldName} must be an object`);
  return {
    label: assertNonEmptyString(value.label, `${fieldName}.label`, sourceLabel),
    href: assertNonEmptyString(value.href, `${fieldName}.href`, sourceLabel),
  };
}

function normalizeArticleBlock(block, fieldName, sourceLabel) {
  assert(isRecord(block), `Invalid structured article payload from ${sourceLabel}: ${fieldName} must be an object`);
  const id = assertNonEmptyString(block.id, `${fieldName}.id`, sourceLabel);
  const type = assertNonEmptyString(block.type, `${fieldName}.type`, sourceLabel);

  switch (type) {
    case 'rich-text':
      return {
        id,
        type,
        content: assertStringArray(block.content, `${fieldName}.content`, sourceLabel),
      };
    case 'bullet-list':
      return {
        id,
        type,
        items: assertStringArray(block.items, `${fieldName}.items`, sourceLabel),
      };
    case 'capability-list': {
      assert(Array.isArray(block.items) && block.items.length > 0, `Invalid structured article payload from ${sourceLabel}: ${fieldName}.items must be a non-empty array`);
      const items = block.items.map((item, index) => {
        const itemField = `${fieldName}.items[${index}]`;
        assert(isRecord(item), `Invalid structured article payload from ${sourceLabel}: ${itemField} must be an object`);
        return {
          id: assertNonEmptyString(item.id, `${itemField}.id`, sourceLabel),
          title: assertNonEmptyString(item.title, `${itemField}.title`, sourceLabel),
          content: assertStringArray(item.content, `${itemField}.content`, sourceLabel),
          ...(item.bullets === undefined ? {} : { bullets: assertStringArray(item.bullets, `${itemField}.bullets`, sourceLabel) }),
        };
      });
      ensureUnique(items.map((item) => item.id), `${fieldName}.items ids`, sourceLabel);
      return { id, type, items };
    }
    case 'comparison-grid': {
      assert(Array.isArray(block.items) && block.items.length > 0, `Invalid structured article payload from ${sourceLabel}: ${fieldName}.items must be a non-empty array`);
      const items = block.items.map((item, index) => {
        const itemField = `${fieldName}.items[${index}]`;
        assert(isRecord(item), `Invalid structured article payload from ${sourceLabel}: ${itemField} must be an object`);
        return {
          id: assertNonEmptyString(item.id, `${itemField}.id`, sourceLabel),
          label: assertNonEmptyString(item.label, `${itemField}.label`, sourceLabel),
          agent: assertNonEmptyString(item.agent, `${itemField}.agent`, sourceLabel),
          hagicode: assertNonEmptyString(item.hagicode, `${itemField}.hagicode`, sourceLabel),
          ...(item.combinedValue === undefined ? {} : { combinedValue: assertNonEmptyString(item.combinedValue, `${itemField}.combinedValue`, sourceLabel) }),
        };
      });
      ensureUnique(items.map((item) => item.id), `${fieldName}.items ids`, sourceLabel);
      return { id, type, items };
    }
    case 'callout': {
      const tone = assertNonEmptyString(block.tone, `${fieldName}.tone`, sourceLabel);
      assert(['info', 'success', 'warning'].includes(tone), `Invalid structured article payload from ${sourceLabel}: ${fieldName}.tone must be info, success, or warning`);
      return {
        id,
        type,
        tone,
        ...(block.title === undefined ? {} : { title: assertNonEmptyString(block.title, `${fieldName}.title`, sourceLabel) }),
        content: assertStringArray(block.content, `${fieldName}.content`, sourceLabel),
      };
    }
    case 'cta-group': {
      assert(Array.isArray(block.items) && block.items.length > 0, `Invalid structured article payload from ${sourceLabel}: ${fieldName}.items must be a non-empty array`);
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
          assert(['primary', 'secondary'].includes(variantValue), `Invalid structured article payload from ${sourceLabel}: ${itemField}.variant must be primary or secondary`);
          return { ...normalized, variant: variantValue };
        }),
      };
    }
    default:
      throw new Error(`Invalid structured article payload from ${sourceLabel}: unsupported block type ${type}`);
  }
}

export function normalizeArticleDetail(payload, expectedLocale, expectedSlug, sourceLabel) {
  assert(isRecord(payload), `Invalid structured article payload from ${sourceLabel}: root must be an object`);
  assert(
    assertNonEmptyString(payload.schemaVersion, 'schemaVersion', sourceLabel) === ARTICLES_SCHEMA_VERSION,
    `Invalid structured article payload from ${sourceLabel}: schemaVersion must be ${ARTICLES_SCHEMA_VERSION}`,
  );

  const slug = assertNonEmptyString(payload.slug, 'slug', sourceLabel);
  const locale = assertNonEmptyString(payload.locale, 'locale', sourceLabel);
  assertNonEmptyString(payload.category, 'category', sourceLabel);
  assertNonEmptyString(payload.updatedAt, 'updatedAt', sourceLabel);
  assert(isRecord(payload.seo), `Invalid structured article payload from ${sourceLabel}: seo must be an object`);
  assert(Array.isArray(payload.sections) && payload.sections.length > 0, `Invalid structured article payload from ${sourceLabel}: sections must be a non-empty array`);

  assert(locale === expectedLocale, `Invalid structured article payload from ${sourceLabel}: expected locale ${expectedLocale} but received ${locale}`);
  assert(slug === expectedSlug, `Invalid structured article payload from ${sourceLabel}: expected slug ${expectedSlug} but received ${slug}`);

  const sections = payload.sections.map((section, sectionIndex) => {
    const sectionField = `sections[${sectionIndex}]`;
    assert(isRecord(section), `Invalid structured article payload from ${sourceLabel}: ${sectionField} must be an object`);
    assert(Array.isArray(section.blocks) && section.blocks.length > 0, `Invalid structured article payload from ${sourceLabel}: ${sectionField}.blocks must be a non-empty array`);

    const blocks = section.blocks.map((block, blockIndex) =>
      normalizeArticleBlock(block, `${sectionField}.blocks[${blockIndex}]`, sourceLabel),
    );
    ensureUnique(blocks.map((block) => block.id), `${sectionField}.blocks ids`, sourceLabel);

    return {
      id: assertNonEmptyString(section.id, `${sectionField}.id`, sourceLabel),
      title: assertNonEmptyString(section.title, `${sectionField}.title`, sourceLabel),
      blocks,
    };
  });

  ensureUnique(sections.map((section) => section.id), 'section ids', sourceLabel);

  const normalized = {
    schemaVersion: ARTICLES_SCHEMA_VERSION,
    slug,
    category: assertNonEmptyString(payload.category, 'category', sourceLabel),
    locale,
    updatedAt: assertNonEmptyString(payload.updatedAt, 'updatedAt', sourceLabel),
    seo: {
      title: assertNonEmptyString(payload.seo.title, 'seo.title', sourceLabel),
      description: assertNonEmptyString(payload.seo.description, 'seo.description', sourceLabel),
    },
    summary: assertNonEmptyString(payload.summary, 'summary', sourceLabel),
    sections,
  };

  if (payload.cta === undefined) {
    return normalized;
  }

  assert(isRecord(payload.cta), `Invalid structured article payload from ${sourceLabel}: cta must be an object`);

  return {
    ...normalized,
    cta: {
      ...(payload.cta.primary === undefined ? {} : { primary: normalizeCtaLink(payload.cta.primary, 'cta.primary', sourceLabel) }),
      ...(payload.cta.secondary === undefined ? {} : { secondary: normalizeCtaLink(payload.cta.secondary, 'cta.secondary', sourceLabel) }),
    },
  };
}

export function normalizeArticleLocaleManifest(payload, expectedLocale, sourceLabel) {
  assert(isRecord(payload), `Invalid structured article manifest from ${sourceLabel}: root must be an object`);
  assert(
    assertNonEmptyString(payload.schemaVersion, 'schemaVersion', sourceLabel) === ARTICLES_SCHEMA_VERSION,
    `Invalid structured article manifest from ${sourceLabel}: schemaVersion must be ${ARTICLES_SCHEMA_VERSION}`,
  );

  const locale = assertNonEmptyString(payload.locale, 'locale', sourceLabel);
  assert(locale === expectedLocale, `Invalid structured article manifest from ${sourceLabel}: expected locale ${expectedLocale} but received ${locale}`);
  assertNonEmptyString(payload.generatedAt, 'generatedAt', sourceLabel);
  assert(Array.isArray(payload.articles) && payload.articles.length > 0, `Invalid structured article manifest from ${sourceLabel}: articles must be a non-empty array`);

  const articles = payload.articles.map((article, index) => {
    const fieldName = `articles[${index}]`;
    assert(isRecord(article), `Invalid structured article manifest from ${sourceLabel}: ${fieldName} must be an object`);
    const slug = assertNonEmptyString(article.slug, `${fieldName}.slug`, sourceLabel);
    const pathValue = assertNonEmptyString(article.path, `${fieldName}.path`, sourceLabel);
    assert(pathValue === `/articles/${expectedLocale}/${slug}.json`, `Invalid structured article manifest from ${sourceLabel}: ${fieldName}.path must match the locale detail route`);
    return {
      slug,
      category: assertNonEmptyString(article.category, `${fieldName}.category`, sourceLabel),
      path: pathValue,
      updatedAt: assertNonEmptyString(article.updatedAt, `${fieldName}.updatedAt`, sourceLabel),
      title: assertNonEmptyString(article.title, `${fieldName}.title`, sourceLabel),
      summary: assertNonEmptyString(article.summary, `${fieldName}.summary`, sourceLabel),
    };
  });

  ensureUnique(articles.map((article) => article.slug), 'article slugs', sourceLabel);

  return {
    schemaVersion: ARTICLES_SCHEMA_VERSION,
    locale,
    generatedAt: assertNonEmptyString(payload.generatedAt, 'generatedAt', sourceLabel),
    articles,
  };
}

export function normalizeArticleRootManifest(payload, sourceLabel = '/articles/index.json') {
  assert(isRecord(payload), `Invalid structured article root manifest from ${sourceLabel}: root must be an object`);
  assert(
    assertNonEmptyString(payload.schemaVersion, 'schemaVersion', sourceLabel) === ARTICLES_SCHEMA_VERSION,
    `Invalid structured article root manifest from ${sourceLabel}: schemaVersion must be ${ARTICLES_SCHEMA_VERSION}`,
  );
  assertNonEmptyString(payload.generatedAt, 'generatedAt', sourceLabel);
  assert(Array.isArray(payload.localeIndexes) && payload.localeIndexes.length > 0, `Invalid structured article root manifest from ${sourceLabel}: localeIndexes must be a non-empty array`);

  const localeIndexes = payload.localeIndexes.map((entry, index) => {
    const fieldName = `localeIndexes[${index}]`;
    assert(isRecord(entry), `Invalid structured article root manifest from ${sourceLabel}: ${fieldName} must be an object`);
    const locale = assertNonEmptyString(entry.locale, `${fieldName}.locale`, sourceLabel);
    const routePath = assertNonEmptyString(entry.path, `${fieldName}.path`, sourceLabel);
    assert(routePath === `/articles/${locale}/index.json`, `Invalid structured article root manifest from ${sourceLabel}: ${fieldName}.path must match the locale manifest route`);
    return {
      locale,
      path: routePath,
      updatedAt: assertNonEmptyString(entry.updatedAt, `${fieldName}.updatedAt`, sourceLabel),
    };
  });

  ensureUnique(localeIndexes.map((entry) => entry.locale), 'locale entries', sourceLabel);

  return {
    schemaVersion: ARTICLES_SCHEMA_VERSION,
    generatedAt: assertNonEmptyString(payload.generatedAt, 'generatedAt', sourceLabel),
    localeIndexes,
  };
}

function resolveRequestTarget(routePath, { origin, localPublishedRoot }) {
  if (localPublishedRoot) {
    return {
      kind: 'file',
      label: path.join(localPublishedRoot, routePath.replace(/^\//u, '')),
    };
  }

  return {
    kind: 'http',
    label: new URL(routePath, `${new URL(origin).origin}/`).toString(),
  };
}

async function readJsonFromTarget(routePath, { fetchImpl, origin, localPublishedRoot }) {
  const target = resolveRequestTarget(routePath, { origin, localPublishedRoot });

  if (target.kind === 'file') {
    const raw = await readFile(target.label, 'utf8');
    return {
      label: target.label,
      payload: JSON.parse(raw),
    };
  }

  const response = await fetchImpl(target.label, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response?.ok) {
    throw new Error(`Failed to fetch structured article snapshot ${target.label}: ${response?.status ?? 'unknown status'}`);
  }

  const contentType = response.headers?.get?.('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(
      `Failed to fetch structured article snapshot ${target.label}: expected application/json but received ${contentType || 'unknown content-type'}`,
    );
  }

  return {
    label: target.label,
    payload: await response.json(),
  };
}

async function canRead(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveConfiguredLocalPublishedRoot(repoRoot) {
  if (!process.env.DOCS_ARTICLES_PUBLISHED_ROOT) {
    return null;
  }

  const candidate = path.resolve(repoRoot, process.env.DOCS_ARTICLES_PUBLISHED_ROOT);
  if (await canRead(path.join(candidate, 'articles', 'index.json'))) {
    return candidate;
  }

  return null;
}

export async function fetchArticlesSnapshot({
  fetchImpl = globalThis.fetch,
  outputRoot,
  origin = ARTICLES_INDEX_ORIGIN,
  localPublishedRoot,
  allowRemote = true,
} = {}) {
  assert(typeof fetchImpl === 'function', 'Structured article snapshot fetch requires a fetch implementation');
  assertNonEmptyString(outputRoot, 'outputRoot', 'local output');

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const effectiveLocalPublishedRoot = localPublishedRoot === undefined
    ? await resolveConfiguredLocalPublishedRoot(repoRoot)
    : (localPublishedRoot ? path.resolve(repoRoot, localPublishedRoot) : null);

  if (!effectiveLocalPublishedRoot && !allowRemote && await canRead(path.join(outputRoot, 'index.json'))) {
    return {
      reused: true,
      outputRoot,
      source: 'existing-snapshot',
    };
  }

  const sourceOptions = {
    fetchImpl,
    origin: process.env.DOCS_ARTICLES_ORIGIN ?? origin,
    localPublishedRoot: effectiveLocalPublishedRoot,
  };

  const rootSource = await readJsonFromTarget('/articles/index.json', sourceOptions);
  const rootManifest = normalizeArticleRootManifest(rootSource.payload, rootSource.label);

  const writes = new Map();
  writes.set(path.join(outputRoot, 'index.json'), rootManifest);

  for (const localeEntry of rootManifest.localeIndexes) {
    const localeSource = await readJsonFromTarget(localeEntry.path, sourceOptions);
    const localeManifest = normalizeArticleLocaleManifest(localeSource.payload, localeEntry.locale, localeSource.label);
    writes.set(path.join(outputRoot, localeEntry.locale, 'index.json'), localeManifest);

    for (const articleEntry of localeManifest.articles) {
      const detailSource = await readJsonFromTarget(articleEntry.path, sourceOptions);
      const detail = normalizeArticleDetail(detailSource.payload, localeEntry.locale, articleEntry.slug, detailSource.label);
      writes.set(path.join(outputRoot, localeEntry.locale, `${articleEntry.slug}.json`), detail);
    }
  }

  await rm(outputRoot, { recursive: true, force: true });
  for (const [filePath, value] of writes.entries()) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }

  return {
    reused: false,
    outputRoot,
    source: effectiveLocalPublishedRoot ? `local:${effectiveLocalPublishedRoot}` : new URL(process.env.DOCS_ARTICLES_ORIGIN ?? origin).origin,
    locales: rootManifest.localeIndexes.map((entry) => entry.locale),
    articleCount: [...writes.keys()].filter((filePath) => filePath.endsWith('.json') && !filePath.endsWith('/index.json')).length,
  };
}

function parseArgs(argv) {
  const options = {
    outputRoot: undefined,
    origin: undefined,
    localPublishedRoot: undefined,
    localPublishedRootSpecified: false,
    allowRemote: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--output') {
      options.outputRoot = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--output=')) {
      options.outputRoot = argument.slice('--output='.length);
    } else if (argument === '--origin') {
      options.origin = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--origin=')) {
      options.origin = argument.slice('--origin='.length);
    } else if (argument === '--published-root') {
      options.localPublishedRoot = argv[index + 1];
      options.localPublishedRootSpecified = true;
      index += 1;
    } else if (argument.startsWith('--published-root=')) {
      options.localPublishedRoot = argument.slice('--published-root='.length);
      options.localPublishedRootSpecified = true;
    } else if (argument === '--allow-remote') {
      options.allowRemote = true;
    } else if (argument === '--no-remote') {
      options.allowRemote = false;
    } else if (argument === '--help' || argument === '-h') {
      console.log(`Usage: node scripts/fetch-articles-snapshot.mjs [options]\n\nOptions:\n  --output <path>           Override the structured article snapshot root\n  --origin <url>            Override the Index origin\n  --published-root <path>   Read published article JSON from an explicitly provided local build output\n  --allow-remote            Allow remote fetch from the published Index origin (default)\n  --no-remote               Reuse the committed snapshot instead of remote fetch when possible\n  -h, --help                Show this help\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const options = parseArgs(process.argv.slice(2));
  const outputRoot = path.resolve(
    repoRoot,
    options.outputRoot ?? path.join('src', 'data', 'articles.snapshot'),
  );

  const result = await fetchArticlesSnapshot({
    outputRoot,
    ...(options.origin ? { origin: options.origin } : {}),
    ...(options.localPublishedRootSpecified
      ? { localPublishedRoot: options.localPublishedRoot || null }
      : {}),
    ...(options.allowRemote === undefined ? {} : { allowRemote: options.allowRemote }),
  });

  console.log(
    result.reused
      ? `Structured article snapshot reused at ${path.relative(repoRoot, outputRoot)}`
      : `Structured article snapshot updated at ${path.relative(repoRoot, outputRoot)} from ${result.source}`,
  );
}
