import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TURBO_ENGINE_STEAM_URL = 'https://store.steampowered.com/app/4635480/Hagicode__Turbo_Engine/';
const OVERVIEW_LOCALES = ['en-US', 'zh-Hant', 'fr-FR', 'de-DE', 'es-ES', 'ja-JP', 'ko-KR', 'pt-BR', 'ru-RU'];

function resolveDocsPath(relativePath) {
  return path.join(docsRoot, relativePath);
}

function readSteamUrls(source) {
  return source.match(/https:\/\/store\.steampowered\.com\/app\/\d+\/[A-Za-z_]+\/?/g) ?? [];
}

test('product overview pages guide readers to current installation and pricing details without Steam purchase links', async () => {
  const sources = await Promise.all([
    readFile(resolveDocsPath('src/content/docs/product-overview.mdx'), 'utf8'),
    ...OVERVIEW_LOCALES.map((locale) =>
      readFile(resolveDocsPath(`src/content/translations/docs/${locale}/product-overview.mdx`), 'utf8')),
  ]);

  for (const [index, source] of sources.entries()) {
    const localePrefix = index === 0 ? '' : `/${OVERVIEW_LOCALES[index - 1]}`;
    assert.doesNotMatch(source, /https:\/\/store\.steampowered\.com\//);
    assert.match(source, new RegExp(`href="${localePrefix}/installation/?"`));
    assert.ok(source.includes(`${localePrefix}/dlc/turbo-engine-dlc`));
    assert.ok(source.includes(`${localePrefix}/faq/steam-distribution-status`));
  }
});

test('product overview pages do not embed product artwork or standalone preview sections', async () => {
  const sources = await Promise.all([
    readFile(resolveDocsPath('src/content/docs/product-overview.mdx'), 'utf8'),
    ...OVERVIEW_LOCALES.map((locale) =>
      readFile(resolveDocsPath(`src/content/translations/docs/${locale}/product-overview.mdx`), 'utf8')),
  ]);

  for (const source of sources) {
    assert.doesNotMatch(source, /SteamProductArtwork/);
    assert.doesNotMatch(source, /steamProducts\['hagicode-plus'\]/);
    assert.doesNotMatch(source, /steamProducts\['turbo-engine'\]/);
    assert.doesNotMatch(source, /SteamPromotionCard|PromotionPreviewSection|promotion preview section/i);
  }
});

test('Turbo Engine DLC detail pages do not expose a direct purchase CTA back to the base app store page', async () => {
  const [zhSource, enSource] = await Promise.all([
    readFile(resolveDocsPath('src/content/docs/dlc/turbo-engine-dlc.mdx'), 'utf8'),
    readFile(resolveDocsPath('src/content/translations/docs/en-US/dlc/turbo-engine-dlc.mdx'), 'utf8'),
  ]);

  for (const source of [zhSource, enSource]) {
    for (const url of readSteamUrls(source)) {
      assert.equal(url, TURBO_ENGINE_STEAM_URL);
    }
  }
});

test('DLC and bundle detail pages use matching product artwork without promotion copy', async () => {
  const pages = await Promise.all([
    readFile(resolveDocsPath('src/content/docs/dlc/turbo-engine-dlc.mdx'), 'utf8'),
    readFile(resolveDocsPath('src/content/translations/docs/en-US/dlc/turbo-engine-dlc.mdx'), 'utf8'),
    readFile(resolveDocsPath('src/content/docs/bundles/hagicode-plus.mdx'), 'utf8'),
    readFile(resolveDocsPath('src/content/translations/docs/en-US/bundles/hagicode-plus.mdx'), 'utf8'),
  ]);

  for (const source of pages) {
    assert.match(source, /SteamProductArtwork/);
    assert.match(source, /loadDocsSteamProducts/);
    assert.doesNotMatch(source, /SteamPromotionCard/);
  }

  assert.match(pages[0], /steamProducts\['turbo-engine'\]/);
  assert.match(pages[1], /steamProducts\['turbo-engine'\]/);
  assert.match(pages[2], /steamProducts\['hagicode-plus'\]/);
  assert.match(pages[3], /steamProducts\['hagicode-plus'\]/);
});
