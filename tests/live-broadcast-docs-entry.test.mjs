import assert from 'node:assert/strict';
import test from 'node:test';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(testDir, '..');

function resolveDocsPath(relativePath) {
  return path.join(docsRoot, relativePath);
}

test('publishes the live broadcast QR asset at the stable docs path', async () => {
  await access(resolveDocsPath('public/live/douyin-qrcode.png'));
});

test('product overview entry pages import the docs-owned live broadcast surface', async () => {
  const [zhContent, enContent] = await Promise.all([
    readFile(resolveDocsPath('src/content/docs/product-overview.mdx'), 'utf8'),
    readFile(resolveDocsPath('src/content/docs/en/product-overview.mdx'), 'utf8'),
  ]);

  assert.match(zhContent, /import LiveBroadcastCard from '@\/components\/LiveBroadcastCard\.astro';/);
  assert.match(enContent, /import LiveBroadcastCard from '@\/components\/LiveBroadcastCard\.astro';/);
  assert.match(zhContent.trimEnd(), /<LiveBroadcastCard locale="zh-CN" \/>$/);
  assert.match(enContent.trimEnd(), /<LiveBroadcastCard locale="en" \/>$/);
});

test('canonical live-broadcast contract leaves QR asset paths to each site', async () => {
  const payload = JSON.parse(await readFile(resolveDocsPath('../index/src/data/public/live-broadcast.json'), 'utf8'));

  assert.equal('imageUrl' in payload.qrCode, false);
});

test('docs live broadcast implementation stays within the docs repo', async () => {
  const [cardSource, reminderSource, helperSource] = await Promise.all([
    readFile(resolveDocsPath('src/components/LiveBroadcastCardClient.tsx'), 'utf8'),
    readFile(resolveDocsPath('src/components/LiveBroadcastReminder.tsx'), 'utf8'),
    readFile(resolveDocsPath('src/lib/live-broadcast.ts'), 'utf8'),
  ]);

  const combined = `${cardSource}
${reminderSource}
${helperSource}`;
  assert.equal(combined.includes('repos/site'), false);
  assert.equal(combined.includes('@/components/home'), false);
});
