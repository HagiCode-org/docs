import assert from 'node:assert/strict';
import test from 'node:test';

import { JSDOM } from 'jsdom';

import {
  DEFAULT_DOCS_CONTENT_LAYOUT_MODE,
  DOCS_CONTENT_LAYOUT_ATTRIBUTE,
  DOCS_CONTENT_LAYOUT_NARROW,
  DOCS_CONTENT_LAYOUT_STORAGE_KEY,
  DOCS_CONTENT_LAYOUT_WIDE,
  normalizeDocsContentLayout,
  readDocsContentLayout,
  syncDocsContentLayout,
  syncDocsContentLayoutToggleState,
} from '../src/lib/docs-content-layout.mjs';

function createMemoryStorage(initialValue) {
  const store = new Map();

  if (typeof initialValue !== 'undefined') {
    store.set(DOCS_CONTENT_LAYOUT_STORAGE_KEY, initialValue);
  }

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

test('invalid or missing storage values fall back to wide mode', () => {
  assert.equal(normalizeDocsContentLayout('invalid'), DEFAULT_DOCS_CONTENT_LAYOUT_MODE);
  assert.equal(readDocsContentLayout(createMemoryStorage('invalid')), DOCS_CONTENT_LAYOUT_WIDE);
  assert.equal(readDocsContentLayout(createMemoryStorage()), DOCS_CONTENT_LAYOUT_WIDE);
});

test('syncDocsContentLayout writes the normalized mode to root and storage', () => {
  const dom = new JSDOM('<html><body></body></html>');
  const storage = createMemoryStorage();

  const mode = syncDocsContentLayout(
    dom.window.document.documentElement,
    storage,
    DOCS_CONTENT_LAYOUT_NARROW
  );

  assert.equal(mode, DOCS_CONTENT_LAYOUT_NARROW);
  assert.equal(
    dom.window.document.documentElement.getAttribute(DOCS_CONTENT_LAYOUT_ATTRIBUTE),
    DOCS_CONTENT_LAYOUT_NARROW
  );
  assert.equal(storage.getItem(DOCS_CONTENT_LAYOUT_STORAGE_KEY), DOCS_CONTENT_LAYOUT_NARROW);
});

test('syncDocsContentLayout restores the root attribute from storage with wide fallback', () => {
  const invalidDom = new JSDOM('<html><body></body></html>');
  const invalidStorage = createMemoryStorage('broken');

  syncDocsContentLayout(invalidDom.window.document.documentElement, invalidStorage);

  assert.equal(
    invalidDom.window.document.documentElement.getAttribute(DOCS_CONTENT_LAYOUT_ATTRIBUTE),
    DOCS_CONTENT_LAYOUT_WIDE
  );

  const narrowDom = new JSDOM('<html><body></body></html>');
  const narrowStorage = createMemoryStorage(DOCS_CONTENT_LAYOUT_NARROW);

  syncDocsContentLayout(narrowDom.window.document.documentElement, narrowStorage);

  assert.equal(
    narrowDom.window.document.documentElement.getAttribute(DOCS_CONTENT_LAYOUT_ATTRIBUTE),
    DOCS_CONTENT_LAYOUT_NARROW
  );
});

test('toggle state mirrors the active root layout mode', () => {
  const dom = new JSDOM(`
    <html>
      <body>
        <div data-docs-content-layout-toggle>
          <button type="button" data-docs-content-layout-mode="wide"></button>
          <button type="button" data-docs-content-layout-mode="narrow"></button>
        </div>
      </body>
    </html>
  `);

  const toggle = dom.window.document.querySelector('[data-docs-content-layout-toggle]');
  const [wideButton, narrowButton] = toggle.querySelectorAll('[data-docs-content-layout-mode]');

  syncDocsContentLayoutToggleState(toggle, DOCS_CONTENT_LAYOUT_NARROW);

  assert.equal(wideButton.getAttribute('aria-pressed'), 'false');
  assert.equal(narrowButton.getAttribute('aria-pressed'), 'true');
  assert.equal(wideButton.hasAttribute('data-selected'), false);
  assert.equal(narrowButton.hasAttribute('data-selected'), true);
});
