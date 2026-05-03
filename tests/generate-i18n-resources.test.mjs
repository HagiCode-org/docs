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
const desktopLocaleCodes = [
  'en-US',
  'zh-CN',
  'zh-Hant',
  'ja-JP',
  'ko-KR',
  'de-DE',
  'fr-FR',
  'es-ES',
  'pt-BR',
  'ru-RU',
];
const targetLocaleCodes = desktopLocaleCodes.filter((locale) => locale !== 'en-US');

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
      locales: {
        root: {
          sourceLocale: 'zh-CN',
          routeLocale: 'root',
          label: '中文',
          lang: 'zh-CN',
          htmlLang: 'zh-CN',
          direction: 'ltr',
        },
        'en-US': {
          sourceLocale: 'en-US',
          routeLocale: 'en-US',
          label: 'English',
          lang: 'en-US',
          htmlLang: 'en-US',
          direction: 'ltr',
        },
        'ja-JP': {
          sourceLocale: 'ja-JP',
          routeLocale: 'ja-JP',
          label: '日本語',
          lang: 'ja-JP',
          htmlLang: 'ja-JP',
          direction: 'ltr',
        },
      },
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
  assert.equal(generatedModule.DOCS_LOCALES.root.label, '中文');
  assert.equal(generatedModule.DOCS_LOCALES['en-US'].lang, 'en-US');
  assert.equal(generatedModule.DOCS_LOCALES['ja-JP'].label, '日本語');
  assert.equal(generatedModule.BLOG_PLUGIN_TITLE.root, '博客');
  assert.deepEqual(Object.keys(generatedModule.DOCS_LOCALE_RESOURCES).sort(), [...desktopLocaleCodes].sort());
  assert.deepEqual(
    Object.keys(generatedModule.BLOG_UI_TRANSLATIONS).sort(),
    ['de-DE', 'en', 'en-US', 'es-ES', 'fr-FR', 'ja-JP', 'ko-KR', 'pt-BR', 'ru-RU', 'zh', 'zh-CN', 'zh-Hant', 'zh-cn'],
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
