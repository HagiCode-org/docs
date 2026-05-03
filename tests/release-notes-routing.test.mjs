import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { isReleaseNotesRoutePath } from '../src/lib/i18n.ts';
import { resolveDocsLandingRoute } from '../src/lib/langParamHandler.ts';

const testDir = path.dirname(fileURLToPath(import.meta.url));

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

function createMockWindow(href, storedRouteValue, navigatorConfig = {}) {
  let currentUrl = new URL(href);
  const redirects = [];
  const localStorage = createLocalStorage(storedRouteValue);
  const document = {
    querySelector() {
      return null;
    },
  };

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

function evaluateEntryScript(scriptContent, href, storedRouteValue = null, navigatorConfig = {}) {
  const mock = createMockWindow(href, storedRouteValue, navigatorConfig);
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

test('release-notes helper flags only landing routes without confusing other docs pages', () => {
  assert.equal(isReleaseNotesRoutePath('/release-notes/'), true);
  assert.equal(isReleaseNotesRoutePath('/en-US/release-notes/'), true);
  assert.equal(isReleaseNotesRoutePath('/release-notes/v1.0.0/'), false);
  assert.equal(isReleaseNotesRoutePath('/en-US/release-notes/v1.0.0/'), false);
  assert.equal(isReleaseNotesRoutePath('/product-overview/'), false);
});

test('release-notes landing follows saved preference and allows explicit ?lang switches', () => {
  const rooted = resolveDocsLandingRoute(
    new URL('https://docs.hagicode.com/release-notes/'),
    JSON.stringify({ lang: 'en-US' }),
    ['en-US', 'en'],
  );
  assert.equal(rooted.resolvedLocale, 'en-US');
  assert.equal(rooted.targetUrl, 'https://docs.hagicode.com/en-US/release-notes/');
  assert.equal(rooted.shouldRedirect, true);

  const anchoredLanding = resolveDocsLandingRoute(
    new URL('https://docs.hagicode.com/release-notes/#v1.0.0'),
    JSON.stringify({ lang: 'root' }),
    ['zh-CN', 'zh'],
  );
  assert.equal(anchoredLanding.resolvedLocale, 'root');
  assert.equal(anchoredLanding.targetUrl, 'https://docs.hagicode.com/release-notes/#v1.0.0');
  assert.equal(anchoredLanding.shouldRedirect, false);

  const switchLandingToEnglish = resolveDocsLandingRoute(
    new URL('https://docs.hagicode.com/release-notes/?lang=en-US#v1.0.0'),
    JSON.stringify({ lang: 'root' }),
    ['zh-CN', 'zh'],
  );
  assert.equal(switchLandingToEnglish.resolvedLocale, 'en-US');
  assert.equal(switchLandingToEnglish.targetUrl, 'https://docs.hagicode.com/en-US/release-notes/#v1.0.0');
  assert.equal(switchLandingToEnglish.shouldRedirect, true);

  const switchToChinese = resolveDocsLandingRoute(
    new URL('https://docs.hagicode.com/en-US/release-notes/?lang=zh-CN#v1.0.0'),
    JSON.stringify({ lang: 'en-US' }),
    ['en-US', 'en'],
  );
  assert.equal(switchToChinese.resolvedLocale, 'root');
  assert.equal(switchToChinese.targetUrl, 'https://docs.hagicode.com/release-notes/#v1.0.0');
  assert.equal(switchToChinese.shouldRedirect, true);
});

test('public lang-redirect script redirects release-notes routes by saved or explicit locale', async () => {
  const scriptPath = path.join(testDir, '..', 'public', 'lang-redirect.js');
  const scriptContent = await readFile(scriptPath, 'utf8');

  const rootChinese = evaluateEntryScript(
    scriptContent,
    'https://docs.hagicode.com/release-notes/',
    JSON.stringify({ lang: 'en-US' }),
    {
      language: 'en-US',
      languages: ['en-US', 'en'],
    },
  );
  assert.equal(rootChinese.api.lastResolution.resolvedLocale, 'en-US');
  assert.equal(rootChinese.finalUrl, 'https://docs.hagicode.com/en-US/release-notes/');
  assert.equal(rootChinese.api.lastResolution.shouldRedirect, true);

  const english = evaluateEntryScript(
    scriptContent,
    'https://docs.hagicode.com/en-US/release-notes/',
    JSON.stringify({ lang: 'root' }),
    {
      language: 'zh-CN',
      languages: ['zh-CN', 'zh'],
    },
  );
  assert.equal(english.api.lastResolution.resolvedLocale, 'root');
  assert.equal(english.finalUrl, 'https://docs.hagicode.com/release-notes/');
  assert.equal(english.api.lastResolution.shouldRedirect, true);

  const storedLocaleSwitch = evaluateEntryScript(
    scriptContent,
    'https://docs.hagicode.com/en-US/release-notes/?lang=zh-CN',
    JSON.stringify({ lang: 'en-US' }),
    {
      language: 'en-US',
      languages: ['en-US', 'en'],
    },
  );
  assert.equal(storedLocaleSwitch.api.lastResolution.resolvedLocale, 'root');
  assert.equal(storedLocaleSwitch.finalUrl, 'https://docs.hagicode.com/release-notes/');
  assert.equal(storedLocaleSwitch.api.lastResolution.shouldRedirect, true);
  assert.equal(JSON.parse(storedLocaleSwitch.localStorage['starlight-route']).lang, 'root');
});
