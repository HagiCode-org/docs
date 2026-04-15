import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(testDir, '..');

function resolveDocsPath(relativePath) {
  return path.join(docsRoot, relativePath);
}

async function readDoc(relativePath) {
  return readFile(resolveDocsPath(relativePath), 'utf8');
}

function assertFrontmatterValue(source, key, expectedValue) {
  const pattern = new RegExp(`^${key}:\\s*${expectedValue.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'm');
  assert.match(source, pattern);
}

test('root locale legal docs include required frontmatter and section headings', async () => {
  const eula = await readDoc('src/content/docs/legal/eula.mdx');
  const privacyPolicy = await readDoc('src/content/docs/legal/privacy-policy.mdx');

  assert.match(eula, /^---[\s\S]*title: 终端用户许可协议（EULA）/m);
  assertFrontmatterValue(eula, 'sidebar_label', 'EULA');
  assertFrontmatterValue(eula, 'sidebar_position', '10');
  assert.match(eula, /^生效日期：2026-04-15$/m);
  assert.match(eula, /^## 许可授予$/m);
  assert.match(eula, /^## 使用限制$/m);
  assert.match(eula, /^## 免责声明$/m);
  assert.match(eula, /^## 责任限制$/m);
  assert.match(eula, /^## 联系方式$/m);
  assert.match(eula, /support@hagicode\.com/);

  assert.match(privacyPolicy, /^---[\s\S]*title: 隐私政策/m);
  assertFrontmatterValue(privacyPolicy, 'sidebar_label', '隐私政策');
  assertFrontmatterValue(privacyPolicy, 'sidebar_position', '20');
  assert.match(privacyPolicy, /^生效日期：2026-04-15$/m);
  assert.match(privacyPolicy, /^## 我们收集的信息类型$/m);
  assert.match(privacyPolicy, /^## 数据使用目的$/m);
  assert.match(privacyPolicy, /^## 存储与保留$/m);
  assert.match(privacyPolicy, /^## 用户权利$/m);
  assert.match(privacyPolicy, /^## 联系方式$/m);
  assert.match(privacyPolicy, /support@hagicode\.com/);
});

test('english legal docs stay aligned to the localized legal routes and required sections', async () => {
  const eula = await readDoc('src/content/docs/en/legal/eula.mdx');
  const privacyPolicy = await readDoc('src/content/docs/en/legal/privacy-policy.mdx');

  assert.match(eula, /^---[\s\S]*title: End User License Agreement \(EULA\)/m);
  assertFrontmatterValue(eula, 'sidebar_label', 'EULA');
  assertFrontmatterValue(eula, 'sidebar_position', '10');
  assert.match(eula, /^Effective date: 2026-04-15$/m);
  assert.match(eula, /^## License Grant$/m);
  assert.match(eula, /^## Usage Restrictions$/m);
  assert.match(eula, /^## Disclaimer$/m);
  assert.match(eula, /^## Liability Limitation$/m);
  assert.match(eula, /^## Contact$/m);
  assert.match(eula, /support@hagicode\.com/);

  assert.match(privacyPolicy, /^---[\s\S]*title: Privacy Policy/m);
  assertFrontmatterValue(privacyPolicy, 'sidebar_label', 'Privacy Policy');
  assertFrontmatterValue(privacyPolicy, 'sidebar_position', '20');
  assert.match(privacyPolicy, /^Effective date: 2026-04-15$/m);
  assert.match(privacyPolicy, /^## Categories of Information We Collect$/m);
  assert.match(privacyPolicy, /^## Purposes of Use$/m);
  assert.match(privacyPolicy, /^## Storage and Retention$/m);
  assert.match(privacyPolicy, /^## User Rights$/m);
  assert.match(privacyPolicy, /^## Contact$/m);
  assert.match(privacyPolicy, /support@hagicode\.com/);
});
