import assert from 'node:assert/strict';
import test from 'node:test';

import { DOCS_SIDEBAR } from '../src/config/sidebar.ts';

test('release-notes entry stays immediately before DLC with localized labels intact', () => {
  const releaseNotesEntries = DOCS_SIDEBAR.filter((entry) => entry.link === '/release-notes');
  assert.equal(releaseNotesEntries.length, 1);

  const releaseNotesIndex = DOCS_SIDEBAR.findIndex((entry) => entry.link === '/release-notes');
  const dlcIndex = DOCS_SIDEBAR.findIndex((entry) => entry.autogenerate?.directory === 'dlc');
  const releaseNotesEntry = DOCS_SIDEBAR[releaseNotesIndex];
  const lastEntry = DOCS_SIDEBAR.at(-1);

  assert.ok(releaseNotesIndex >= 0);
  assert.ok(dlcIndex >= 0);
  assert.equal(releaseNotesEntry?.label, '版本更新说明');
  assert.equal(releaseNotesEntry?.translations?.en, 'Release Notes');
  assert.equal(dlcIndex, releaseNotesIndex + 1);
  assert.equal(lastEntry?.autogenerate?.directory, 'dlc');
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

test('DLC stays after release notes as the last top-level docs section', () => {
  const dlcEntry = DOCS_SIDEBAR.find((entry) => entry.autogenerate?.directory === 'dlc');
  const dlcIndex = DOCS_SIDEBAR.findIndex((entry) => entry.autogenerate?.directory === 'dlc');
  const releaseNotesIndex = DOCS_SIDEBAR.findIndex((entry) => entry.link === '/release-notes');

  assert.ok(dlcEntry);
  assert.equal(dlcEntry?.label, 'DLC');
  assert.equal(dlcEntry?.translations?.en, 'DLC');
  assert.ok(dlcIndex >= 0);
  assert.equal(dlcIndex, DOCS_SIDEBAR.length - 1);
  assert.equal(dlcIndex, releaseNotesIndex + 1);
});
