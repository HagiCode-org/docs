import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(scriptDir, '..');
const distDir = path.join(docsDir, 'dist');

async function readDistFile(relativePath) {
  return readFile(path.join(distDir, relativePath), 'utf8');
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

function evaluateEntryScript(
  scriptContent,
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
  const context = vm.createContext({
    URL,
    console,
    document: mock.window.document,
    window: mock.window,
  });

  vm.runInContext(scriptContent, context, { filename: 'lang-redirect.js' });

  return {
    api: mock.window.__HAGICODE_DOCS_ENTRY__,
    redirects: mock.redirects,
    localStorage: mock.localStorage.dump(),
    finalUrl: mock.getCurrentUrl(),
  };
}

function verifyScenario(scriptContent, scenario) {
  const result = evaluateEntryScript(
    scriptContent,
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
}

async function main() {
  const [rootHtml, enHtml, redirectScript] = await Promise.all([
    readDistFile('index.html'),
    readDistFile(path.join('en', 'index.html')),
    readDistFile('lang-redirect.js'),
  ]);

  assertIncludes(rootHtml, 'name="hagicode-docs-default-entry" content="en"', 'root landing should advertise the English default entry');
  assertIncludes(rootHtml, '<html lang="zh-CN"', 'root landing should keep Chinese metadata');
  assertIncludes(rootHtml, 'name="hagicode-docs-landing-target" content="/product-overview/"', 'root landing should point directly to the product overview route');
  assertIncludes(rootHtml, 'http-equiv="refresh"', 'root landing should expose a non-JS redirect fallback');
  assertIncludes(rootHtml, '/lang-redirect.js', 'root landing should load the entry route resolver');

  assertIncludes(enHtml, 'name="hagicode-docs-default-entry" content="en"', 'English landing should advertise the English default entry');
  assertIncludes(enHtml, '<html lang="en"', 'English landing should expose English metadata');
  assertIncludes(enHtml, 'name="hagicode-docs-landing-target" content="/product-overview/"', 'English landing should point directly to the product overview route');
  assertIncludes(enHtml, 'http-equiv="refresh"', 'English landing should expose a non-JS redirect fallback');
  assertIncludes(enHtml, '/lang-redirect.js', 'English landing should load the entry route resolver');

  const [rootDocsHtml, rootBlogHtml, enDocsHtml, enBlogHtml] = await Promise.all([
    readDistFile(path.join('product-overview', 'index.html')),
    readDistFile(path.join('blog', 'index.html')),
    readDistFile(path.join('en', 'product-overview', 'index.html')),
    readDistFile(path.join('en', 'blog', 'index.html')),
  ]);

  assertIncludes(rootDocsHtml, '/lang-redirect.js', 'root docs pages should load the shared route resolver');
  assertIncludes(rootBlogHtml, '/lang-redirect.js', 'root blog pages should load the shared route resolver');
  assertIncludes(enDocsHtml, '/lang-redirect.js', 'English docs pages should load the shared route resolver');
  assertIncludes(enBlogHtml, '/lang-redirect.js', 'English blog pages should load the shared route resolver');

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
      expectedLocale: 'en',
      expectedTargetUrl: 'https://docs.hagicode.com/en/product-overview/',
      expectedFinalUrl: 'https://docs.hagicode.com/en/product-overview/',
      expectRedirect: true,
      expectedStoredLang: 'en',
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
      name: 'invalid language falls back to English product overview',
      href: 'https://docs.hagicode.com/?lang=fr',
      storedRouteValue: null,
      navigator: {
        language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
      },
      landingTargetPath: '/product-overview/',
      expectedLocale: 'en',
      expectedTargetUrl: 'https://docs.hagicode.com/en/product-overview/',
      expectedFinalUrl: 'https://docs.hagicode.com/en/product-overview/',
      expectRedirect: true,
      expectedStoredLang: 'en',
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
      name: 'root docs path defaults to English for first-time visitors',
      href: 'https://docs.hagicode.com/product-overview/',
      storedRouteValue: null,
      navigator: {
        language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
      },
      expectedLocale: 'en',
      expectedTargetUrl: 'https://docs.hagicode.com/en/product-overview/',
      expectedFinalUrl: 'https://docs.hagicode.com/en/product-overview/',
      expectRedirect: true,
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
      name: 'root blog path defaults to English for first-time visitors',
      href: 'https://docs.hagicode.com/blog/',
      storedRouteValue: null,
      navigator: {
        language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
      },
      expectedLocale: 'en',
      expectedTargetUrl: 'https://docs.hagicode.com/en/blog/',
      expectedFinalUrl: 'https://docs.hagicode.com/en/blog/',
      expectRedirect: true,
    },
    {
      name: 'invalid language on root blog falls back to English',
      href: 'https://docs.hagicode.com/blog/?lang=invalid',
      storedRouteValue: JSON.stringify({ lang: 'root' }),
      navigator: {
        language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
      },
      expectedLocale: 'en',
      expectedTargetUrl: 'https://docs.hagicode.com/en/blog/',
      expectedFinalUrl: 'https://docs.hagicode.com/en/blog/',
      expectRedirect: true,
      expectedStoredLang: 'en',
    },
    {
      name: 'English landing redirects to English product overview even with stored Chinese preference',
      href: 'https://docs.hagicode.com/en/',
      storedRouteValue: JSON.stringify({ lang: 'root' }),
      navigator: {
        language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
      },
      landingTargetPath: '/product-overview/',
      expectedLocale: 'en',
      expectedTargetUrl: 'https://docs.hagicode.com/en/product-overview/',
      expectedFinalUrl: 'https://docs.hagicode.com/en/product-overview/',
      expectRedirect: true,
      expectedStoredLang: 'root',
    },
  ];

  for (const scenario of scenarios) {
    verifyScenario(redirectScript, scenario);
  }

  console.log('Docs entry language verification passed.');
  console.log('- landing routes now redirect directly to product overview');
  console.log('- first-time visitors still follow the browser language before falling back to English');
  console.log('- root docs/blog paths default to English unless Chinese was explicitly chosen');
  console.log('- explicit zh-CN keeps the Chinese redirect target');
  console.log('- invalid lang values cleanly fall back to English');
  console.log('- /en/ also redirects directly to the English product overview');
}

main().catch((error) => {
  console.error('Docs entry language verification failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
