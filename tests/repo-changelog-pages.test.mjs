import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('docs sidebar config exposes the localized changelog group', async () => {
  const astroConfig = await readFile(path.join(docsRoot, 'astro.config.mjs'), 'utf8');

  assert.match(astroConfig, /label:\s*"变更日志"/);
  assert.match(astroConfig, /translations:\s*\{\s*en:\s*"Changelog"\s*\}/);
  assert.match(astroConfig, /autogenerate:\s*\{\s*directory:\s*"changelog"\s*\}/);
});

test('changelog pages exist for core, web, and desktop in both locales', async () => {
  const pageExpectations = [
    {
      filePath: path.join(docsRoot, 'src', 'content', 'docs', 'changelog', 'core.mdx'),
      repoLabel: 'Core',
      locale: 'zh-CN',
      jsonFile: 'core.json',
    },
    {
      filePath: path.join(docsRoot, 'src', 'content', 'docs', 'changelog', 'web.mdx'),
      repoLabel: 'Web',
      locale: 'zh-CN',
      jsonFile: 'web.json',
    },
    {
      filePath: path.join(docsRoot, 'src', 'content', 'docs', 'changelog', 'desktop.mdx'),
      repoLabel: 'Desktop',
      locale: 'zh-CN',
      jsonFile: 'desktop.json',
    },
    {
      filePath: path.join(docsRoot, 'src', 'content', 'docs', 'en', 'changelog', 'core.mdx'),
      repoLabel: 'Core',
      locale: 'en',
      jsonFile: 'core.json',
    },
    {
      filePath: path.join(docsRoot, 'src', 'content', 'docs', 'en', 'changelog', 'web.mdx'),
      repoLabel: 'Web',
      locale: 'en',
      jsonFile: 'web.json',
    },
    {
      filePath: path.join(docsRoot, 'src', 'content', 'docs', 'en', 'changelog', 'desktop.mdx'),
      repoLabel: 'Desktop',
      locale: 'en',
      jsonFile: 'desktop.json',
    },
  ];

  for (const page of pageExpectations) {
    await access(page.filePath);
    const content = await readFile(page.filePath, 'utf8');

    assert.match(content, /RepoChangelogPage/);
    assert.match(content, new RegExp(`repoLabel="${page.repoLabel}"`));
    assert.match(content, new RegExp(`locale="${page.locale}"`));
    assert.match(content, new RegExp(page.jsonFile.replace('.', '\\.')));
  }
});

test('shared changelog component keeps grouped release markup and explicit empty-state copy', async () => {
  const componentPath = path.join(docsRoot, 'src', 'components', 'RepoChangelogPage.astro');
  const component = await readFile(componentPath, 'utf8');

  assert.match(component, /function getCanonicalReleaseAnchor/);
  assert.match(component, /replace\(\s*\/\^#\/,\s*''\s*\)/);
  assert.match(component, /replace\(\s*\/\^v\+\/,\s*''\s*\)/);
  assert.match(component, /toLowerCase\(\)/);
  assert.match(component, /data-repo-changelog/);
  assert.match(component, /data-release-filter-select/);
  assert.match(component, /searchParams\.get\('tag'\)/);
  assert.match(component, /location\.hash/);
  assert.match(component, /data-release-anchor-value/);
  assert.match(component, /findCardByHash/);
  assert.match(component, /scrollIntoView\(\{ block: 'start', behavior: 'auto' \}\)/);
  assert.match(component, /focus\(\{ preventScroll: true \}\)/);
  assert.match(component, /data-release-tag-value/);
  assert.match(component, /data-release-block/);
  assert.match(component, /data-commit-item/);
  assert.match(component, /data-changelog-empty/);
  assert.match(component, /:global\(html\[data-theme='dark'\]\) \.repo-changelog/);
  assert.match(component, /--repo-surface/);
  assert.match(component, /scroll-margin-top: clamp\(5\.5rem, 14vh, 8rem\)/);
  assert.match(component, /No adjacent-tag releases yet/);
  assert.match(component, /No commits were collected for this tag window/);
  assert.match(component, /当前数据集少于两个 tag/);
  assert.match(component, /此 Tag 区间未采集到提交/);
  assert.match(component, /release\.tag/);
  assert.match(component, /commit\.title/);
});
