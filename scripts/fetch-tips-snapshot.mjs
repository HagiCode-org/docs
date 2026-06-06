import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const INDEX_ORIGIN = 'https://index.hagicode.com';
export const TIPS_LOCALES = [
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

function assertNonEmptyString(value, fieldName, sourceLabel) {
  assert(
    typeof value === 'string' && value.trim().length > 0,
    `Invalid tips payload from ${sourceLabel}: ${fieldName} must be a non-empty string`,
  );
  return value.trim();
}

export function buildTipsRoute(locale) {
  return `/tips-${locale}.json`;
}

export function normalizeTipsPayload(payload, expectedLocale, sourceLabel = buildTipsRoute(expectedLocale)) {
  assert(isRecord(payload), `Invalid tips payload from ${sourceLabel}: root must be an object`);

  const schemaVersion = assertNonEmptyString(payload.schemaVersion, 'schemaVersion', sourceLabel);
  const locale = assertNonEmptyString(payload.locale, 'locale', sourceLabel);
  const updatedAt = assertNonEmptyString(payload.updatedAt, 'updatedAt', sourceLabel);
  const tips = payload.tips;

  assert(
    locale === expectedLocale,
    `Invalid tips payload from ${sourceLabel}: expected locale ${expectedLocale} but received ${locale}`,
  );
  assert(
    Array.isArray(tips) && tips.length > 0,
    `Invalid tips payload from ${sourceLabel}: tips must be a non-empty array`,
  );

  const seenIds = new Set();
  const normalizedTips = tips.map((tip, index) => {
    const fieldName = `tips[${index}]`;
    assert(isRecord(tip), `Invalid tips payload from ${sourceLabel}: ${fieldName} must be an object`);

    const id = assertNonEmptyString(tip.id, `${fieldName}.id`, sourceLabel);
    const text = assertNonEmptyString(tip.text, `${fieldName}.text`, sourceLabel);
    const category = assertNonEmptyString(tip.category, `${fieldName}.category`, sourceLabel);

    assert(!seenIds.has(id), `Invalid tips payload from ${sourceLabel}: duplicate tip id ${id}`);
    seenIds.add(id);

    return { id, text, category };
  });

  return {
    schemaVersion,
    locale,
    updatedAt,
    tips: normalizedTips,
  };
}

export async function fetchTipsSnapshot({
  fetchImpl = globalThis.fetch,
  outputPath,
  origin = INDEX_ORIGIN,
  locales = TIPS_LOCALES,
} = {}) {
  assert(typeof fetchImpl === 'function', 'Tips snapshot fetch requires a fetch implementation');
  assertNonEmptyString(outputPath, 'outputPath', 'local output');

  const normalizedOrigin = new URL(origin).origin;
  const localizedPayloads = {};
  const localizedUrls = {};

  for (const locale of locales) {
    const routePath = buildTipsRoute(locale);
    const requestUrl = new URL(routePath, `${normalizedOrigin}/`);
    const response = await fetchImpl(requestUrl, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!response?.ok) {
      throw new Error(`Failed to fetch tips snapshot ${requestUrl}: ${response?.status ?? 'unknown status'}`);
    }

    const contentType = response.headers?.get?.('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error(
        `Failed to fetch tips snapshot ${requestUrl}: expected application/json but received ${contentType || 'unknown content-type'}`,
      );
    }

    localizedUrls[locale] = requestUrl.toString();
    localizedPayloads[locale] = normalizeTipsPayload(await response.json(), locale, requestUrl.toString());
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: {
      origin: normalizedOrigin,
      locales: localizedUrls,
    },
    locales: localizedPayloads,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  return snapshot;
}

function parseArgs(argv) {
  const options = {
    outputPath: undefined,
    origin: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--output') {
      options.outputPath = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--output=')) {
      options.outputPath = argument.slice('--output='.length);
    } else if (argument === '--origin') {
      options.origin = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--origin=')) {
      options.origin = argument.slice('--origin='.length);
    } else if (argument === '--help' || argument === '-h') {
      console.log(`Usage: node scripts/fetch-tips-snapshot.mjs [options]\n\nOptions:\n  --output <path>   Override the tips snapshot output file\n  --origin <url>    Override the Index origin\n  -h, --help        Show this help\n`);
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
  const outputPath = path.resolve(
    repoRoot,
    options.outputPath ?? path.join('src', 'data', 'tips.snapshot.json'),
  );

  await fetchTipsSnapshot({
    outputPath,
    ...(options.origin ? { origin: options.origin } : {}),
  });
  console.log(`Tips snapshot updated at ${path.relative(repoRoot, outputPath)}`);
}
