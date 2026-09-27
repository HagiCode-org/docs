import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const headSource = readFileSync(path.join(rootDir, 'src/components/StarlightHead.astro'), 'utf8');
const inlineScript = headSource.match(/<script is:inline>\s*([\s\S]*?)<\/script>/)?.[1];

if (!inlineScript) {
  throw new Error('StarlightHead is missing its pre-paint content-width script.');
}

function runMigration({ current, legacy, disableStorage = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'outside-only',
    url: 'https://docs.hagicode.com/',
  });

  if (current !== undefined) dom.window.localStorage.setItem('hagilight-content-width', current);
  if (legacy !== undefined) dom.window.localStorage.setItem('hagicode-docs-content-layout', legacy);
  if (disableStorage) {
    Object.defineProperty(dom.window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Storage is disabled.');
      },
    });
  }

  dom.window.eval(inlineScript);
  const state = {
    mode: dom.window.document.documentElement.dataset.hagilightContentWidth,
    current: (() => {
      try {
        return dom.window.localStorage.getItem('hagilight-content-width');
      } catch {
        return null;
      }
    })(),
  };
  dom.window.close();
  return state;
}

test('migrates a valid legacy width before paint', () => {
  assert.deepEqual(runMigration({ legacy: 'narrow' }), {
    mode: 'narrow',
    current: 'narrow',
  });
});

test('keeps an existing Hagilight width selection over legacy storage', () => {
  assert.deepEqual(runMigration({ current: 'narrow', legacy: 'wide' }), {
    mode: 'narrow',
    current: 'narrow',
  });
});

test('uses the default width without failing when storage is unavailable', () => {
  assert.deepEqual(runMigration({ disableStorage: true }), {
    mode: 'wide',
    current: null,
  });
});
