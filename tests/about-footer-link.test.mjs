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

test('docs header navigation reuses the shared about link registry and keeps discord in secondary surfaces', async () => {
  const navigationSource = await readFile(resolveDocsPath('src/config/navigation.ts'), 'utf8');
  const footerSource = await readFile(resolveDocsPath('src/components/StarlightFooter.astro'), 'utf8');

  assert.match(navigationSource, /href:\s*getLink\('about'\)/);
  assert.match(navigationSource, /linkKey:\s*'about'/);
  assert.equal(navigationSource.includes('https://hagicode.com/about/'), false);
  assert.match(footerSource, /const discordLink = getLink\('discord'\);/);
  assert.match(footerSource, /<a href=\{discordLink\} class="unified-footer-link" target=\{discordTarget\} rel=\{discordRel\}>Discord<\/a>/);
});
