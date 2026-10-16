import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildArticleLocaleFallbacks,
  getRelatedStructuredArticles,
  getStructuredArticleViewModel,
  listStructuredArticleSlugs,
  loadStructuredArticleCore,
  localizeDocsHref,
  resolveStructuredArticle,
  resolveArticleLocale,
} from '../src/lib/articles.mjs';

async function writeArticleFixture(articleRoot, { locale = 'zh-CN', slug = 'claude-vs-hagicode', detail }) {
  const localeRoot = path.join(articleRoot, locale);
  await mkdir(localeRoot, { recursive: true });
  await writeFile(path.join(localeRoot, `${slug}.json`), `${JSON.stringify(detail, null, 2)}\n`, 'utf8');
}

function buildDetailFixture({ locale = 'zh-CN', slug = 'claude-vs-hagicode', blocks }) {
  return {
    schemaVersion: '1.0.0',
    slug,
    category: 'vs-hagicode',
    locale,
    updatedAt: '2026-06-17T00:00:00.000Z',
    seo: {
      title: 'Fixture Article',
      description: 'Fixture description',
    },
    summary: 'Fixture summary',
    sections: [
      {
        id: 'intro',
        title: 'Intro',
        blocks,
      },
    ],
    cta: {
      primary: {
        label: 'Install',
        href: '/installation/',
      },
      secondary: {
        label: 'FAQ',
        href: '/faq/',
      },
    },
  };
}

test('article locale helpers keep route locale aliases and fallback order stable', () => {
  assert.equal(resolveArticleLocale('root'), 'zh-CN');
  assert.equal(resolveArticleLocale('en'), 'en-US');
  assert.deepEqual(buildArticleLocaleFallbacks('zh-Hant'), ['zh-Hant', 'zh-CN', 'en-US']);
  assert.equal(localizeDocsHref('/faq/', 'en-US'), '/en-US/faq/');
  assert.equal(localizeDocsHref('/faq/', 'zh-CN'), '/faq/');
});

test('structured article resolver falls back to another locale when the requested file is missing', async () => {
  const articleRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-structured-articles-'));
  await writeArticleFixture(articleRoot, {
    locale: 'zh-CN',
    slug: 'codex-vs-hagicode',
    detail: buildDetailFixture({
      locale: 'zh-CN',
      slug: 'codex-vs-hagicode',
      blocks: [{ id: 'copy', type: 'rich-text', content: ['Paragraph'] }],
    }),
  });

  const resolved = resolveStructuredArticle('codex-vs-hagicode', 'en-US', { articleRoot });

  assert.equal(resolved.requestedLocale, 'en-US');
  assert.equal(resolved.resolvedLocale, 'zh-CN');
  assert.equal(resolved.usedFallback, true);
});

test('structured article view model supports the bounded block set', async () => {
  const articleRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-structured-articles-blocks-'));
  await writeArticleFixture(articleRoot, {
    locale: 'en-US',
    detail: buildDetailFixture({
      locale: 'en-US',
      blocks: [
        { id: 'copy', type: 'rich-text', content: ['Paragraph'] },
        { id: 'bullets', type: 'bullet-list', items: ['One', 'Two'] },
        { id: 'capabilities', type: 'capability-list', items: [{ id: 'item', title: 'Item', content: ['Content'], bullets: ['Bullet'] }] },
        { id: 'grid', type: 'comparison-grid', items: [{ id: 'row', label: 'Row', agent: 'Agent', hagicode: 'HagiCode', combinedValue: 'Combined' }] },
        { id: 'callout', type: 'callout', tone: 'success', title: 'Callout', content: ['Notice'] },
        { id: 'cta-group', type: 'cta-group', items: [{ label: 'Install', href: '/installation/', variant: 'primary' }, { label: 'FAQ', href: '/faq/', variant: 'secondary' }] },
      ],
    }),
  });

  const article = getStructuredArticleViewModel('claude-vs-hagicode', 'en-US', { articleRoot });

  assert.equal(article.sections[0].blocks.length, 6);
  assert.equal(article.sections[0].blocks[3].type, 'comparison-grid');
  assert.equal(article.sections[0].blocks[5].type, 'cta-group');
});

test('structured article resolver fails when no article file can satisfy the shell slug', async () => {
  const articleRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-structured-articles-missing-'));

  await assert.throws(
    () => resolveStructuredArticle('missing-slug', 'zh-CN', { articleRoot }),
    /could not be resolved/,
  );
});

test('structured article resolver names the file and field path when a file fails core validation', async () => {
  const articleRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-structured-articles-invalid-'));
  const invalidDetail = buildDetailFixture({
    locale: 'zh-CN',
    slug: 'broken-vs-hagicode',
    blocks: [{ id: 'copy', type: 'rich-text', content: ['Paragraph'] }],
  });
  delete invalidDetail.summary;
  await writeArticleFixture(articleRoot, { locale: 'zh-CN', slug: 'broken-vs-hagicode', detail: invalidDetail });

  const expectedFile = path.join(articleRoot, 'zh-CN', 'broken-vs-hagicode.json');
  assert.throws(
    () => resolveStructuredArticle('broken-vs-hagicode', 'zh-CN', { articleRoot }),
    (error) => error.message.includes(expectedFile) && error.message.includes('summary'),
  );
});

