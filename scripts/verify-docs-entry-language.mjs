import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DOCS_LOCALE_SELECTOR_OPTIONS } from '../src/i18n/generated/docs-locale-resources.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(scriptDir, '..');
const distDir = path.join(docsDir, 'dist');

async function readDistFile(relativePath) {
  return readFile(path.join(distDir, relativePath), 'utf8');
}

function extractRedirectScriptReference(html) {
  const scriptPaths = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/giu)]
    .map((match) => match[1]);

  for (const scriptPath of scriptPaths) {
    if (!scriptPath.startsWith('/')) continue;
    if (scriptPath.includes('lang-redirect')) {
      return { entryScriptPath: scriptPath, resolverScriptPath: scriptPath };
    }

    const script = readScriptContents(scriptPath);
    const importedResolver = script.match(/from["']([^"']*lang-redirect[^"']*\.js)["']/iu);
    if (importedResolver) {
      return {
        entryScriptPath: scriptPath,
        resolverScriptPath: new URL(
          importedResolver[1],
          `https://docs.hagicode.com${scriptPath}`,
        ).pathname,
      };
    }
  }

  assert.fail('built HTML should reference a hashed language-resolver module');
}

function readScriptContents(scriptPath) {
  return readFileSync(path.join(distDir, scriptPath.replace(/^\//u, '')), 'utf8');
}

function assertIncludes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message + ` (missing: ${needle})`);
}

function createLocalStorage(initialValue) {
  const store = new Map();
  if (initialValue !== undefined && initialValue !== null) {
    store.set('starlight-route', initialValue);
  }

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    dump() {
      return Object.fromEntries(store.entries());
    },
  };
}

function createMockDocument(landingTargetPath = null) {
  return {
    querySelector(selector) {
      if (
        selector === 'meta[name="hagicode-docs-landing-target"]' &&
        landingTargetPath
      ) {
        return {
          getAttribute(name) {
            return name === 'content' ? landingTargetPath : null;
          },
        };
      }

      return null;
    },
  };
}

function createMockWindow(
  href,
  storedRouteValue,
  navigatorConfig = {},
  landingTargetPath = null,
) {
  let currentUrl = new URL(href);
  const redirects = [];
  const localStorage = createLocalStorage(storedRouteValue);
  const document = createMockDocument(landingTargetPath);

  const location = {
    get href() {
      return currentUrl.toString();
    },
    set href(value) {
      currentUrl = new URL(value, currentUrl);
      redirects.push(currentUrl.toString());
    },
    get pathname() {
      return currentUrl.pathname;
    },
    get search() {
      return currentUrl.search;
    },
    get hash() {
      return currentUrl.hash;
    },
    get origin() {
      return currentUrl.origin;
    },
    replace(value) {
      currentUrl = new URL(value, currentUrl);
      redirects.push(currentUrl.toString());
    },
  };

  return {
    window: {
      location,
      localStorage,
      document,
      navigator: {
        language: navigatorConfig.language ?? 'en-US',
        languages: navigatorConfig.languages ?? [navigatorConfig.language ?? 'en-US'],
      },
    },
    redirects,
    localStorage,
    getCurrentUrl() {
      return currentUrl.toString();
    },
  };
}

