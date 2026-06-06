import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildTipsRoute,
  fetchTipsSnapshot,
  normalizeTipsPayload,
} from '../scripts/fetch-tips-snapshot.mjs';
import {
  getManagedTipsArticle,
  resolveTipsLocale,
} from '../src/lib/tips.mjs';

test('normalizeTipsPayload rejects duplicate tip ids', () => {
  assert.throws(
    () => normalizeTipsPayload({
      schemaVersion: '1.0.0',
      locale: 'en-US',
      updatedAt: '2026-06-01',
      tips: [
        { id: 'same', text: 'First', category: 'project' },
        { id: 'same', text: 'Second', category: 'project' },
      ],
    }, 'en-US', 'fixture'),
    /duplicate tip id same/,
  );
});

test('fetchTipsSnapshot writes one validated payload per supported locale', async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-tips-snapshot-'));
  const outputPath = path.join(outputRoot, 'tips.snapshot.json');
  const requested = [];

  await fetchTipsSnapshot({
    outputPath,
    origin: 'https://index.example.test',
    fetchImpl: async (url) => {
      const requestUrl = url.toString();
      requested.push(requestUrl);
      const locale = requestUrl.match(/tips-(.+)\.json/u)?.[1] ?? 'en-US';

      return {
        ok: true,
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null;
          },
        },
        async json() {
          return {
            schemaVersion: '1.0.0',
            locale,
            updatedAt: '2026-06-01',
            tips: [
              {
                id: `${locale}-tip`,
                text: `Tip for ${locale}`,
                category: 'project',
              },
            ],
          };
        },
      };
    },
  });

  const snapshot = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(requested[0], 'https://index.example.test/tips-zh-CN.json');
  assert.equal(requested.at(-1), 'https://index.example.test/tips-ru-RU.json');
  assert.equal(snapshot.locales['en-US'].tips[0].id, 'en-US-tip');
  assert.equal(snapshot.source.locales['zh-Hant'], 'https://index.example.test/tips-zh-Hant.json');
});

test('tips article resolves route locale aliases and keeps grouped content available', () => {
  assert.equal(resolveTipsLocale('root'), 'zh-CN');
  assert.equal(resolveTipsLocale('en'), 'en-US');

  const article = getManagedTipsArticle('en-US');
  assert.ok(article.totalTips > 0);
  assert.ok(article.groups.length > 0);
  assert.equal(article.groups[0].tips.length > 0, true);
});

test('buildTipsRoute keeps published Index naming', () => {
  assert.equal(buildTipsRoute('pt-BR'), '/tips-pt-BR.json');
});