test('structured article resolver rejects a file whose locale or slug does not match its path', async () => {
  const localeMismatchRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-structured-articles-locale-'));
  await writeArticleFixture(localeMismatchRoot, {
    locale: 'zh-CN',
    slug: 'claude-vs-hagicode',
    detail: buildDetailFixture({
      locale: 'en-US',
      slug: 'claude-vs-hagicode',
      blocks: [{ id: 'copy', type: 'rich-text', content: ['Paragraph'] }],
    }),
  });
  assert.throws(
    () => resolveStructuredArticle('claude-vs-hagicode', 'zh-CN', { articleRoot: localeMismatchRoot }),
    /locale must match the article folder name/,
  );

  const slugMismatchRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-structured-articles-slug-'));
  await writeArticleFixture(slugMismatchRoot, {
    locale: 'en-US',
    slug: 'claude-vs-hagicode',
    detail: buildDetailFixture({
      locale: 'en-US',
      slug: 'codex-vs-hagicode',
      blocks: [{ id: 'copy', type: 'rich-text', content: ['Paragraph'] }],
    }),
  });
  assert.throws(
    () => resolveStructuredArticle('claude-vs-hagicode', 'en-US', { articleRoot: slugMismatchRoot }),
    /slug must match the requested article slug/,
  );
});

test('slug lister returns the sorted union of article file names across locale directories', async () => {
  const articleRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-structured-articles-slugs-'));
  await writeArticleFixture(articleRoot, { locale: 'zh-CN', slug: 'codex-vs-hagicode', detail: buildDetailFixture({ locale: 'zh-CN', slug: 'codex-vs-hagicode', blocks: [] }) });
  await writeArticleFixture(articleRoot, { locale: 'en-US', slug: 'claude-vs-hagicode', detail: buildDetailFixture({ locale: 'en-US', slug: 'claude-vs-hagicode', blocks: [] }) });
  await writeArticleFixture(articleRoot, { locale: 'en-US', slug: 'codex-vs-hagicode', detail: buildDetailFixture({ locale: 'en-US', slug: 'codex-vs-hagicode', blocks: [] }) });
  await writeFile(path.join(articleRoot, 'en-US', 'notes.txt'), 'not an article', 'utf8');
  await writeFile(path.join(articleRoot, 'stray.json'), '{}', 'utf8');

  assert.deepEqual(listStructuredArticleSlugs({ articleRoot }), ['claude-vs-hagicode', 'codex-vs-hagicode']);
});

test('slug lister fails when the article root has no locale directory', async () => {
  const articleRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-structured-articles-empty-'));
  await writeFile(path.join(articleRoot, 'stray.json'), '{}', 'utf8');

  assert.throws(
    () => listStructuredArticleSlugs({ articleRoot }),
    /must contain at least one locale directory/,
  );
});

test('the default article root is the installed core package data, not a committed snapshot', () => {
  const slugs = listStructuredArticleSlugs();

  assert.ok(slugs.includes('claude-vs-hagicode'));
  const article = getStructuredArticleViewModel('claude-vs-hagicode', 'en-US');
  assert.match(article.sourcePath, /comparison-articles[\\/]en-US[\\/]claude-vs-hagicode\.json$/);
  assert.equal(article.sourcePath.includes('articles.snapshot'), false);
});

test('core loader reports the missing entry point and the minimum core version', async () => {
  const notExported = () => Promise.reject(Object.assign(new Error('Package subpath is not defined by "exports"'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' }));

  await assert.rejects(
    loadStructuredArticleCore({
      importSourceEntry: notExported,
      importValidatorEntry: async () => ({}),
    }),
    (error) => /@hagicode\/hagilight-core\/comparison-articles-source/.test(error.message)
      && /0\.9\.7/.test(error.message),
  );
});

test('view model carries FAQ entries and an article without FAQ gets an empty list', async () => {
  const articleRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-faq-'));
  const withFaq = buildDetailFixture({ locale: 'en-US', blocks: [{ id: 'b', type: 'rich-text', content: ['Body'] }] });
  withFaq.faq = [{ question: 'Is it free?', answer: 'The desktop edition is.' }];
  await writeArticleFixture(articleRoot, { locale: 'en-US', detail: withFaq });
  await writeArticleFixture(articleRoot, {
    locale: 'en-US',
    slug: 'codex-vs-hagicode',
    detail: { ...buildDetailFixture({ locale: 'en-US', slug: 'codex-vs-hagicode', blocks: [{ id: 'b', type: 'rich-text', content: ['Body'] }] }), seo: { title: 'Codex CLI vs HagiCode: Features and Comparison', description: 'd' } },
  });

  assert.deepEqual(getStructuredArticleViewModel('claude-vs-hagicode', 'en-US', { articleRoot }).faq, withFaq.faq);
  assert.deepEqual(getStructuredArticleViewModel('codex-vs-hagicode', 'en-US', { articleRoot }).faq, []);
});

test('related articles skip the current one and link to the reader locale FAQ route', async () => {
  const articleRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-related-'));
  for (const [slug, title] of [
    ['claude-vs-hagicode', 'Claude Code vs HagiCode: Features and Comparison'],
    ['omp-vs-hagicode', 'OMP CLI vs HagiCode: Features and Comparison'],
  ]) {
    const detail = buildDetailFixture({ locale: 'en-US', slug, blocks: [{ id: 'b', type: 'rich-text', content: ['Body'] }] });
    detail.seo.title = title;
    await writeArticleFixture(articleRoot, { locale: 'en-US', slug, detail });
  }

  assert.deepEqual(getRelatedStructuredArticles('claude-vs-hagicode', 'ja-JP', { articleRoot }), [
    { slug: 'omp-vs-hagicode', agentName: 'OMP CLI', href: '/ja-JP/faq/omp-vs-hagicode/' },
  ]);
  assert.equal(getRelatedStructuredArticles('claude-vs-hagicode', 'zh-CN', { articleRoot })[0].href, '/faq/omp-vs-hagicode/');
});
