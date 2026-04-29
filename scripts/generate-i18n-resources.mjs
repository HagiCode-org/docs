import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load } from 'js-yaml';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(scriptDirectory, '..');
const defaultConfigPath = path.join(docsRoot, 'hagi18n.yaml');
const defaultGeneratedPath = path.join(docsRoot, 'src/i18n/generated/docs-locale-resources.mjs');

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeNames(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function relativeToDocsRoot(filePath) {
  return toPosixPath(path.relative(docsRoot, filePath));
}

function extractPlaceholders(value) {
  if (typeof value !== 'string') {
    return [];
  }

  return normalizeNames(
    [...value.matchAll(/\{\{\s*([A-Za-z0-9_$.-]+)(?:\s*,[^}]*)?\s*\}\}/gu)].map(
      (match) => match[1],
    ),
  );
}

function collectScalarEntries(value, prefix = []) {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectScalarEntries(entry, [...prefix, String(index)]));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, entry]) => collectScalarEntries(entry, [...prefix, key]));
  }

  return [{ path: prefix.join('.'), value }];
}

function getScalarPathMap(namespaceData) {
  return new Map(collectScalarEntries(namespaceData).map((entry) => [entry.path, entry.value]));
}

async function readYamlFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const data = load(raw);
  assert(isPlainObject(data), `${relativeToDocsRoot(filePath)} must be a top-level mapping`);
  return data;
}

async function resolveConfig(options = {}) {
  const configPath = options.configPath ?? defaultConfigPath;
  const resolvedConfigPath = path.resolve(configPath);
  const configDirectory = path.dirname(resolvedConfigPath);
  const config = await readYamlFile(resolvedConfigPath);

  assert.equal(config.baseLocale, 'en-US', 'Docs hagi18n baseLocale must be en-US');
  assert(Array.isArray(config.targetLocales), 'Docs hagi18n targetLocales must be an array');

  const expectedLocales = normalizeNames([config.baseLocale, ...config.targetLocales]);
  assert.deepEqual(
    expectedLocales,
    ['de-DE', 'en-US', 'es-ES', 'fr-FR', 'ja-JP', 'ko-KR', 'pt-BR', 'ru-RU', 'zh-CN', 'zh-Hant'],
    'Docs generated resources must match the desktop-supported blog language set',
  );

  return {
    configPath: resolvedConfigPath,
    configDirectory,
    localesRoot: path.resolve(configDirectory, config.localesRoot),
    generatedPath: path.resolve(configDirectory, options.generatedPath ?? defaultGeneratedPath),
    baseLocale: config.baseLocale,
    targetLocales: normalizeNames(config.targetLocales),
    expectedLocales,
  };
}

