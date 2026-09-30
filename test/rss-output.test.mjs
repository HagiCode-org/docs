import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const dist = path.resolve(import.meta.dirname, '../dist');
const built = fs.existsSync(path.join(dist, 'rss.xml'));
const read = (file) => fs.readFileSync(path.join(dist, file), 'utf8');
const itemBlocks = (xml) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map(([, item]) => item);
const itemLinks = (xml) => itemBlocks(xml).map((item) => item.match(/<link>([^<]+)<\/link>/u)?.[1] ?? '');
const BLOG_LOCALES = ['zh-CN', 'zh-Hant', 'en-US', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];

test('Starlight owns localized feeds and publishes the root feed link on localized pages', { skip: !built }, () => {
  const english = read('rss.xml');
  const englishAlias = read('rss.en.xml');
  const chinese = read('rss.zh-CN.xml');
  const englishHome = read('en-US/product-overview/index.html');
  const chineseHome = read('product-overview/index.html');

  assert.match(english, /<language>en-US<\/language>/u);
  assert.match(chinese, /<language>zh-CN<\/language>/u);
  assert.ok(itemLinks(english).length > 0);
  assert.ok(itemLinks(english).every((link) => new URL(link).pathname.startsWith('/en-US/')));
  assert.deepEqual(itemLinks(englishAlias), itemLinks(english));
  assert.match(englishHome, /href="https:\/\/docs\.hagicode\.com\/rss\.xml"/u);
  assert.match(chineseHome, /href="https:\/\/docs\.hagicode\.com\/rss\.xml"/u);
});

test('blog-only feeds retain language scope, aliases, cap, and channel language', { skip: !built }, () => {
  const all = read('blog/rss.xml');
  const allItems = itemBlocks(all);
  const allLinks = itemLinks(all);
  const allLanguages = new Set(allLinks.map((link) => {
    const firstSegment = new URL(link).pathname.split('/').filter(Boolean)[0];
    return BLOG_LOCALES.includes(firstSegment) ? firstSegment : 'zh-CN';
  }));

  assert.match(all, /<language>und<\/language>/u);
  assert.ok(allItems.length > 0 && allItems.length <= 20);
  assert.ok(allLanguages.size > 1);
  assert.ok(allItems.every((item) => !item.includes('<language>')));

  for (const locale of BLOG_LOCALES) {
    const filename = locale === 'en-US' ? 'en-US' : locale;
    const xml = read(`blog/rss.${filename}.xml`);
    const links = itemLinks(xml);
    assert.match(xml, new RegExp(`<language>${locale}</language>`, 'u'));
    assert.ok(itemBlocks(xml).length <= 20);
    const prefix = locale === 'zh-CN' ? '/blog/' : `/${locale}/blog/`;
    assert.ok(links.every((link) => new URL(link).pathname.startsWith(prefix)), `${locale} feed scope`);
    assert.ok(itemBlocks(xml).every((item) => !item.includes('<language>')));
  }

  assert.deepEqual(itemLinks(read('blog/rss.en.xml')), itemLinks(read('blog/rss.en-US.xml')));
});
