import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const docsRoot = path.resolve(import.meta.dirname, '..');
const zhWizardSetupPath = path.join(docsRoot, 'src', 'content', 'docs', 'quick-start', 'wizard-setup.mdx');
const enWizardSetupPath = path.join(docsRoot, 'src', 'content', 'translations', 'docs', 'en-US', 'quick-start', 'wizard-setup.mdx');
const staticScreenshotPattern = /img\/quick-start\/wizard-setup\/([^/\s)]+\.png)/gu;

// The wizard pages describe the current 4-step wizard and embed static English-interface
// screenshots from img/quick-start/wizard-setup. Every reference must point at an existing file.
const expectedScreenshots = [
  '01-language-theme.png',
  '02-cli-model.png',
  '03-connection-test.png',
  '04-project-form.png',
  '05-project-summary.png',
  '06-community.png'
];

test('wizard setup pages do not reference the retired staging path', async () => {
  const [zhPage, enPage] = await Promise.all([
    readFile(zhWizardSetupPath, 'utf8'),
    readFile(enWizardSetupPath, 'utf8')
  ]);

  assert.doesNotMatch(zhPage, /\/wizard-staging\//, 'Chinese wizard setup page should not reference /wizard-staging/.');
  assert.doesNotMatch(enPage, /\/wizard-staging\//, 'English wizard setup page should not reference /wizard-staging/.');
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
    const referenced = new Set([...page.matchAll(staticScreenshotPattern)].map((match) => match[1]));
    for (const file of expectedScreenshots) {
      assert.equal(referenced.has(file), true, `${label} page should embed ${file}.`);
    }
  }

  const imageRoot = path.join(docsRoot, 'src', 'content', 'docs', 'img', 'quick-start', 'wizard-setup');
  for (const file of expectedScreenshots) {
    await readFile(path.join(imageRoot, file));
  }
});