async function listDirectories(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return normalizeNames(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
}

async function listNamespaceFiles(localeDirectory) {
  const entries = await fs.readdir(localeDirectory, { withFileTypes: true });
  const namespaceFiles = entries
    .filter((entry) => entry.isFile() && /\.(?:ya?ml)$/u.test(entry.name))
    .map((entry) => ({
      namespace: entry.name.replace(/\.(?:ya?ml)$/u, ''),
      filePath: path.join(localeDirectory, entry.name),
    }));

  const namespaceNames = namespaceFiles.map((entry) => entry.namespace);
  assert.equal(
    new Set(namespaceNames).size,
    namespaceNames.length,
    `${relativeToDocsRoot(localeDirectory)} has duplicate YAML namespace names`,
  );

  return namespaceFiles.sort((left, right) => left.namespace.localeCompare(right.namespace));
}

function validateTargetNamespaceShape(baseLocale, targetLocale, namespace, baseData, targetData) {
  const baseScalars = getScalarPathMap(baseData);
  const targetScalars = getScalarPathMap(targetData);
  const basePaths = normalizeNames(baseScalars.keys());
  const targetPaths = normalizeNames(targetScalars.keys());

  assert.deepEqual(
    targetPaths,
    basePaths,
    `${targetLocale}/${namespace}.yml scalar key paths must match ${baseLocale}/${namespace}.yml`,
  );

  const placeholderErrors = [];
  for (const scalarPath of basePaths) {
    const basePlaceholders = extractPlaceholders(baseScalars.get(scalarPath));
    const targetPlaceholders = extractPlaceholders(targetScalars.get(scalarPath));
    if (formatJson(targetPlaceholders) !== formatJson(basePlaceholders)) {
      placeholderErrors.push(
        `${targetLocale}/${namespace}.yml:${scalarPath} placeholders ${formatJson(
          targetPlaceholders,
        )} do not match ${baseLocale} placeholders ${formatJson(basePlaceholders)}`,
      );
    }
  }

  assert.equal(placeholderErrors.length, 0, placeholderErrors.join('\n'));
}

async function loadYamlLocaleTree(options = {}) {
  const metadata = await resolveConfig(options);
  const actualLocales = await listDirectories(metadata.localesRoot);

  assert.deepEqual(
    actualLocales,
    metadata.expectedLocales,
    `Locale directories in ${relativeToDocsRoot(metadata.localesRoot)} must match hagi18n.yaml`,
  );

  const resources = {};
  let expectedNamespaces = null;

  for (const locale of metadata.expectedLocales) {
    const localeDirectory = path.join(metadata.localesRoot, locale);
    const namespaceFiles = await listNamespaceFiles(localeDirectory);
    const namespaces = normalizeNames(namespaceFiles.map((entry) => entry.namespace));

    if (expectedNamespaces === null) {
      expectedNamespaces = namespaces;
    } else {
      assert.deepEqual(
        namespaces,
        expectedNamespaces,
        `${locale} YAML namespaces must match ${metadata.baseLocale}`,
      );
    }

    resources[locale] = {};
    for (const { namespace, filePath } of namespaceFiles) {
      resources[locale][namespace] = await readYamlFile(filePath);
    }
  }

  for (const targetLocale of metadata.targetLocales) {
    for (const namespace of expectedNamespaces ?? []) {
      validateTargetNamespaceShape(
        metadata.baseLocale,
        targetLocale,
        namespace,
        resources[metadata.baseLocale][namespace],
        resources[targetLocale][namespace],
      );
    }
  }

  return {
    ...metadata,
    expectedNamespaces: expectedNamespaces ?? [],
    resources,
  };
}

function buildRouteLocales(resources) {
  const baseMetadata = resources['en-US'].metadata;
  const routeLocales = baseMetadata.locales;
  assert(isPlainObject(routeLocales), 'metadata.locales must be a mapping');

  for (const [routeLocale, metadata] of Object.entries(routeLocales)) {
    assert(isPlainObject(metadata), `metadata.locales.${routeLocale} must be a mapping`);
    assert.equal(metadata.routeLocale, routeLocale, `metadata.locales.${routeLocale}.routeLocale mismatch`);
    assert.equal(typeof metadata.sourceLocale, 'string', `metadata.locales.${routeLocale}.sourceLocale is required`);
    assert.equal(typeof metadata.label, 'string', `metadata.locales.${routeLocale}.label is required`);
    assert.equal(typeof metadata.lang, 'string', `metadata.locales.${routeLocale}.lang is required`);
  }

  return routeLocales;
}

function buildRuntimeResources(resources) {
  const routeLocales = buildRouteLocales(resources);

  return {
    resources,
    docsLocales: Object.fromEntries(
      Object.entries(routeLocales).map(([routeLocale, locale]) => [
        routeLocale,
        {
          label: locale.label,
          lang: locale.lang,
        },
      ]),
    ),
    localeSelectorOptions: Object.entries(routeLocales).map(([routeLocale, locale]) => ({
      code: routeLocale,
      sourceLocale: locale.sourceLocale,
      label: locale.label,
      lang: locale.lang,
      htmlLang: locale.htmlLang,
      direction: locale.direction,
    })),
    blogPluginTitle: {
      root: resources['zh-CN'].blog.plugin.title,
      'zh-CN': resources['zh-CN'].blog.plugin.title,
      en: resources['en-US'].blog.plugin.title,
      'en-US': resources['en-US'].blog.plugin.title,
      'zh-Hant': resources['zh-Hant'].blog.plugin.title,
      'ja-JP': resources['ja-JP'].blog.plugin.title,
      'ko-KR': resources['ko-KR'].blog.plugin.title,
      'de-DE': resources['de-DE'].blog.plugin.title,
      'fr-FR': resources['fr-FR'].blog.plugin.title,
      'es-ES': resources['es-ES'].blog.plugin.title,
      'pt-BR': resources['pt-BR'].blog.plugin.title,
      'ru-RU': resources['ru-RU'].blog.plugin.title,
    },
    blogUiTranslations: {
      'zh-CN': resources['zh-CN'].blog.ui,
      'zh-cn': resources['zh-CN'].blog.ui,
      zh: resources['zh-CN'].blog.ui,
      en: resources['en-US'].blog.ui,
      'en-US': resources['en-US'].blog.ui,
      'zh-Hant': resources['zh-Hant'].blog.ui,
      'ja-JP': resources['ja-JP'].blog.ui,
      'ko-KR': resources['ko-KR'].blog.ui,
      'de-DE': resources['de-DE'].blog.ui,
      'fr-FR': resources['fr-FR'].blog.ui,
      'es-ES': resources['es-ES'].blog.ui,
      'pt-BR': resources['pt-BR'].blog.ui,
      'ru-RU': resources['ru-RU'].blog.ui,
    },
  };
}

function buildGeneratedModule(resources) {
  const runtime = buildRuntimeResources(resources);
  const json = formatJson(runtime);

  return `// This file is generated by scripts/generate-i18n-resources.mjs. Do not edit manually.
const runtime = ${json};

export const DOCS_LOCALE_RESOURCES = runtime.resources;
export const DOCS_LOCALES = runtime.docsLocales;
export const DOCS_LOCALE_SELECTOR_OPTIONS = runtime.localeSelectorOptions;
export const BLOG_PLUGIN_TITLE = runtime.blogPluginTitle;
export const BLOG_UI_TRANSLATIONS = runtime.blogUiTranslations;
export const BLOG_UI_TRANSLATIONS_ZH_CN = runtime.blogUiTranslations['zh-CN'];
export default runtime;
`;
}

export async function generateI18nResources(options = {}) {
  const { generatedPath, resources, expectedLocales, expectedNamespaces } = await loadYamlLocaleTree(options);
  const generatedModule = buildGeneratedModule(resources);

  await fs.mkdir(path.dirname(generatedPath), { recursive: true });
  await fs.writeFile(generatedPath, generatedModule, 'utf8');

  return {
    generatedPath,
    localeCount: expectedLocales.length,
    namespaceCount: expectedNamespaces.length,
  };
}

export async function verifyGeneratedI18nResources(options = {}) {
  const { generatedPath, resources, expectedLocales, expectedNamespaces } = await loadYamlLocaleTree(options);
  const expectedModule = buildGeneratedModule(resources);
  const actualModule = await fs.readFile(generatedPath, 'utf8');

  assert.equal(
    actualModule,
    expectedModule,
    `${relativeToDocsRoot(generatedPath)} is stale; rerun npm run i18n:generate`,
  );

  return {
    generatedPath,
    localeCount: expectedLocales.length,
    namespaceCount: expectedNamespaces.length,
  };
}

function parseCliArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--check':
        options.check = true;
        break;
      case '--config':
        options.configPath = argv[index + 1];
        index += 1;
        break;
      case '--generated-path':
        options.generatedPath = argv[index + 1];
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.check) {
    const result = await verifyGeneratedI18nResources(options);
    console.log(
      `Verified generated docs i18n resources in ${relativeToDocsRoot(
        result.generatedPath,
      )} for ${result.localeCount} locales and ${result.namespaceCount} namespaces.`,
    );
    return;
  }

  const result = await generateI18nResources(options);
  console.log(
    `Generated docs i18n resources in ${relativeToDocsRoot(
      result.generatedPath,
    )} for ${result.localeCount} locales and ${result.namespaceCount} namespaces.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
