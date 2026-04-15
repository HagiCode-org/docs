import assert from 'node:assert/strict';
import test from 'node:test';

import { DOCS_SIDEBAR } from '../src/config/sidebar.ts';

test('release-notes entry stays last in the docs sidebar with localized labels intact', () => {
  const releaseNotesEntries = DOCS_SIDEBAR.filter((entry) => entry.link === '/release-notes');
  assert.equal(releaseNotesEntries.length, 1);

  const lastEntry = DOCS_SIDEBAR.at(-1);
  assert.equal(lastEntry?.link, '/release-notes');
  assert.equal(lastEntry?.label, '版本更新说明');
  assert.equal(lastEntry?.translations?.en, 'Release Notes');
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
