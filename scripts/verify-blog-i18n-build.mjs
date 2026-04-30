import fs from 'node:fs';
import path from 'node:path';

import { REQUIRED_BLOG_LOCALES, validateBlogI18nCompleteness } from './verify-blog-i18n-completeness.mjs';
import './verify-blog-sidebar-i18n.mjs';

const distDir = path.resolve(process.cwd(), 'dist');

function readBuildFile(relativePath) {
  const fullPath = path.join(distDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing build artifact: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, 'utf8');
}

function getBlogIndexPath(locale) {
  return locale.routeLocale === 'root'
    ? 'blog/index.html'
    : path.join(locale.routeLocale, 'blog/index.html');
}

function assertIncludes(html, expected, route) {
  if (!html.includes(expected)) {
    throw new Error(`${route} is missing expected blog i18n output: ${expected}`);
  }
}

function assertExcludes(html, unexpected, route) {
  if (html.includes(unexpected)) {
    throw new Error(`${route} still renders deprecated blog i18n output: ${unexpected}`);
  }
}

function verifyRenderedBlogI18nControls() {
  for (const locale of REQUIRED_BLOG_LOCALES) {
    const route = getBlogIndexPath(locale);
    const html = readBuildFile(route);

    assertExcludes(html, '/blog/rss.xml', route);
    assertIncludes(html, '/blog/rss.zh-CN.xml', route);
    assertIncludes(html, '/blog/rss.en.xml', route);
    assertIncludes(html, '/blog/rss.ja-JP.xml', route);
    assertIncludes(html, '/blog/rss.ru-RU.xml', route);
    assertIncludes(html, `aria-current=\"page\"`, route);
  }
}

const completeness = await validateBlogI18nCompleteness();
if (!completeness.ok) {
  for (const diagnostic of completeness.diagnostics) {
    console.error(`- [${diagnostic.code}] ${diagnostic.message}`);
  }
  throw new Error(`Blog i18n completeness failed with ${completeness.diagnostics.length} diagnostics.`);
}

verifyRenderedBlogI18nControls();
console.log(`Verified blog i18n build output for ${REQUIRED_BLOG_LOCALES.length} desktop languages.`);
