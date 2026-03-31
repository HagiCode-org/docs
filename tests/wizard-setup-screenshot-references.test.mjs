import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const docsRoot = path.resolve(import.meta.dirname, '..');
const zhWizardSetupPath = path.join(docsRoot, 'src', 'content', 'docs', 'quick-start', 'wizard-setup.mdx');
const enWizardSetupPath = path.join(docsRoot, 'src', 'content', 'docs', 'en', 'quick-start', 'wizard-setup.mdx');
const manifestPath = path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots', 'manifest.json');
const expectedManagedIds = [
  'quick-start/wizard-setup/guide1-language-theme',
  'quick-start/wizard-setup/guide2-dependency-check',
  'quick-start/wizard-setup/guide3-default-agent-cli-model'
];

test('wizard setup pages only reference managed screenshot paths', async () => {
  const [zhPage, enPage] = await Promise.all([
    readFile(zhWizardSetupPath, 'utf8'),
    readFile(enWizardSetupPath, 'utf8')
  ]);

  assert.doesNotMatch(zhPage, /\/wizard-staging\//, 'Chinese wizard setup page should not reference /wizard-staging/.');
  assert.doesNotMatch(enPage, /\/wizard-staging\//, 'English wizard setup page should not reference /wizard-staging/.');

  assert.match(zhPage, /\.\.\/img\/screenshots\/quick-start\/wizard-setup\/guide1-language-theme\/original\.png/);
  assert.match(zhPage, /\.\.\/img\/screenshots\/quick-start\/wizard-setup\/guide2-dependency-check\/original\.png/);
  assert.match(zhPage, /\.\.\/img\/screenshots\/quick-start\/wizard-setup\/guide3-default-agent-cli-model\/original\.png/);

  assert.match(enPage, /\.\.\/\.\.\/img\/screenshots\/quick-start\/wizard-setup\/guide1-language-theme\/original\.png/);
  assert.match(enPage, /\.\.\/\.\.\/img\/screenshots\/quick-start\/wizard-setup\/guide2-dependency-check\/original\.png/);
  assert.match(enPage, /\.\.\/\.\.\/img\/screenshots\/quick-start\/wizard-setup\/guide3-default-agent-cli-model\/original\.png/);
});

test('wizard setup managed screenshots are registered in the manifest', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const manifestIds = new Set((manifest.items ?? []).map((item) => item.id));

  for (const id of expectedManagedIds) {
    assert.equal(manifestIds.has(id), true, `Expected manifest to include ${id}.`);
  }
});
