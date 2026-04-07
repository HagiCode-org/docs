import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
    /about:\s*\{\s*dev:\s*'https:\/\/hagicode\.com\/about\/',\s*prod:\s*'https:\/\/hagicode\.com\/about\/'/s,
  );
  assert.equal(linksSource.includes('repos/site'), false);
});

test('docs footer exposes the local about link entry without importing the site footer', async () => {
  const footerSource = await readFile(resolveDocsPath('src/components/StarlightFooter.astro'), 'utf8');

  assert.match(footerSource, /const aboutLink = getLink\('about'\);/);
  assert.match(footerSource, /const relatedSiteLinks = resolveDocsFooterSiteLinks/);
  assert.match(footerSource, /<h3 class="unified-footer-section-title">生态站点<\/h3>/);
  assert.match(footerSource, /<span class="unified-footer-link-title">\{link\.title\}<\/span>/);
  assert.match(footerSource, /<span class="unified-footer-link-description">\{link\.description\}<\/span>/);
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

test('docs snapshot artifact stays aligned with the canonical sites catalog for footer destinations', async () => {
  const canonical = JSON.parse(
    await readFile(path.join(monorepoRoot, 'repos/index/src/data/public/sites.json'), 'utf8'),
  );
  const bundled = JSON.parse(
    await readFile(resolveDocsPath('src/data/footer-sites.snapshot.json'), 'utf8'),
  );

  assert.deepEqual(
    bundled.entries.map((entry) => ({ id: entry.id, url: entry.url })),
    canonical.entries.map((entry) => ({ id: entry.id, url: entry.url })),
  );
});
