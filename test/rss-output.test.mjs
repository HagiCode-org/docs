import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const siteUrl = 'https://docs.hagicode.com/';
const locales = ['en-US', 'zh-CN', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];

function assertFeed(xml, language) {
  assert.match(xml, /^<\?xml/u);
  const channel = xml.match(/<channel>([\s\S]*?)<\/channel>/u)?.[1];
  assert.ok(channel, 'RSS feed has a channel');
  assert.match(channel, /<title>[^<]+<\/title>/u);
  assert.match(channel, /<description>[^<]+<\/description>/u);
  assert.match(channel, new RegExp(`<language>${language}</language>`, 'u'));
  assert.ok(channel.includes(`<link>${siteUrl}</link>`));
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map(([, item]) => {
    const link = item.match(/<link>([^<]+)<\/link>/u)?.[1];
    assert.ok(link && /^https?:\/\//u.test(link), 'RSS item links are absolute HTTP(S) URLs');
    return link;
  });
}

test('Hagilight and Starlight Blog publish default, alias, locale, and blog feeds', async () => {
  const [docsFeed, englishAlias, config] = await Promise.all([
    fs.promises.readFile(path.join(dist, 'rss.xml'), 'utf8'),
    fs.promises.readFile(path.join(dist, 'rss.en.xml'), 'utf8'),
    fs.promises.readFile(path.join(root, 'astro.config.mjs'), 'utf8'),
  ]);

  const englishLinks = assertFeed(docsFeed, 'en-US');
  assert.deepEqual(assertFeed(englishAlias, 'en-US'), englishLinks);
  assert.equal(docsFeed, englishAlias);
  assert.match(config, /starlightBlog\(\s*\{/u);
  assert.doesNotMatch(config, /rss:\s*\{|hagilightRss|rss-feed/u);
  assert.equal(fs.existsSync(path.join(root, 'src/lib/blog-rss.ts')), false);

  for (const locale of locales) {
    const filename = locale === 'en-US' ? 'en' : locale;
    const xml = await fs.promises.readFile(path.join(dist, `rss.${filename}.xml`), 'utf8');
    const links = assertFeed(xml, locale);
    const localePaths = locales
      .filter((value) => value !== 'zh-CN')
      .map((value) => `/${value}/`);
    if (locale === 'zh-CN') {
      assert.ok(links.every((link) => !localePaths.some((localePath) => new URL(link).pathname.startsWith(localePath))), `${filename} contains cross-locale content`);
    } else {
      assert.ok(links.every((link) => new URL(link).pathname.startsWith(`/${locale}/`)), `${filename} contains cross-locale content`);
    }
  }

  for (const locale of locales.filter((value) => value !== 'zh-CN')) {
    const route = locale === 'en-US' ? 'en-US/blog/rss.xml' : `${locale}/blog/rss.xml`;
    const links = assertFeed(await fs.promises.readFile(path.join(dist, route), 'utf8'), locale);
    assert.ok(links.every((link) => new URL(link).pathname.includes('/blog/')), `${route} contains non-blog items`);
  }
  const rootBlogLinks = assertFeed(await fs.promises.readFile(path.join(dist, 'blog/rss.xml'), 'utf8'), 'zh-CN');
  assert.ok(rootBlogLinks.every((link) => new URL(link).pathname.includes('/blog/')));
});
