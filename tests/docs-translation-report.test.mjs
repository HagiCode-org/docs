import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import {
  generateDocsTranslationReport,
  main,
  REQUIRED_DOCS_LOCALES,
} from '../scripts/report-docs-translation-status.mjs';

async function withFixture(fn) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-translation-report-'));
  try {
    await fn(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

function getLocalePrefix(locale) {
  return locale.contentDirectory || '';
}

async function writeDoc(root, locale, relativeDocPath, body, frontmatter = {}) {
  const directory = path.join(root, getLocalePrefix(locale), path.dirname(relativeDocPath));
  await fs.mkdir(directory, { recursive: true });
  const frontmatterLines = Object.entries({
    title: `${relativeDocPath} ${locale.code}`,
    description: `${relativeDocPath} description ${locale.code}`,
    ...frontmatter,
  }).map(([key, value]) => `${key}: ${value}`);

  await fs.writeFile(
    path.join(root, getLocalePrefix(locale), relativeDocPath),
    `---\n${frontmatterLines.join('\n')}\n---\n\n${body}\n`,
    'utf8',
  );
}

async function writeCompleteSet(root, relativeDocPath, bodyByLocale = {}) {
  await Promise.all(
    REQUIRED_DOCS_LOCALES.map((locale) =>
      writeDoc(
        root,
        locale,
        relativeDocPath,
        bodyByLocale[locale.code] ?? `Localized docs content for ${locale.code} in ${relativeDocPath}.`,
      ),
    ),
  );
}

test('reports missing localized docs files', async () => {
  await withFixture(async (root) => {
    const relativeDocPath = 'guides/example.mdx';
    await writeCompleteSet(root, relativeDocPath);
    await fs.rm(path.join(root, 'fr-FR/guides/example.mdx'));

    const report = await generateDocsTranslationReport({
      contentRoot: root,
      translationRoot: root,
      reportPath: '.tmp/docs-report.json',
    });

    const entry = report.entries.find((item) => item.docKey === 'guides/example');
    assert(entry);
    assert.deepEqual(entry.missingLocales, ['fr-FR']);
    assert.equal(report.summary.missingTranslations, 1);
  });
});

test('reports exact duplicate bodies against zh-CN baseline', async () => {
  await withFixture(async (root) => {
    const relativeDocPath = 'guides/duplicates.mdx';
    const baselineBody = '这是一篇尚未翻译的文档，因此内容和中文基线完全一致。';
    await writeCompleteSet(root, relativeDocPath, {
      'zh-CN': baselineBody,
      'de-DE': baselineBody,
      'fr-FR': baselineBody,
      'en-US': 'English content that is not identical to the Chinese baseline.',
    });

    const report = await generateDocsTranslationReport({
      contentRoot: root,
      translationRoot: root,
      reportPath: '.tmp/docs-report.json',
    });

    const entry = report.entries.find((item) => item.docKey === 'guides/duplicates');
    assert(entry);
    assert.equal(entry.duplicateComparisons.length, 2);
    assert.deepEqual(
      entry.duplicateComparisons.map((comparison) => comparison.locale),
      ['de-DE', 'fr-FR'],
    );
  });
});

test('reports highly similar docs against zh-CN baseline and writes a JSON report', async () => {
  await withFixture(async (root) => {
    const relativeDocPath = 'guides/similar.mdx';
    const chineseBody = [
      '这篇文档解释了 HagiCode 中一个关键的安装步骤。',
      '它覆盖了依赖项检查、环境准备以及常见故障的排查方法。',
      '最后一节总结了推荐的安装顺序。',
    ].join(' ');
    const spanishBody = [
      '这篇文档解释了 HagiCode 中一个关键的安装步骤。',
      '它覆盖了依赖项检查、环境准备以及常见故障的排查方法。',
      '最后一节总结了建议的安装顺序。',
    ].join(' ');

    await writeCompleteSet(root, relativeDocPath, {
      'zh-CN': chineseBody,
      'es-ES': spanishBody,
    });

    const report = await generateDocsTranslationReport({
      contentRoot: root,
      translationRoot: root,
      reportPath: '.tmp/docs-translation-report.json',
      highSimilarityThreshold: 0.8,
    });

    const entry = report.entries.find((item) => item.docKey === 'guides/similar');
    assert(entry);
    assert.equal(entry.similarComparisons.length, 1);
    assert.equal(entry.similarComparisons[0].locale, 'es-ES');

    const reportFile = path.join(root, '.tmp/docs-translation-report.json');
    const onDisk = JSON.parse(await fs.readFile(reportFile, 'utf8'));
    assert.equal(onDisk.summary.totalBaselineDocs, 1);
    assert.equal(onDisk.summary.highSimilarityComparisonsVsBaseline, 1);
  });
});

test('covers the full configured locale set including zh-CN baseline', async () => {
  const expectedLocales = [
    'zh-CN', 'en-US', 'zh-Hant', 'fr-FR', 'it-IT',
    'de-DE', 'es-ES', 'bg-BG', 'cs-CZ', 'da-DK',
    'nl-NL', 'fi-FI', 'el-GR', 'hu-HU', 'id-ID',
    'ja-JP', 'ko-KR', 'nb-NO', 'pl-PL', 'pt-BR',
    'pt-PT', 'ro-RO', 'ru-RU', 'es-419', 'sv-SE',
    'th-TH', 'tr-TR', 'uk-UA', 'vi-VN',
  ];
  const actualCodes = REQUIRED_DOCS_LOCALES.map((locale) => locale.code);
  assert.deepEqual(actualCodes, expectedLocales);

  const contentDirectories = REQUIRED_DOCS_LOCALES
    .filter((locale) => locale.contentDirectory)
    .map((locale) => locale.contentDirectory);
  const expectedDirectories = [
    'en-US', 'zh-Hant', 'fr-FR', 'it-IT', 'de-DE',
    'es-ES', 'bg-BG', 'cs-CZ', 'da-DK', 'nl-NL',
    'fi-FI', 'el-GR', 'hu-HU', 'id-ID', 'ja-JP',
    'ko-KR', 'nb-NO', 'pl-PL', 'pt-BR', 'pt-PT',
    'ro-RO', 'ru-RU', 'es-419', 'sv-SE', 'th-TH',
    'tr-TR', 'uk-UA', 'vi-VN',
  ];
  assert.deepEqual(contentDirectories, expectedDirectories);
});

test('reports no findings when all locales are present and translated', async () => {
  await withFixture(async (root) => {
    const relativeDocPath = 'installation/index.mdx';
    await writeCompleteSet(root, relativeDocPath);

    const report = await generateDocsTranslationReport({
      contentRoot: root,
      translationRoot: root,
      reportPath: null,
    });

    assert.equal(report.summary.docsWithFindings, 0);
    assert.equal(report.summary.missingTranslations, 0);
    assert.equal(report.summary.exactDuplicateComparisonsVsBaseline, 0);
    assert.equal(report.summary.highSimilarityComparisonsVsBaseline, 0);
  });
});

test('fail-on-findings exits non-zero when findings remain', async () => {
  await withFixture(async (root) => {
    const relativeDocPath = 'faq/index.mdx';
    await writeDoc(root, REQUIRED_DOCS_LOCALES[0], relativeDocPath, '中文内容');

    const scriptPath = pathToFileURL(
      path.resolve(root, '../../../scripts/report-docs-translation-status.mjs'),
    ).href;

    const originalExitCode = process.exitCode;
    process.exitCode = 0;

    await main([
      '--root-dir',
      root,
      '--translations-root-dir',
      root,
      '--fail-on-findings',
      '--report-json',
      '/dev/null',
    ]);

    assert.equal(process.exitCode, 1);
    process.exitCode = originalExitCode;
  });
});
