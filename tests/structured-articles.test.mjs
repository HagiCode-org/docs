import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildArticleLocaleFallbacks,
  getStructuredArticleViewModel,
  localizeDocsHref,
  resolveStructuredArticle,
  resolveArticleLocale,
} from '../src/lib/articles.mjs';

async function writeArticleFixture(snapshotRoot, { locale = 'zh-CN', slug = 'claude-vs-hagicode', detail }) {
  const localeRoot = path.join(snapshotRoot, locale);
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
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-structured-articles-'));
  await writeArticleFixture(snapshotRoot, {
    locale: 'zh-CN',
    slug: 'codex-vs-hagicode',
    detail: buildDetailFixture({
      locale: 'zh-CN',
      slug: 'codex-vs-hagicode',
      blocks: [{ id: 'copy', type: 'rich-text', content: ['Paragraph'] }],
    }),
  });

  const resolved = resolveStructuredArticle('codex-vs-hagicode', 'en-US', { snapshotRoot });

  assert.equal(resolved.requestedLocale, 'en-US');
  assert.equal(resolved.resolvedLocale, 'zh-CN');
  assert.equal(resolved.usedFallback, true);
});

test('structured article view model supports the bounded block set', async () => {
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-structured-articles-blocks-'));
  await writeArticleFixture(snapshotRoot, {
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

  const article = getStructuredArticleViewModel('claude-vs-hagicode', 'en-US', { snapshotRoot });

  assert.equal(article.sections[0].blocks.length, 6);
  assert.equal(article.sections[0].blocks[3].type, 'comparison-grid');
  assert.equal(article.sections[0].blocks[5].type, 'cta-group');
});

test('structured article resolver fails when no snapshot file can satisfy the shell slug', async () => {
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-structured-articles-missing-'));

  await assert.throws(
    () => resolveStructuredArticle('missing-slug', 'zh-CN', { snapshotRoot }),
    /could not be resolved/,
  );
});
