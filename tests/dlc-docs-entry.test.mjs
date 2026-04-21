import assert from 'node:assert/strict';
import test from 'node:test';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOCS_SIDEBAR } from '../src/config/sidebar.ts';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(testDir, '..');

function resolveDocsPath(relativePath) {
  return path.join(docsRoot, relativePath);
}

const requiredZhDocsFiles = [
  'src/content/docs/dlc/all-beauties-pack.mdx',
  'src/content/docs/dlc/turbo-engine-dlc.mdx',
  'src/content/docs/dlc/sponsor-pack.mdx',
];

const requiredEnDocsFiles = [
  'src/content/docs/en/dlc/all-beauties-pack.mdx',
  'src/content/docs/en/dlc/turbo-engine-dlc.mdx',
  'src/content/docs/en/dlc/sponsor-pack.mdx',
];

test('docs sidebar exposes DLC as a first-level auto-generated section', () => {
  const dlcEntry = DOCS_SIDEBAR.find((entry) => entry.autogenerate?.directory === 'dlc');

  assert.ok(dlcEntry);
  assert.equal(dlcEntry?.label, 'DLC');
  assert.equal(dlcEntry?.translations?.en, 'DLC');
});

test('required DLC docs content files exist', async () => {
  await Promise.all([
    ...requiredZhDocsFiles.map((relativePath) => access(resolveDocsPath(relativePath))),
    ...requiredEnDocsFiles.map((relativePath) => access(resolveDocsPath(relativePath))),
  ]);
});

test('DLC docs directory no longer requires a standalone overview page', async () => {
  await assert.rejects(access(resolveDocsPath('src/content/docs/dlc/index.mdx')));
});

test('each DLC detail page uses stronger recommendation copy without overview-page back links or hard-coded pricing', async () => {
  const [allBeautiesSource, turboSource, sponsorSource] = await Promise.all([
    readFile(resolveDocsPath('src/content/docs/dlc/all-beauties-pack.mdx'), 'utf8'),
    readFile(resolveDocsPath('src/content/docs/dlc/turbo-engine-dlc.mdx'), 'utf8'),
    readFile(resolveDocsPath('src/content/docs/dlc/sponsor-pack.mdx'), 'utf8'),
  ]);

  for (const source of [allBeautiesSource, turboSource, sponsorSource]) {
    assert.match(source, /值得|推荐|优先购买|支持/);
    assert.doesNotMatch(source, /下一步怎么查看/);
    assert.doesNotMatch(source, /Steam 商店中的 HagiCode 页面/);
    assert.doesNotMatch(source, /DLC 概览/);
    assert.doesNotMatch(source, /\]\(\.\.\/\)/);
    assert.doesNotMatch(source, /￥|\$[0-9]|¥[0-9]/);
  }

  assert.match(allBeautiesSource, /\]\(\.\.\/turbo-engine-dlc\/\)/);
  assert.match(allBeautiesSource, /\]\(\.\.\/sponsor-pack\/\)/);
  assert.match(turboSource, /\]\(\.\.\/all-beauties-pack\/\)/);
  assert.match(turboSource, /\]\(\.\.\/sponsor-pack\/\)/);
  assert.match(sponsorSource, /\]\(\.\.\/turbo-engine-dlc\/\)/);
  assert.match(sponsorSource, /\]\(\.\.\/all-beauties-pack\/\)/);
});

test('english DLC detail pages stay in sync with localized sibling links and recommendation-oriented copy', async () => {
  const [allBeautiesSource, turboSource, sponsorSource] = await Promise.all([
    readFile(resolveDocsPath('src/content/docs/en/dlc/all-beauties-pack.mdx'), 'utf8'),
    readFile(resolveDocsPath('src/content/docs/en/dlc/turbo-engine-dlc.mdx'), 'utf8'),
    readFile(resolveDocsPath('src/content/docs/en/dlc/sponsor-pack.mdx'), 'utf8'),
  ]);

  for (const source of [allBeautiesSource, turboSource, sponsorSource]) {
    assert.match(source, /worth|recommend|priority|support/i);
    assert.doesNotMatch(source, /DLC overview/i);
    assert.doesNotMatch(source, /\]\(\.\.\/\)/);
    assert.doesNotMatch(source, /￥|\$[0-9]|¥[0-9]/);
  }

  assert.match(allBeautiesSource, /\]\(\.\.\/turbo-engine-dlc\/\)/);
  assert.match(allBeautiesSource, /\]\(\.\.\/sponsor-pack\/\)/);
  assert.match(turboSource, /\]\(\.\.\/all-beauties-pack\/\)/);
  assert.match(turboSource, /\]\(\.\.\/sponsor-pack\/\)/);
  assert.match(sponsorSource, /\]\(\.\.\/turbo-engine-dlc\/\)/);
  assert.match(sponsorSource, /\]\(\.\.\/all-beauties-pack\/\)/);
});
