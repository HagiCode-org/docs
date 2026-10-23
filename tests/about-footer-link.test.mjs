import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRelForHref, isFirstPartyHref } from '../shared/src/links.ts';

const steamStoreHref = 'https://store.steampowered.com/app/4625540/Hagicode/';
const testDir = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(testDir, '..');
const monorepoRoot = path.resolve(docsRoot, '..', '..');

function resolveDocsPath(relativePath) {
  return path.join(docsRoot, relativePath);
}

test('docs link registry keeps a canonical about entry that points to the site-owned page', async () => {
  const linksSource = await readFile(resolveDocsPath('shared/src/links.ts'), 'utf8');

  assert.match(
    linksSource,
    /about:\s*\{\s*dev:\s*'https:\/\/www\.hagicode\.com\/about\/',\s*prod:\s*'https:\/\/www\.hagicode\.com\/about\/'/s,
  );
  assert.equal(linksSource.includes('repos/site'), false);
});

test('destination class decides the new-tab rel for shared links', () => {
  for (const href of [
    'https://github.com/HagiCode-org/site',
    'https://cost.hagicode.com',
    'https://www.hagicode.com/about/',
    'https://docs.hagicode.com/blog/',
    '/desktop/',
  ]) {
    assert.equal(isFirstPartyHref(href), true, href);
    assert.equal(getRelForHref(href), 'noopener', href);
  }

  for (const href of [
    'https://discord.gg/qY662sJK',
    'https://qm.qq.com/q/Fwb0o094kw',
    steamStoreHref,
    'https://apps.microsoft.com/detail/9N3PM0N3SVDW',
    'https://hagicode.com.evil.example/',
    'https://nothagicode.com/',
    'https://github.com/HagiCode-org-fake/site',
    'https://example.com/hagicode.com',
  ]) {
    assert.equal(isFirstPartyHref(href), false, href);
    assert.equal(getRelForHref(href), 'noopener noreferrer', href);
  }
});
