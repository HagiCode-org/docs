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

test('docs footer exposes the local about link entry without importing the site footer', async () => {
  const footerSource = await readFile(resolveDocsPath('src/components/StarlightFooter.astro'), 'utf8');

  assert.match(footerSource, /import DocsPromoteInfoBanner from '\.\/DocsPromoteInfoBanner\.astro';/);
  assert.match(footerSource, /<DocsPromoteInfoBanner locale=\{Astro\.locals\?\.starlightRoute\?\.locale\} \/>/);
  assert.match(footerSource, /const aboutLink = getLinkWithLocale\('about', docsLocale\);/);
  assert.match(footerSource, /const footerCopy = getDocsFooterCopy\(currentRouteLocale\);/);
  assert.match(footerSource, /<h3 class="unified-footer-section-title">\{footerCopy\.sections\.ecosystemSites\}<\/h3>/);
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
  assert.equal(navigationSource.includes('https://www.hagicode.com/about/'), false);
  assert.match(footerSource, /const discordLink = getLink\('discord'\);/);
  assert.match(
    footerSource,
    /const steamLink = 'https:\/\/store\.steampowered\.com\/app\/4625540\/Hagicode\/';/,
  );
  assert.match(footerSource, /<a href=\{discordLink\} class="unified-footer-link" target=\{discordTarget\} rel=\{discordRel\}>Discord<\/a>/);
  const steamRel = getRelForHref(steamStoreHref);
  assert.equal(isFirstPartyHref(steamStoreHref), false);
  assert.equal(steamRel, 'noopener noreferrer');
  assert.match(
    footerSource,
    new RegExp(`<a href=\\{steamLink\\} class="unified-footer-link" target="_blank" rel="${steamRel}">\\{getFooterLinkLabel\\('steam'\\)\\}</a>`),
  );
});

test('destination class decides the new-tab rel for shared links', async () => {
  const navigationSource = await readFile(resolveDocsPath('src/config/navigation.ts'), 'utf8');

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

  assert.match(navigationSource, /attributes\.rel = getRelForHref\(link\.href\);/);
  assert.equal(navigationSource.includes("attributes.rel = 'noopener noreferrer';"), false);
});
