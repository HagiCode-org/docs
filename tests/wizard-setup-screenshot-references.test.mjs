import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const docsRoot = path.resolve(import.meta.dirname, '..');
const zhWizardSetupPath = path.join(docsRoot, 'src', 'content', 'docs', 'quick-start', 'wizard-setup.mdx');
const enWizardSetupPath = path.join(docsRoot, 'src', 'content', 'translations', 'docs', 'en-US', 'quick-start', 'wizard-setup.mdx');
const manifestPath = path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots', 'manifest.json');
const managedScreenshotPattern = /img\/screenshots\/(quick-start\/wizard-setup\/[^/\s)]+)\/original\.png/gu;

// The wizard pages describe the current 4-step wizard and embed the managed screenshots
// under quick-start/wizard-setup (captured from the current wizard, Chinese UI). Every
// reference must point at a managed, manifest-registered screenshot.
const expectedScreenshots = [
  'step1-language-theme',
  'step2-cli-model',
  'step2-connection-test',
  'step3-project-form',
  'step3-project-done',
  'step4-community'
];

test('wizard setup pages only reference managed screenshot paths', async () => {
  const [zhPage, enPage] = await Promise.all([
    readFile(zhWizardSetupPath, 'utf8'),
    readFile(enWizardSetupPath, 'utf8')
  ]);

  assert.doesNotMatch(zhPage, /\/wizard-staging\//, 'Chinese wizard setup page should not reference /wizard-staging/.');
  assert.doesNotMatch(enPage, /\/wizard-staging\//, 'English wizard setup page should not reference /wizard-staging/.');
});

test('wizard setup screenshot references are registered in the manifest', async () => {
  const [zhPage, enPage, manifestSource] = await Promise.all([
    readFile(zhWizardSetupPath, 'utf8'),
    readFile(enWizardSetupPath, 'utf8'),
    readFile(manifestPath, 'utf8')
  ]);
  const manifestIds = new Set((JSON.parse(manifestSource).items ?? []).map((item) => item.id));

  for (const page of [zhPage, enPage]) {
    for (const match of page.matchAll(managedScreenshotPattern)) {
      assert.equal(manifestIds.has(match[1]), true, `Expected manifest to include ${match[1]}.`);
    }
  }
});

test('wizard setup pages describe the current 4-step wizard without the retired dependency-check stage', async () => {
  const zhPage = await readFile(zhWizardSetupPath, 'utf8');

  for (const step of ['语言与主题', '设置 Hagicoder', '创建项目', '社区']) {
    assert.match(zhPage, new RegExp(`## 步骤 \\d：${step}`, 'u'), `Expected a step section for ${step}.`);
  }
  assert.doesNotMatch(zhPage, /组件检测/u, 'The wizard no longer has a dependency-check stage.');
});

test('wizard setup pages embed every current wizard screenshot, and the files exist', async () => {
  const [zhPage, enPage] = await Promise.all([
    readFile(zhWizardSetupPath, 'utf8'),
    readFile(enWizardSetupPath, 'utf8')
  ]);

  for (const [label, page] of [['zh-CN', zhPage], ['en-US', enPage]]) {
    for (const id of expectedScreenshots) {
      assert.match(page, new RegExp(`quick-start/wizard-setup/${id}/original\\.png`, 'u'), `${label} page should embed ${id}.`);
    }
  }

  const imageRoot = path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots', 'quick-start', 'wizard-setup');
  for (const id of expectedScreenshots) {
    await readFile(path.join(imageRoot, id, 'original.png'));
  }
});
