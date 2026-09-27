import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/content');
const locales = ['zh-CN', 'en-US', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];

for (const [project, articlePath, sidebarPosition] of [
  ['OpenSpec', 'related-software-installation/openspec/intro-openspec.mdx', 10],
  ['OmniRoute', 'related-software-installation/omniroute/index.mdx', 12],
]) {
  test(`${project} entry uses a Starlight link card to the matching language site`, async () => {
    for (const locale of locales) {
      const filePath = locale === 'zh-CN'
        ? path.join(docsRoot, 'docs', articlePath)
        : path.join(docsRoot, 'translations/docs', locale, articlePath);
      const source = await readFile(filePath, 'utf8');
      const cards = [...source.matchAll(/<LinkCard\b[^>]*href="https:\/\/([^"/]+)\/([^"/]+)\/"[^>]*>/gu)];

      assert.match(source, /import \{ LinkCard \} from '@astrojs\/starlight\/components';/u, filePath);
      assert.deepEqual(cards.map((match) => [match[1], match[2]]), [[`${project.toLowerCase()}.hagicode.com`, locale]], filePath);
      assert.match(source, new RegExp(`^sidebar_position: ${sidebarPosition}$`, 'mu'), filePath);
    }
  });
}
