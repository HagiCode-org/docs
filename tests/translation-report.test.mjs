import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  REQUIRED_DOCS_LOCALES,
} from '../scripts/report-docs-translation-status.mjs';
import {
  generateTranslationReport,
} from '../scripts/report-translation-status.mjs';
import {
  REQUIRED_BLOG_LOCALES,
} from '../scripts/verify-blog-i18n-completeness.mjs';

async function withFixture(fn) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-translation-combined-report-'));
  try {
    await fn(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

function getDocsLocalePrefix(locale) {
  return locale.contentDirectory || '';
}

async function writeDoc(root, locale, relativeDocPath, body) {
  const directory = path.join(root, getDocsLocalePrefix(locale), path.dirname(relativeDocPath));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(root, getDocsLocalePrefix(locale), relativeDocPath),
    `---\ntitle: ${relativeDocPath} ${locale.code}\ndescription: ${relativeDocPath} description ${locale.code}\n---\n\n${body}\n`,
    'utf8',
  );
}

async function writePost(root, locale, slug, body) {
  const directory = path.join(root, locale.blogDir);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, `${slug}.mdx`),
    `---\ntitle: ${slug} ${locale.code}\ndate: 2026-05-06\ndescription: ${slug} description ${locale.code}\n---\n\n${body}\n`,
    'utf8',
  );
}

test('combines docs and blog coverage into a single translation report', async () => {
  await withFixture(async (root) => {
    const docPath = 'guides/example.mdx';
    await Promise.all(
      REQUIRED_DOCS_LOCALES
        .filter((locale) => locale.code !== 'fr-FR')
        .map((locale) => writeDoc(root, locale, docPath, `Localized docs content for ${locale.code}.`)),
    );

    const slug = '2026-05-06-example';
    await Promise.all(
      REQUIRED_BLOG_LOCALES
        .filter((locale) => locale.code !== 'en-US')
        .map((locale) => writePost(root, locale, slug, `Localized blog content for ${locale.code}.`)),
    );

    const report = await generateTranslationReport({
      contentRoot: root,
      translationRoot: root,
      reportPath: '.tmp/translation-report.json',
      docsReportPath: '.tmp/docs-report.json',
      blogReportPath: '.tmp/blog-report.json',
      sampleLimit: 2,
    });

    assert.equal(report.summary.totalMissingTranslations, 2);
    assert.equal(report.summary.localesWithMissingTranslations, 2);
    assert.equal(report.docs.summary.missingTranslations, 1);
    assert.equal(report.blog.summary.missingTranslations, 1);

    const frenchCoverage = report.locales.find((locale) => locale.code === 'fr-FR');
    assert(frenchCoverage);
    assert.equal(frenchCoverage.docs?.missingCount, 1);
    assert.equal(frenchCoverage.docs?.translatedEntries, 0);
    assert.equal(frenchCoverage.blog?.missingCount, 0);

    const englishCoverage = report.locales.find((locale) => locale.code === 'en-US');
    assert(englishCoverage);
    assert.equal(englishCoverage.docs?.missingCount, 0);
    assert.equal(englishCoverage.blog?.missingCount, 1);
    assert.equal(englishCoverage.blog?.translatedEntries, 0);

    const onDisk = JSON.parse(await fs.readFile(path.join(root, '.tmp/translation-report.json'), 'utf8'));
    assert.equal(onDisk.summary.totalMissingTranslations, 2);
    assert.equal(onDisk.paths.docsReport, '.tmp/docs-report.json');
    assert.equal(onDisk.paths.blogReport, '.tmp/blog-report.json');
  });
});
