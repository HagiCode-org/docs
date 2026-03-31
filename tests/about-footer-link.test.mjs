import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(testDir, '..');

function resolveDocsPath(relativePath) {
  return path.join(docsRoot, relativePath);
}

test('docs link registry keeps a canonical about entry that points to the site-owned page', async () => {
  const linksSource = await readFile(resolveDocsPath('shared/src/links.ts'), 'utf8');

  assert.match(
    linksSource,
    /about:\s*\{\s*dev:\s*'https:\/\/hagicode\.com\/about\/',\s*prod:\s*'https:\/\/hagicode\.com\/about\/'/s,
  );
  assert.equal(linksSource.includes('repos/site'), false);
});

test('docs footer exposes the local about link entry without importing the site footer', async () => {
  const footerSource = await readFile(resolveDocsPath('src/components/StarlightFooter.astro'), 'utf8');

  assert.match(footerSource, /const aboutLink = getLink\('about'\);/);
  assert.match(footerSource, /<a href=\{aboutLink\} class="unified-footer-link">关于 HagiCode<\/a>/);
  assert.equal(footerSource.includes('@/components/home/Footer'), false);
  assert.equal(footerSource.includes('repos/site'), false);
});
