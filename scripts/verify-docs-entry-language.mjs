import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOCS_LOCALE_SELECTOR_OPTIONS } from '../src/i18n/generated/docs-locale-resources.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(scriptDir, '..');
const distDir = path.join(docsDir, 'dist');

async function readDistFile(relativePath) {
  return readFile(path.join(distDir, relativePath), 'utf8');
}

function readScriptContents(scriptPath) {
  return readFileSync(path.join(distDir, scriptPath.replace(/^\//u, '')), 'utf8');
}

function assertIncludes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message + ` (missing: ${needle})`);
}

async function main() {
  const [rootHtml, enHtml] = await Promise.all([
    readDistFile('index.html'),
    readDistFile(path.join('en-US', 'index.html')),
  ]);
  assertIncludes(rootHtml, 'data-hagilight-transit', 'root landing should be the Hagilight root transit');
  assertIncludes(rootHtml, '<link rel="canonical" href="https://docs.hagicode.com/en-US/product-overview/"', 'root landing should point at the English product overview');
  assertIncludes(rootHtml, 'name="robots" content="noindex,follow"', 'root landing should stay out of the index');
  assertIncludes(rootHtml, 'href="/product-overview/"', 'root landing should list the Chinese product overview');
  assert.ok(!rootHtml.includes('http-equiv="refresh"'), 'root landing should not use a meta refresh');
  assert.ok(!rootHtml.includes('__HAGICODE_DOCS_ENTRY__'), 'root landing should not load the retired entry route resolver');

  assertIncludes(enHtml, '<html lang="en-US"', 'English landing should expose English metadata');
  assertIncludes(enHtml, 'http-equiv="refresh"', 'English landing should expose a non-JS redirect fallback');
  assertIncludes(enHtml, '0;url=/en-US/product-overview/', 'English landing should point directly to the product overview route');

  const localizedEntryLocales = DOCS_LOCALE_SELECTOR_OPTIONS
    .filter((locale) => locale.code !== 'root' && locale.code !== 'en-US');
  const localizedEntryPages = await Promise.all(
    localizedEntryLocales.map(async (locale) => ({
      locale: locale.code,
      htmlLang: locale.htmlLang,
      html: await readDistFile(path.join(locale.code, 'index.html')),
    })),
  );

  for (const { locale, htmlLang, html } of localizedEntryPages) {
    assertIncludes(
      html,
      `<html lang="${htmlLang}"`,
      `${locale} landing should expose locale metadata`,
    );
    assertIncludes(
      html,
      `0;url=/${locale}/product-overview/`,
      `${locale} landing should point to its localized product overview`,
    );
    assertIncludes(
      html,
      'window.location.replace(targetUrl.toString())',
      `${locale} landing should preserve query and hash state when redirecting`,
    );
  }

  const [rootDocsHtml, rootBlogHtml, enDocsHtml, enBlogHtml] = await Promise.all([
    readDistFile(path.join('product-overview', 'index.html')),
    readDistFile(path.join('blog', 'index.html')),
    readDistFile(path.join('en-US', 'product-overview', 'index.html')),
    readDistFile(path.join('en-US', 'blog', 'index.html')),
  ]);

  for (const [html, label] of [
    [rootDocsHtml, 'root docs'],
    [rootBlogHtml, 'root blog'],
    [enDocsHtml, 'English docs'],
    [enBlogHtml, 'English blog'],
  ]) {
    const scripts = [...html.matchAll(/<script[^>]+src="(\/[^"]+\.js)"[^>]*><\/script>/giu)];
    assert.ok(
      scripts.every(([, src]) => !readScriptContents(src).includes('__HAGICODE_DOCS_ENTRY__')),
      `${label} pages should use the default Starlight head without the entry route resolver`,
    );
  }
}

main().catch((error) => {
  console.error('Docs entry language verification failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
