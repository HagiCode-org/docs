import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  fetchArticlesSnapshot,
  normalizeArticleDetail,
  normalizeArticleLocaleManifest,
  normalizeArticleRootManifest,
} from '../scripts/fetch-articles-snapshot.mjs';

test('normalizeArticleRootManifest rejects duplicate locale entries', () => {
  assert.throws(
    () => normalizeArticleRootManifest({
      schemaVersion: '1.0.0',
      generatedAt: '2026-06-17T00:00:00.000Z',
      localeIndexes: [
        { locale: 'en-US', path: '/articles/en-US/index.json', updatedAt: '2026-06-17T00:00:00.000Z' },
        { locale: 'en-US', path: '/articles/en-US/index.json', updatedAt: '2026-06-17T00:00:00.000Z' },
      ],
    }, 'fixture'),
    /duplicate locale entries value en-US/,
  );
});

test('normalizeArticleLocaleManifest and detail keep locale specific publication paths', () => {
  const localeManifest = normalizeArticleLocaleManifest({
    schemaVersion: '1.0.0',
    locale: 'en-US',
    generatedAt: '2026-06-17T00:00:00.000Z',
    articles: [
      {
        slug: 'claude-vs-hagicode',
        category: 'vs-hagicode',
        path: '/articles/en-US/claude-vs-hagicode.json',
        updatedAt: '2026-06-17T00:00:00.000Z',
        title: 'Claude Vs HagiCode',
        summary: 'Summary',
      },
    ],
  }, 'en-US', 'fixture');

  const detail = normalizeArticleDetail({
    schemaVersion: '1.0.0',
    slug: 'claude-vs-hagicode',
    category: 'vs-hagicode',
    locale: 'en-US',
    updatedAt: '2026-06-17T00:00:00.000Z',
    seo: {
      title: 'Claude Vs HagiCode',
      description: 'Description',
    },
    summary: 'Summary',
    sections: [
      {
        id: 'intro',
        title: 'Intro',
        blocks: [
          {
            id: 'intro-copy',
            type: 'rich-text',
            content: ['Paragraph'],
          },
        ],
      },
    ],
  }, 'en-US', 'claude-vs-hagicode', 'fixture');

  assert.equal(localeManifest.articles[0].path, '/articles/en-US/claude-vs-hagicode.json');
  assert.equal(detail.locale, 'en-US');
});

test('fetchArticlesSnapshot writes root, locale manifests, and article details', async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-articles-snapshot-'));
  const requested = [];

  await fetchArticlesSnapshot({
    outputRoot,
    origin: 'https://index.example.test',
    localPublishedRoot: null,
    allowRemote: true,
    fetchImpl: async (url) => {
      const requestUrl = url.toString();
      requested.push(requestUrl);
      const pathname = new URL(requestUrl).pathname;

      const payloads = {
        '/articles/index.json': {
          schemaVersion: '1.0.0',
          generatedAt: '2026-06-17T00:00:00.000Z',
          localeIndexes: [
            { locale: 'en-US', path: '/articles/en-US/index.json', updatedAt: '2026-06-17T00:00:00.000Z' },
            { locale: 'zh-CN', path: '/articles/zh-CN/index.json', updatedAt: '2026-06-17T00:00:00.000Z' },
          ],
        },
        '/articles/en-US/index.json': {
          schemaVersion: '1.0.0',
          locale: 'en-US',
          generatedAt: '2026-06-17T00:00:00.000Z',
          articles: [
            {
              slug: 'claude-vs-hagicode',
              category: 'vs-hagicode',
              path: '/articles/en-US/claude-vs-hagicode.json',
              updatedAt: '2026-06-17T00:00:00.000Z',
              title: 'Claude Vs HagiCode',
              summary: 'English summary',
            },
          ],
        },
        '/articles/zh-CN/index.json': {
          schemaVersion: '1.0.0',
          locale: 'zh-CN',
          generatedAt: '2026-06-17T00:00:00.000Z',
          articles: [
            {
              slug: 'codex-vs-hagicode',
              category: 'vs-hagicode',
              path: '/articles/zh-CN/codex-vs-hagicode.json',
              updatedAt: '2026-06-17T00:00:00.000Z',
              title: 'Codex Vs HagiCode',
              summary: 'Chinese summary',
            },
          ],
        },
        '/articles/en-US/claude-vs-hagicode.json': {
          schemaVersion: '1.0.0',
          slug: 'claude-vs-hagicode',
          category: 'vs-hagicode',
          locale: 'en-US',
          updatedAt: '2026-06-17T00:00:00.000Z',
          seo: { title: 'Claude Vs HagiCode', description: 'Description' },
          summary: 'English summary',
          sections: [{ id: 'intro', title: 'Intro', blocks: [{ id: 'copy', type: 'rich-text', content: ['Paragraph'] }] }],
        },
        '/articles/zh-CN/codex-vs-hagicode.json': {
          schemaVersion: '1.0.0',
          slug: 'codex-vs-hagicode',
          category: 'vs-hagicode',
          locale: 'zh-CN',
          updatedAt: '2026-06-17T00:00:00.000Z',
          seo: { title: 'Codex Vs HagiCode', description: 'Description' },
          summary: 'Chinese summary',
          sections: [{ id: 'intro', title: 'Intro', blocks: [{ id: 'copy', type: 'rich-text', content: ['Paragraph'] }] }],
        },
      };

      return {
        ok: true,
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null;
          },
        },
        async json() {
          return payloads[pathname];
        },
      };
    },
  });

  const rootManifest = JSON.parse(await readFile(path.join(outputRoot, 'index.json'), 'utf8'));
  const englishDetail = JSON.parse(await readFile(path.join(outputRoot, 'en-US', 'claude-vs-hagicode.json'), 'utf8'));
  const chineseManifest = JSON.parse(await readFile(path.join(outputRoot, 'zh-CN', 'index.json'), 'utf8'));

  assert.equal(requested[0], 'https://index.example.test/articles/index.json');
  assert.equal(rootManifest.localeIndexes.length, 2);
  assert.equal(chineseManifest.articles[0].slug, 'codex-vs-hagicode');
  assert.equal(englishDetail.locale, 'en-US');
});

