import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/content');
const articlePath = 'related-software-installation/openspec/intro-openspec.mdx';
const locales = ['zh-CN', 'en-US', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];

test('OpenSpec introduction links to the matching language entry page', async () => {
  for (const locale of locales) {
    const filePath = locale === 'zh-CN'
      ? path.join(docsRoot, 'docs', articlePath)
      : path.join(docsRoot, 'translations/docs', locale, articlePath);
    const source = await readFile(filePath, 'utf8');
    const links = [...source.matchAll(/\]\(https:\/\/openspec\.hagicode\.com\/([^/]+)\/\)/gu)];

    assert.deepEqual(links.map((match) => match[1]), [locale], filePath);
    assert.match(source, /^sidebar_position: 10$/mu, filePath);
  }
});
