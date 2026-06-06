import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));

test('StarlightLanguageSelect mounts the modal switcher with generated locale options', async () => {
  const componentPath = path.join(testDir, '..', 'src', 'components', 'StarlightLanguageSelect.astro');
  const source = await readFile(componentPath, 'utf8');

  assert.match(source, /import DocsLanguageSwitcher from '\.\/DocsLanguageSwitcher'/);
  assert.match(source, /currentLocale=/);
  assert.match(source, /options=\{DOCS_LOCALE_SELECTOR_OPTIONS\}/);
  assert.match(source, /selectedStateLabel=/);
});

test('generated locale resources expose the desktop-aligned 10 docs languages for the chooser', async () => {
  const generatedModuleUrl = pathToFileURL(
    path.join(testDir, '..', 'src', 'i18n', 'generated', 'docs-locale-resources.mjs'),
  );
  generatedModuleUrl.search = String(Date.now());
  const generatedModule = await import(generatedModuleUrl.href);

  assert.equal(generatedModule.DOCS_LOCALE_SELECTOR_OPTIONS.length, 10);
  assert.equal(generatedModule.DOCS_LOCALE_SELECTOR_OPTIONS[0]?.code, 'root');
  assert.equal(
    generatedModule.DOCS_LOCALE_SELECTOR_OPTIONS.find((locale) => locale.code === 'pt-BR')?.label,
    'Português (Brasil)',
  );
});
