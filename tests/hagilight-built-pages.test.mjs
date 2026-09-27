import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

function readRoute(route) {
  return readFileSync(path.join(distDir, route), 'utf8');
}

function countMatches(value, expression) {
  return [...value.matchAll(expression)].length;
}

function hasLinkText(html, href, label) {
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const links = new RegExp(
    `<a\\b(?=[^>]*\\bhref=["']${escapeRegExp(href)}["'])[^>]*>([\\s\\S]*?)<\\/a>`,
    'gi',
  );
  return [...html.matchAll(links)].some((match) => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() === label);
}

function assertSharedShell(html, fallbackId) {
  assert.equal(countMatches(html, /<hagilight-promoto-banner\b/g), 1);
  assert.equal(countMatches(html, /data-promoto-dismiss\b/g), 1);
  assert.match(html, new RegExp(`data-fallback="[^"]*${fallbackId}`));
  assert.equal(countMatches(html, /<hagilight-language-chooser\b/g), 1);
  assert.equal(countMatches(html, /class="[^"]*\bhagilight-site-links\b/g), 1);
  assert.ok(countMatches(html, /googletagmanager\.com\/gtag\/js/g) <= 1);
  assert.ok(countMatches(html, /sdk\.51\.la\/js-sdk-pro\.min\.js/g) <= 1);
  assert.ok(countMatches(html, /clarity\.ms\/tag/g) <= 1);
}

test('root and localized blog navigation use the Hagilight header links', () => {
  const chineseBlog = readRoute('blog/index.html');
  const englishBlog = readRoute('en-US/blog/index.html');

  assert.ok(hasLinkText(chineseBlog, '/blog/', '博客'));
  assert.ok(hasLinkText(englishBlog, '/en-US/blog/', 'Blog'));
  assertSharedShell(chineseBlog, 'docs-product-overview-fallback-zh');
  assertSharedShell(englishBlog, 'docs-product-overview-fallback-en');
});

test('docs and translated docs retain shared width, disclosures, and article promotion', () => {
  const chineseDocs = readRoute('product-overview/index.html');
  const englishDocs = readRoute('en-US/product-overview/index.html');

  for (const html of [chineseDocs, englishDocs]) {
    assert.equal(countMatches(html, /data-hagilight-content-width-choice=/g), 2);
    assert.match(html, /hagilight-content-width/);
    assert.match(html, /hagicode-docs-content-layout/);
    assert.match(html, /class="[^"]*\bhagilight-article-promotion\b/);
    assert.match(html, /class="[^"]*\bhagilight-ai-disclosure\b/);
  }

  assertSharedShell(chineseDocs, 'docs-product-overview-fallback-zh');
  assertSharedShell(englishDocs, 'docs-product-overview-fallback-en');
});

test('blog, release-notes, and 404 pages keep one shared shell and their local content', () => {
  const blogPost = readRoute('blog/2026-01-22-github-issues-集成/index.html');
  const releaseNotes = readRoute('release-notes/index.html');
  const notFound = readRoute('404.html');

  assert.match(blogPost, /blog-header-promo-container/);
  assert.match(blogPost, /blog-footer-promo/);
  assert.match(blogPost, /class="[^"]*\bblog-cta\b/);
  assert.doesNotMatch(blogPost, /class="[^"]*\bhagilight-article-promotion\b/);
  assert.match(releaseNotes, /release-notes-toc-list/);
  assert.match(notFound, /not-found-hero/);
  assert.match(notFound, /recovery-action/);

  assertSharedShell(blogPost, 'docs-product-overview-fallback-zh');
  assertSharedShell(releaseNotes, 'docs-product-overview-fallback-zh');
  assertSharedShell(notFound, 'docs-product-overview-fallback-zh');
});

test('standalone locale redirects preserve targets and inject analytics at most once', () => {
  const rootRedirect = readRoute('index.html');
  const englishRedirect = readRoute('en-US/index.html');
  const standaloneGo = readRoute('go/index.html');

  assert.match(rootRedirect, /\/product-overview\//);
  assert.match(englishRedirect, /\/en-US\/product-overview\//);
  assert.equal(countMatches(rootRedirect, /googletagmanager\.com\/gtag\/js/g), 1);
  assert.equal(countMatches(englishRedirect, /googletagmanager\.com\/gtag\/js/g), 1);
  assert.ok(countMatches(standaloneGo, /googletagmanager\.com\/gtag\/js/g) <= 1);
});
