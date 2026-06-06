import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { afterEach } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dump } from 'js-yaml';
import {
  generateI18nResources,
  verifyGeneratedI18nResources,
} from '../scripts/generate-i18n-resources.mjs';

const temporaryDirectories = [];
const localeDefinitions = [
  { routeLocale: 'root', sourceLocale: 'zh-CN', label: '简体中文', aliases: ['zh', 'zh-CN', 'zh-Hans', 'zh-SG', 'root'] },
  { routeLocale: 'en-US', sourceLocale: 'en-US', label: 'English', aliases: ['en', 'en-US'] },
  { routeLocale: 'zh-Hant', sourceLocale: 'zh-Hant', label: '繁體中文', aliases: ['zh-Hant', 'zh-TW', 'zh-HK', 'zh-MO'] },
  { routeLocale: 'ja-JP', sourceLocale: 'ja-JP', label: '日本語', aliases: ['ja', 'ja-JP'] },
  { routeLocale: 'ko-KR', sourceLocale: 'ko-KR', label: '한국어', aliases: ['ko', 'ko-KR'] },
  { routeLocale: 'de-DE', sourceLocale: 'de-DE', label: 'Deutsch', aliases: ['de', 'de-DE'] },
  { routeLocale: 'fr-FR', sourceLocale: 'fr-FR', label: 'Français', aliases: ['fr', 'fr-FR'] },
  { routeLocale: 'es-ES', sourceLocale: 'es-ES', label: 'Español', aliases: ['es', 'es-ES'] },
  { routeLocale: 'pt-BR', sourceLocale: 'pt-BR', label: 'Português (Brasil)', aliases: ['pt', 'pt-BR'] },
  { routeLocale: 'ru-RU', sourceLocale: 'ru-RU', label: 'Русский', aliases: ['ru', 'ru-RU'] },
];
const docsLocaleCodes = localeDefinitions.map((locale) => locale.sourceLocale);
const targetLocaleCodes = docsLocaleCodes.filter((locale) => locale !== 'en-US');
const metadataLocales = Object.fromEntries(
  localeDefinitions.map((locale) => [
    locale.routeLocale,
    {
      sourceLocale: locale.sourceLocale,
      routeLocale: locale.routeLocale,
      label: locale.label,
      lang: locale.sourceLocale,
      htmlLang: locale.sourceLocale,
      direction: 'ltr',
    },
  ]),
);
const metadataAliases = Object.fromEntries(
  localeDefinitions.flatMap((locale) => locale.aliases.map((alias) => [alias, locale.routeLocale])),
);

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directoryPath) => fs.rm(directoryPath, {
      recursive: true,
      force: true,
    })),
  );
});

async function writeYaml(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, dump(data, { lineWidth: -1, noRefs: true }), 'utf8');
}

async function createFixture() {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hagicode-docs-i18n-'));
  temporaryDirectories.push(fixtureRoot);

  await fs.writeFile(
    path.join(fixtureRoot, 'hagi18n.yaml'),
    [
      'localesRoot: src/i18n/locales',
      'repoRoot: .',
      'baseLocale: en-US',
      'targetLocales:',
      ...targetLocaleCodes.map((locale) => `  - ${locale}`),
      '',
    ].join('\n'),
    'utf8',
  );

  const baseLocaleRoot = path.join(fixtureRoot, 'src/i18n/locales/en-US');
  const sources = {
    blog: {
      plugin: { title: 'Blog' },
      ui: {
        'starlightBlog.authors.count_one': '{{count}} post by {{author}}',
      },
    },
    common: {
      languageSelect: {
        currentLocaleLabel: 'Current language',
      },
    },
    metadata: {
        locales: metadataLocales,
        aliases: metadataAliases,
      },
    starlight: {
      site: {
        title: 'Hagicode Docs',
        description: 'Hagicode project documentation',
      },
    },
  };
  const translatedSources = {
    blog: {
      plugin: { title: '博客' },
      ui: {
        'starlightBlog.authors.count_one': '{{count}} 篇文章 by {{author}}',
      },
    },
    common: {
      languageSelect: {
        currentLocaleLabel: '当前语言',
      },
    },
    metadata: sources.metadata,
    starlight: {
      site: {
        title: 'Hagicode Docs',
        description: 'Hagicode 项目文档',
      },
    },
  };

  for (const [namespace, data] of Object.entries(sources)) {
    await writeYaml(path.join(baseLocaleRoot, `${namespace}.yml`), data);
  }

  for (const locale of targetLocaleCodes) {
    const targetLocaleRoot = path.join(fixtureRoot, `src/i18n/locales/${locale}`);
    const source = locale === 'zh-CN' ? translatedSources : sources;
    for (const [namespace, data] of Object.entries(source)) {
      await writeYaml(path.join(targetLocaleRoot, `${namespace}.yml`), data);
    }
  }

  return {
    fixtureRoot,
    configPath: path.join(fixtureRoot, 'hagi18n.yaml'),
    generatedPath: 'generated/docs-locale-resources.mjs',
    generatedAbsolutePath: path.join(fixtureRoot, 'generated/docs-locale-resources.mjs'),
  };
}

