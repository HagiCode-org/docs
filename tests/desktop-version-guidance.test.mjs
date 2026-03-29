import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('obsolete desktop-version maintenance artifacts are removed from docs', async () => {
  await assert.rejects(access(path.join(docsRoot, 'scripts', ['version', 'monitor'].join('-') + '.js')));
  await assert.rejects(access(path.join(docsRoot, 'shared', 'src', 'version.ts')));
  await assert.rejects(access(path.join(docsRoot, '.github', 'workflows', ['version', 'monitor'].join('-') + '.yml')));
});

test('shared index no longer re-exports the retired local version helper', async () => {
  const content = await readFile(path.join(docsRoot, 'shared', 'src', 'index.ts'), 'utf8');
  assert.doesNotMatch(content, /export\s+\*\s+from\s+['"]\.\/version['"]/);
});

test('repository guidance keeps runtime fetch as primary and version-index as fallback detail', async () => {
  const readme = await readFile(path.join(docsRoot, 'README.md'), 'utf8');
  const readmeCn = await readFile(path.join(docsRoot, 'README_cn.md'), 'utf8');

  assert.match(readme, /fetched at runtime/i);
  assert.match(readme, /https:\/\/index\.hagicode\.com\/desktop\/history\//i);
  assert.match(readme, /public\/version-index\.json/);
  assert.match(readme, /offline fallback/i);
  assert.match(readme, /repos\/index`?\s+remains a referenced dependency only/i);

  assert.match(readmeCn, /运行时.*拉取/);
  assert.match(readmeCn, /https:\/\/index\.hagicode\.com\/desktop\/history\//);
  assert.match(readmeCn, /public\/version-index\.json/);
  assert.match(readmeCn, /离线 fallback/);
  assert.match(readmeCn, /仅作为被引用依赖/);
});
