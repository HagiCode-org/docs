import assert from 'node:assert/strict';
import test from 'node:test';

import { DOCS_SIDEBAR } from '../src/config/sidebar.ts';
import { DOCS_LOCALE_SELECTOR_OPTIONS } from '../src/i18n/generated/docs-locale-resources.mjs';

test('release-notes entry stays immediately before DLC with localized labels intact', () => {
  const releaseNotesEntries = DOCS_SIDEBAR.filter((entry) => entry.link === '/release-notes');
  assert.equal(releaseNotesEntries.length, 1);

  const releaseNotesIndex = DOCS_SIDEBAR.findIndex((entry) => entry.link === '/release-notes');
  const dlcIndex = DOCS_SIDEBAR.findIndex((entry) => entry.autogenerate?.directory === 'dlc');
  const releaseNotesEntry = DOCS_SIDEBAR[releaseNotesIndex];

  assert.ok(releaseNotesIndex >= 0);
  assert.ok(dlcIndex >= 0);
  assert.equal(releaseNotesEntry?.label, '版本更新说明');
  assert.equal(releaseNotesEntry?.translations?.en, 'Release Notes');
  assert.equal(dlcIndex, releaseNotesIndex + 1);
  assert.equal(DOCS_SIDEBAR[0]?.link, '/product-overview');
});

test('legal docs are exposed as a docs library section before release notes', () => {
  const legalEntry = DOCS_SIDEBAR.find((entry) => entry.autogenerate?.directory === 'legal');
  const releaseNotesIndex = DOCS_SIDEBAR.findIndex((entry) => entry.link === '/release-notes');
  const legalIndex = DOCS_SIDEBAR.findIndex((entry) => entry.autogenerate?.directory === 'legal');

  assert.ok(legalEntry);
  assert.equal(legalEntry?.label, '法律文档');
  assert.equal(legalEntry?.translations?.en, 'Legal');
  assert.ok(legalIndex >= 0);
  assert.ok(releaseNotesIndex >= 0);
  assert.ok(legalIndex < releaseNotesIndex);
});

test('DLC stays after release notes and before Bundles in the top-level docs sections', () => {
  const dlcEntry = DOCS_SIDEBAR.find((entry) => entry.autogenerate?.directory === 'dlc');
  const dlcIndex = DOCS_SIDEBAR.findIndex((entry) => entry.autogenerate?.directory === 'dlc');
  const releaseNotesIndex = DOCS_SIDEBAR.findIndex((entry) => entry.link === '/release-notes');
  const bundlesIndex = DOCS_SIDEBAR.findIndex((entry) => entry.autogenerate?.directory === 'bundles');

  assert.ok(dlcEntry);
  assert.equal(dlcEntry?.label, 'DLC');
  assert.equal(dlcEntry?.translations?.en, 'DLC');
  assert.ok(dlcIndex >= 0);
  assert.equal(dlcIndex, releaseNotesIndex + 1);
  assert.equal(bundlesIndex, dlcIndex + 1);
  assert.equal(DOCS_SIDEBAR.at(-1)?.autogenerate?.directory, 'bundles');
});

test('all top-level sidebar groups provide translations for every non-root docs locale', () => {
  const requiredLocales = DOCS_LOCALE_SELECTOR_OPTIONS.map((locale) => locale.code).filter(
    (locale) => locale !== 'root',
  );

  for (const entry of DOCS_SIDEBAR) {
    for (const locale of requiredLocales) {
      assert.equal(
        typeof entry.translations?.[locale],
        'string',
        `missing ${locale} translation for ${entry.label}`,
      );
      assert.ok(entry.translations?.[locale]?.trim().length);
    }
  }
});