async function loadResolverApi(entryScriptPath) {
  const mock = createMockWindow('https://docs.hagicode.com/', null);
  const entryUrl = pathToFileURL(
    path.join(distDir, entryScriptPath.replace(/^\//u, '')),
  );
  const previousWindow = globalThis.window;
  globalThis.window = mock.window;

  try {
    await import(entryUrl.href);
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }

  assert.ok(mock.window.__HAGICODE_DOCS_ENTRY__, 'built resolver should expose its API');
  return mock.window.__HAGICODE_DOCS_ENTRY__;
}

function evaluateEntryScript(
  resolverApi,
  href,
  storedRouteValue = null,
  navigatorConfig = {},
  landingTargetPath = null,
) {
  const mock = createMockWindow(
    href,
    storedRouteValue,
    navigatorConfig,
    landingTargetPath,
  );
  const lastResolution = resolverApi.applyEntryRouting(mock.window);

  return {
    api: { lastResolution },
    redirects: mock.redirects,
    localStorage: mock.localStorage.dump(),
    finalUrl: mock.getCurrentUrl(),
  };
}

function verifyScenario(resolverApi, scenario) {
  const result = evaluateEntryScript(
    resolverApi,
    scenario.href,
    scenario.storedRouteValue,
    scenario.navigator,
    scenario.landingTargetPath,
  );

  assert.equal(result.api.lastResolution.resolvedLocale, scenario.expectedLocale, `${scenario.name}: resolved locale`);
  assert.equal(result.api.lastResolution.targetUrl, scenario.expectedTargetUrl, `${scenario.name}: target url`);
  assert.equal(result.finalUrl, scenario.expectedFinalUrl, `${scenario.name}: final url`);
  assert.equal(result.api.lastResolution.shouldRedirect, scenario.expectRedirect, `${scenario.name}: redirect flag`);

  if (scenario.expectedStoredLang) {
    const stored = JSON.parse(result.localStorage['starlight-route']);
    assert.equal(stored.lang, scenario.expectedStoredLang, `${scenario.name}: stored lang`);
  }

  if (scenario.expectedStoredLang === null) {
    assert.equal(result.localStorage['starlight-route'], undefined, `${scenario.name}: should not persist lang`);
  }
}

async function main() {
  const [rootHtml, enHtml] = await Promise.all([
    readDistFile('index.html'),
    readDistFile(path.join('en-US', 'index.html')),
  ]);
  const redirectReference = extractRedirectScriptReference(rootHtml);
  const redirectScriptPath = redirectReference.resolverScriptPath;
  await readDistFile(redirectScriptPath.replace(/^\//u, ''));
  const resolverApi = await loadResolverApi(redirectReference.entryScriptPath);

  assertIncludes(rootHtml, 'name="hagicode-docs-default-entry" content="en-US"', 'root landing should advertise the English default entry');
  assertIncludes(rootHtml, '<html lang="zh-CN"', 'root landing should keep Chinese metadata');
  assertIncludes(rootHtml, 'name="hagicode-docs-landing-target" content="/product-overview/"', 'root landing should point directly to the product overview route');
  assertIncludes(rootHtml, 'http-equiv="refresh"', 'root landing should expose a non-JS redirect fallback');
  assert.equal(
    extractRedirectScriptReference(rootHtml).resolverScriptPath,
    redirectScriptPath,
    'root landing should load the entry route resolver',
  );

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
    assert.equal(
      extractRedirectScriptReference(html).resolverScriptPath,
      redirectScriptPath,
      `${label} pages should load the shared route resolver`,
    );
  }

  const scenarios = [
    {
      name: 'first-time English browser redirects to English product overview',
      href: 'https://docs.hagicode.com/',
      storedRouteValue: null,
      navigator: {
        language: 'en-US',
        languages: ['en-US', 'en'],
      },
      landingTargetPath: '/product-overview/',
      expectedLocale: 'en-US',
      expectedTargetUrl: 'https://docs.hagicode.com/en-US/product-overview/',
      expectedFinalUrl: 'https://docs.hagicode.com/en-US/product-overview/',
      expectRedirect: true,
      expectedStoredLang: 'en-US',
    },
    {
      name: 'first-time Chinese browser redirects to Chinese product overview',
      href: 'https://docs.hagicode.com/',
      storedRouteValue: null,
      navigator: {
        language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
      },
      landingTargetPath: '/product-overview/',
      expectedLocale: 'root',
      expectedTargetUrl: 'https://docs.hagicode.com/product-overview/',
      expectedFinalUrl: 'https://docs.hagicode.com/product-overview/',
      expectRedirect: true,
      expectedStoredLang: 'root',
    },
    {
      name: 'explicit Chinese override on root',
      href: 'https://docs.hagicode.com/?lang=zh-CN',
      storedRouteValue: null,
      navigator: {
        language: 'en-US',
        languages: ['en-US', 'en'],
      },
      landingTargetPath: '/product-overview/',
      expectedLocale: 'root',
      expectedTargetUrl: 'https://docs.hagicode.com/product-overview/',
      expectedFinalUrl: 'https://docs.hagicode.com/product-overview/',
      expectRedirect: true,
      expectedStoredLang: 'root',
    },
    {
      name: 'invalid language falls back to browser language product overview',
      href: 'https://docs.hagicode.com/?lang=it',
      storedRouteValue: null,
      navigator: {
        language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
      },
      landingTargetPath: '/product-overview/',
      expectedLocale: 'root',
      expectedTargetUrl: 'https://docs.hagicode.com/product-overview/',
      expectedFinalUrl: 'https://docs.hagicode.com/product-overview/',
      expectRedirect: true,
      expectedStoredLang: null,
    },
    {
      name: 'stored Chinese preference keeps root redirect in Chinese',
      href: 'https://docs.hagicode.com/',
      storedRouteValue: JSON.stringify({ lang: 'root' }),
      navigator: {
        language: 'en-US',
        languages: ['en-US', 'en'],
      },
      landingTargetPath: '/product-overview/',
      expectedLocale: 'root',
      expectedTargetUrl: 'https://docs.hagicode.com/product-overview/',
      expectedFinalUrl: 'https://docs.hagicode.com/product-overview/',
      expectRedirect: true,
      expectedStoredLang: 'root',
    },
    {
      name: 'root docs path follows Chinese browser language for first-time visitors',
      href: 'https://docs.hagicode.com/product-overview/',
      storedRouteValue: null,
      navigator: {
        language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
      },
      expectedLocale: 'root',
      expectedTargetUrl: 'https://docs.hagicode.com/product-overview/',
      expectedFinalUrl: 'https://docs.hagicode.com/product-overview/',
      expectRedirect: false,
      expectedStoredLang: 'root',
    },
    {
      name: 'stored Chinese preference keeps root docs path in Chinese',
      href: 'https://docs.hagicode.com/product-overview/',
      storedRouteValue: JSON.stringify({ lang: 'root' }),
      navigator: {
        language: 'en-US',
        languages: ['en-US', 'en'],
      },
      expectedLocale: 'root',
      expectedTargetUrl: 'https://docs.hagicode.com/product-overview/',
      expectedFinalUrl: 'https://docs.hagicode.com/product-overview/',
      expectRedirect: false,
      expectedStoredLang: 'root',
    },
    {
      name: 'root blog path follows Chinese browser language for first-time visitors',
      href: 'https://docs.hagicode.com/blog/',
      storedRouteValue: null,
      navigator: {
        language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
      },
      expectedLocale: 'root',
      expectedTargetUrl: 'https://docs.hagicode.com/blog/',
      expectedFinalUrl: 'https://docs.hagicode.com/blog/',
      expectRedirect: false,
      expectedStoredLang: 'root',
    },
    {
      name: 'invalid language on root blog falls back to stored Chinese preference',
      href: 'https://docs.hagicode.com/blog/?lang=invalid',
      storedRouteValue: JSON.stringify({ lang: 'root' }),
      navigator: {
        language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
      },
      expectedLocale: 'root',
      expectedTargetUrl: 'https://docs.hagicode.com/blog/',
      expectedFinalUrl: 'https://docs.hagicode.com/blog/',
      expectRedirect: true,
      expectedStoredLang: 'root',
    },
    {
      name: 'English landing redirects to stored Chinese product overview preference',
      href: 'https://docs.hagicode.com/en-US/',
      storedRouteValue: JSON.stringify({ lang: 'root' }),
      navigator: {
        language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
      },
      landingTargetPath: '/product-overview/',
      expectedLocale: 'root',
      expectedTargetUrl: 'https://docs.hagicode.com/product-overview/',
      expectedFinalUrl: 'https://docs.hagicode.com/product-overview/',
      expectRedirect: true,
      expectedStoredLang: 'root',
    },
  ];

  for (const scenario of scenarios) {
    verifyScenario(resolverApi, scenario);
  }

  console.log('Docs entry language verification passed.');
  console.log('- landing routes now redirect directly to product overview');
  console.log('- first-time visitors still follow the browser language before falling back to English');
  console.log('- root docs/blog paths follow saved preference, then browser language, then English default');
  console.log('- explicit zh-CN keeps the Chinese redirect target');
  console.log('- invalid lang values do not overwrite saved preferences');
  console.log('- only /en-US/ remains as the supported English route prefix');
}

main().catch((error) => {
  console.error('Docs entry language verification failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
