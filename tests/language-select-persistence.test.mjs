import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { DOCS_LOCALE_SELECTOR_OPTIONS } from '../src/i18n/generated/docs-locale-resources.mjs';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const encodeSelectionValue = (path, locale) => JSON.stringify({ path, locale });

async function readLanguageSelectScript() {
  const componentPath = path.join(testDir, '..', 'src', 'components', 'StarlightLanguageSelect.astro');
  const source = await readFile(componentPath, 'utf8');
  const match = source.match(/<script>\n([\s\S]*)\n<\/script>/);

  assert.ok(match, 'language select component should contain a browser script');
  return match[1];
}

function evaluateLanguageSelectScript(scriptContent, options = {}) {
  const listeners = new Map();
  const store = new Map();
  let pathname = '/product-overview/';
  let selectedIndex = 0;

  if (options.storedRouteValue) {
    store.set('starlight-route', options.storedRouteValue);
  }

  let elementInstance = null;
  function HTMLElement() {
    elementInstance = this;
  }
  HTMLElement.prototype.querySelector = function querySelector(selector) {
    return selector === 'select' ? select : null;
  };

  function HTMLSelectElement() {}

  const select = Object.setPrototypeOf(
    {
      value: options.selectedValue ?? encodeSelectionValue('/en-US/product-overview/', 'en-US'),
      selectedIndex,
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      querySelector(selector) {
        if (selector === 'option[selected]') {
          return { index: selectedIndex };
        }

        return null;
      },
    },
    HTMLSelectElement.prototype,
  );

  const customElements = {
    definitions: new Map(),
    define(name, constructor) {
      this.definitions.set(name, constructor);
    },
  };

  const localStorage = {
    getItem(key) {
      if (options.storageThrows) {
        throw new Error('storage unavailable');
      }

      return store.get(key) ?? null;
    },
    setItem(key, value) {
      if (options.storageThrows) {
        throw new Error('storage unavailable');
      }

      store.set(key, String(value));
    },
  };

  const window = {
    location: {
      get pathname() {
        return pathname;
      },
      set pathname(value) {
        pathname = value;
      },
    },
    addEventListener() {},
  };

  const context = vm.createContext({
    customElements,
    HTMLElement,
    HTMLSelectElement,
    localStorage,
    window,
  });

  vm.runInContext(scriptContent, context, { filename: 'StarlightLanguageSelect.astro script' });

  const ElementConstructor = customElements.definitions.get('starlight-lang-select');
  new ElementConstructor();
  assert.ok(elementInstance, 'custom element should construct');
  listeners.get('change')?.({ currentTarget: select });

  return {
    pathname,
    storedRouteValue: store.get('starlight-route'),
  };
}

test('language selector persists English locale before navigating', async () => {
  const scriptContent = await readLanguageSelectScript();
  const result = evaluateLanguageSelectScript(scriptContent, {
    selectedValue: encodeSelectionValue('/en-US/product-overview/', 'en-US'),
    storedRouteValue: JSON.stringify({ path: '/product-overview/', lang: 'root' }),
  });

  assert.equal(result.pathname, '/en-US/product-overview/');
  assert.deepEqual(JSON.parse(result.storedRouteValue), {
    path: '/product-overview/',
    lang: 'en-US',
  });
});

test('language selector renders the full generated locale set in the header', async () => {
  const componentPath = path.join(testDir, '..', 'src', 'components', 'StarlightLanguageSelect.astro');
  const source = await readFile(componentPath, 'utf8');

  assert.match(source, /DOCS_LOCALE_SELECTOR_OPTIONS/);
  assert.match(source, /buildDocsRoutePath/);
  assert.match(source, /stripDocsLocalePrefix/);
  assert.match(source, /label: locale\.label/);
  assert.match(source, /return true;/);
  assert.deepEqual(
    DOCS_LOCALE_SELECTOR_OPTIONS.map(({ code, label }) => ({ code, label })),
    [
      { code: 'root', label: '中文' },
      { code: 'zh-Hant', label: '繁體中文' },
      { code: 'en-US', label: 'English' },
      { code: 'ja-JP', label: '日本語' },
      { code: 'ko-KR', label: '한국어' },
      { code: 'de-DE', label: 'Deutsch' },
      { code: 'fr-FR', label: 'Français' },
      { code: 'es-ES', label: 'Español' },
      { code: 'pt-BR', label: 'Português (Brasil)' },
      { code: 'ru-RU', label: 'Русский' },
    ],
  );
});

test('language selector navigates even when localStorage fails', async () => {
  const scriptContent = await readLanguageSelectScript();
  const result = evaluateLanguageSelectScript(scriptContent, {
    selectedValue: encodeSelectionValue('/product-overview/', 'root'),
    storageThrows: true,
  });

  assert.equal(result.pathname, '/product-overview/');
  assert.equal(result.storedRouteValue, undefined);
});

test('language selector persists Japanese locale from the encoded route target', async () => {
  const scriptContent = await readLanguageSelectScript();
  const result = evaluateLanguageSelectScript(scriptContent, {
    selectedValue: encodeSelectionValue('/ja-JP/product-overview/', 'ja-JP'),
    storedRouteValue: JSON.stringify({ path: '/en-US/product-overview/', lang: 'en-US' }),
  });

  assert.equal(result.pathname, '/ja-JP/product-overview/');
  assert.deepEqual(JSON.parse(result.storedRouteValue), {
    path: '/en-US/product-overview/',
    lang: 'ja-JP',
  });
});