test('fetchArticlesSnapshot defaults to the published remote origin when no local override is configured', async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-articles-snapshot-default-remote-'));
  const requested = [];

  await fetchArticlesSnapshot({
    outputRoot,
    origin: 'https://index.example.test',
    fetchImpl: async (url) => {
      const requestUrl = url.toString();
      requested.push(requestUrl);
      const pathname = new URL(requestUrl).pathname;

      const payloads = {
        '/articles/index.json': {
          schemaVersion: '1.0.0',
          generatedAt: '2026-06-17T00:00:00.000Z',
          localeIndexes: [
            { locale: 'en-US', path: '/articles/en-US/index.json', updatedAt: '2026-06-17T00:00:00.000Z' },
          ],
        },
        '/articles/en-US/index.json': {
          schemaVersion: '1.0.0',
          locale: 'en-US',
          generatedAt: '2026-06-17T00:00:00.000Z',
          articles: [
            {
              slug: 'claude-vs-hagicode',
              category: 'vs-hagicode',
              path: '/articles/en-US/claude-vs-hagicode.json',
              updatedAt: '2026-06-17T00:00:00.000Z',
              title: 'Claude Vs HagiCode',
              summary: 'English summary',
            },
          ],
        },
        '/articles/en-US/claude-vs-hagicode.json': {
          schemaVersion: '1.0.0',
          slug: 'claude-vs-hagicode',
          category: 'vs-hagicode',
          locale: 'en-US',
          updatedAt: '2026-06-17T00:00:00.000Z',
          seo: { title: 'Claude Vs HagiCode', description: 'Description' },
          summary: 'English summary',
          sections: [{ id: 'intro', title: 'Intro', blocks: [{ id: 'copy', type: 'rich-text', content: ['Paragraph'] }] }],
        },
      };

      return {
        ok: true,
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null;
          },
        },
        async json() {
          return payloads[pathname];
        },
      };
    },
  });

  assert.deepEqual(requested, [
    'https://index.example.test/articles/index.json',
    'https://index.example.test/articles/en-US/index.json',
    'https://index.example.test/articles/en-US/claude-vs-hagicode.json',
  ]);
});

test('fetchArticlesSnapshot reports actionable diagnostics for slug mismatches', async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-articles-snapshot-error-'));

  await assert.rejects(
    () => fetchArticlesSnapshot({
      outputRoot,
      origin: 'https://index.example.test',
      localPublishedRoot: null,
      allowRemote: true,
      fetchImpl: async (url) => {
        const pathname = new URL(url.toString()).pathname;
        const payloads = {
          '/articles/index.json': {
            schemaVersion: '1.0.0',
            generatedAt: '2026-06-17T00:00:00.000Z',
            localeIndexes: [{ locale: 'en-US', path: '/articles/en-US/index.json', updatedAt: '2026-06-17T00:00:00.000Z' }],
          },
          '/articles/en-US/index.json': {
            schemaVersion: '1.0.0',
            locale: 'en-US',
            generatedAt: '2026-06-17T00:00:00.000Z',
            articles: [{
              slug: 'claude-vs-hagicode',
              category: 'vs-hagicode',
              path: '/articles/en-US/claude-vs-hagicode.json',
              updatedAt: '2026-06-17T00:00:00.000Z',
              title: 'Claude Vs HagiCode',
              summary: 'Summary',
            }],
          },
          '/articles/en-US/claude-vs-hagicode.json': {
            schemaVersion: '1.0.0',
            slug: 'wrong-slug',
            category: 'vs-hagicode',
            locale: 'en-US',
            updatedAt: '2026-06-17T00:00:00.000Z',
            seo: { title: 'Claude Vs HagiCode', description: 'Description' },
            summary: 'Summary',
            sections: [{ id: 'intro', title: 'Intro', blocks: [{ id: 'copy', type: 'rich-text', content: ['Paragraph'] }] }],
          },
        };

        return {
          ok: true,
          headers: {
            get(name) {
              return name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null;
            },
          },
          async json() {
            return payloads[pathname];
          },
        };
      },
    }),
    /expected slug claude-vs-hagicode but received wrong-slug/,
  );
});