test('generates deterministic docs runtime resources from YAML namespaces', async () => {
  const fixture = await createFixture();

  await generateI18nResources(fixture);

  const generatedModuleUrl = pathToFileURL(fixture.generatedAbsolutePath);
  generatedModuleUrl.search = String(Date.now());
  const generatedModule = await import(generatedModuleUrl.href);
  assert.equal(generatedModule.DOCS_LOCALES.root.label, '简体中文');
  assert.equal(generatedModule.DOCS_LOCALES['en-US'].lang, 'en-US');
  assert.equal(generatedModule.DOCS_LOCALES['ja-JP'].label, '日本語');
  assert.equal(generatedModule.BLOG_PLUGIN_TITLE.root, '博客');
  assert.deepEqual(Object.keys(generatedModule.DOCS_LOCALE_RESOURCES).sort(), [...docsLocaleCodes].sort());
  assert.equal(generatedModule.DOCS_LOCALE_SELECTOR_OPTIONS.length, localeDefinitions.length);
  assert.equal(generatedModule.DOCS_LOCALE_SELECTOR_OPTIONS.find((locale) => locale.code === 'es-ES')?.label, 'Español');
  assert.equal(
    generatedModule.BLOG_UI_TRANSLATIONS.zh['starlightBlog.authors.count_one'],
    '{{count}} 篇文章 by {{author}}',
  );
  assert.equal(
    generatedModule.BLOG_UI_TRANSLATIONS.ja['starlightBlog.authors.count_one'],
    '{{count}} post by {{author}}',
  );

  await assert.doesNotReject(() => verifyGeneratedI18nResources(fixture));
});

test('fails validation when generated resources are stale', async () => {
  const fixture = await createFixture();

  await generateI18nResources(fixture);
  await fs.appendFile(fixture.generatedAbsolutePath, '\n// stale\n', 'utf8');

  await assert.rejects(
    () => verifyGeneratedI18nResources(fixture),
    /generated\/docs-locale-resources\.mjs is stale; rerun npm run i18n:generate/,
  );
});

test('fails validation when target namespace files differ from the base locale', async () => {
  const fixture = await createFixture();
  await fs.rm(path.join(fixture.fixtureRoot, 'src/i18n/locales/zh-CN/common.yml'));

  await assert.rejects(
    () => generateI18nResources(fixture),
    /zh-CN YAML namespaces must match en-US/,
  );
});

test('fails validation when target placeholders differ from the base locale', async () => {
  const fixture = await createFixture();
  await writeYaml(path.join(fixture.fixtureRoot, 'src/i18n/locales/zh-CN/blog.yml'), {
    plugin: { title: '博客' },
    ui: {
      'starlightBlog.authors.count_one': '{{count}} 篇文章',
    },
  });

  await assert.rejects(
    () => generateI18nResources(fixture),
    /placeholders/,
  );
});
