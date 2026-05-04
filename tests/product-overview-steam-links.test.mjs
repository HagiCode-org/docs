import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BASE_STEAM_URL = 'https://store.steampowered.com/app/4625540/Hagicode/';
const TURBO_ENGINE_STEAM_URL = 'https://store.steampowered.com/app/4635480/Hagicode__Turbo_Engine/';
const HAGICODE_PLUS_BUNDLE_URL = 'https://store.steampowered.com/bundle/73989/Hagicode_Plus/';

function resolveDocsPath(relativePath) {
  return path.join(docsRoot, relativePath);
}

function countOccurrences(source, value) {
  return source.split(value).length - 1;
}

function readSteamUrls(source) {
  return source.match(/https:\/\/store\.steampowered\.com\/app\/\d+\/[A-Za-z_]+\/?/g) ?? [];
}

test('product overview pages keep the generic Steam entry on the base app while routing Hagicode Plus to the bundle page', async () => {
  const [zhSource, enSource] = await Promise.all([
    readFile(resolveDocsPath('src/content/docs/product-overview.mdx'), 'utf8'),
    readFile(resolveDocsPath('src/content/translations/docs/en-US/product-overview.mdx'), 'utf8'),
  ]);

  for (const source of [zhSource, enSource]) {
    assert.equal(countOccurrences(source, BASE_STEAM_URL), 3);
    assert.equal(countOccurrences(source, TURBO_ENGINE_STEAM_URL), 1);
    assert.equal(countOccurrences(source, HAGICODE_PLUS_BUNDLE_URL), 1);
  }
});

test('product overview pages do not embed product artwork or standalone preview sections', async () => {
  const [zhSource, enSource] = await Promise.all([
    readFile(resolveDocsPath('src/content/docs/product-overview.mdx'), 'utf8'),
    readFile(resolveDocsPath('src/content/translations/docs/en-US/product-overview.mdx'), 'utf8'),
  ]);

  for (const source of [zhSource, enSource]) {
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
