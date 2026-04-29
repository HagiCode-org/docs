import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  generateBlogTranslationReport,
} from '../scripts/report-blog-translation-status.mjs';
import {
  REQUIRED_BLOG_LOCALES,
} from '../scripts/verify-blog-i18n-completeness.mjs';

async function withFixture(fn) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-blog-translation-report-'));
  try {
    await fn(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function writePost(root, locale, slug, body, frontmatter = {}) {
  const directory = path.join(root, locale.blogDir);
  await fs.mkdir(directory, { recursive: true });
  const frontmatterLines = Object.entries({
    title: `${slug} ${locale.code}`,
    date: '2026-04-29',
    description: `${slug} description ${locale.code}`,
    ...frontmatter,
  }).map(([key, value]) => `${key}: ${value}`);

  await fs.writeFile(
    path.join(directory, `${slug}.mdx`),
    `---\n${frontmatterLines.join('\n')}\n---\n\n${body}\n`,
    'utf8',
  );
}

async function writeCompleteSet(root, slug, bodyByLocale = {}) {
  await Promise.all(
    REQUIRED_BLOG_LOCALES.map((locale) =>
      writePost(
        root,
        locale,
        slug,
        bodyByLocale[locale.code] ?? `Localized content for ${locale.code} and ${slug}.`,
      ),
    ),
  );
}

test('reports missing localized blog files', async () => {
  await withFixture(async (root) => {
    await writeCompleteSet(root, '2026-04-29-example');
    await fs.rm(path.join(root, 'fr-FR/blog/2026-04-29-example.mdx'));

    const report = await generateBlogTranslationReport({
      contentRoot: root,
      reportPath: '.tmp/report.json',
    });

    const entry = report.entries.find((item) => item.slug === '2026-04-29-example');
    assert(entry);
    assert.deepEqual(entry.missingLocales, ['fr-FR']);
    assert.equal(report.summary.missingTranslations, 1);
  });
});

test('reports exact duplicate bodies against zh-CN baseline', async () => {
  await withFixture(async (root) => {
    const slug = '2026-04-29-duplicates';
    const baselineBody = '这篇文章还在等待翻译，目前内容和中文原文完全一致。';
    await writeCompleteSet(root, slug, {
      'zh-CN': baselineBody,
      'de-DE': baselineBody,
      'fr-FR': baselineBody,
      'en-US': 'English content that is not identical to the Chinese baseline.',
    });

    const report = await generateBlogTranslationReport({
      contentRoot: root,
      reportPath: '.tmp/report.json',
    });

    const entry = report.entries.find((item) => item.slug === slug);
    assert(entry);
    assert.equal(entry.duplicateComparisons.length, 2);
    assert.deepEqual(
      entry.duplicateComparisons.map((comparison) => comparison.locale),
      ['de-DE', 'fr-FR'],
    );
  });
});

test('reports highly similar locale content against zh-CN baseline and writes a JSON report', async () => {
  await withFixture(async (root) => {
    const slug = '2026-04-29-similar';
    const chineseBody = [
      '这篇文章解释了 HagiCode 中一个实用的 SQLite 分片策略。',
      '它详细覆盖了路由、并发和迁移方面的注意事项。',
      '最后一节总结了如何选择合适的分片布局。',
    ].join(' ');
    const spanishBody = [
      '这篇文章解释了 HagiCode 中一个实用的 SQLite 分片策略。',
      '它详细覆盖了路由、并发和迁移方面的注意事项。',
      '最后一节总结了如何选择合适的分片方案。',
    ].join(' ');

    await writeCompleteSet(root, slug, {
      'zh-CN': chineseBody,
      'es-ES': spanishBody,
    });

    const report = await generateBlogTranslationReport({
      contentRoot: root,
      reportPath: '.tmp/blog-translation-report.json',
      highSimilarityThreshold: 0.95,
    });

    const entry = report.entries.find((item) => item.slug === slug);
    assert(entry);
    assert.equal(entry.similarComparisons.length, 1);
    assert.equal(entry.similarComparisons[0].locale, 'es-ES');

    const reportFile = path.join(root, '.tmp/blog-translation-report.json');
    const onDisk = JSON.parse(await fs.readFile(reportFile, 'utf8'));
    assert.equal(onDisk.summary.totalSlugs, 1);
    assert.equal(onDisk.summary.highSimilarityComparisonsVsBaseline, 1);
  });
});
