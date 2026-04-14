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
