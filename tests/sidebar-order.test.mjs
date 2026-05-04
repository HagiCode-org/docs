import assert from 'node:assert/strict';
import test from 'node:test';

import { DOCS_SIDEBAR } from '../src/config/sidebar.ts';
import { DOCS_LOCALE_SELECTOR_OPTIONS } from '../src/i18n/generated/docs-locale-resources.mjs';

test('release-notes entry stays immediately before DLC with localized labels intact', () => {
  const releaseNotesEntries = DOCS_SIDEBAR.filter((entry) => entry.link === '/release-notes');
  assert.equal(releaseNotesEntries.length, 1);

  const releaseNotesIndex = DOCS_SIDEBAR.findIndex((entry) => entry.link === '/release-notes');
  const dlcIndex = DOCS_SIDEBAR.findIndex((entry) => entry.label === 'DLC');
  const releaseNotesEntry = DOCS_SIDEBAR[releaseNotesIndex];

  assert.ok(releaseNotesIndex >= 0);
  assert.ok(dlcIndex >= 0);
  assert.equal(releaseNotesEntry?.label, '版本更新说明');
  assert.equal(releaseNotesEntry?.translations?.['en-US'], 'Release Notes');
  assert.equal(dlcIndex, releaseNotesIndex + 1);
  assert.equal(DOCS_SIDEBAR[0]?.link, '/product-overview');
});

test('legal docs are exposed as a docs library section before release notes', () => {
  const legalEntry = DOCS_SIDEBAR.find((entry) => entry.label === '法律文档');
  const releaseNotesIndex = DOCS_SIDEBAR.findIndex((entry) => entry.link === '/release-notes');
  const legalIndex = DOCS_SIDEBAR.findIndex((entry) => entry.label === '法律文档');

  assert.ok(legalEntry);
  assert.equal(legalEntry?.label, '法律文档');
  assert.equal(legalEntry?.translations?.['en-US'], 'Legal');
  assert.ok(legalIndex >= 0);
  assert.ok(releaseNotesIndex >= 0);
  assert.ok(legalIndex < releaseNotesIndex);
});

test('DLC stays after release notes and before Bundles in the top-level docs sections', () => {
  const dlcEntry = DOCS_SIDEBAR.find((entry) => entry.label === 'DLC');
  const dlcIndex = DOCS_SIDEBAR.findIndex((entry) => entry.label === 'DLC');
  const releaseNotesIndex = DOCS_SIDEBAR.findIndex((entry) => entry.link === '/release-notes');
  const bundlesIndex = DOCS_SIDEBAR.findIndex((entry) => entry.label === 'Bundles');

  assert.ok(dlcEntry);
  assert.equal(dlcEntry?.label, 'DLC');
  assert.equal(dlcEntry?.translations?.['en-US'], 'DLC');
  assert.ok(dlcIndex >= 0);
  assert.equal(dlcIndex, releaseNotesIndex + 1);
  assert.equal(bundlesIndex, dlcIndex + 1);
  assert.equal(DOCS_SIDEBAR.at(-1)?.label, 'Bundles');
});

test('all top-level sidebar groups provide translations for every non-root docs locale', () => {
  const requiredLocales = DOCS_LOCALE_SELECTOR_OPTIONS.map((locale) => locale.code).filter(
    (locale) => locale !== 'root',
  );

  for (const entry of DOCS_SIDEBAR) {
    for (const locale of requiredLocales) {
      assert.equal(
        typeof entry.translations?.[locale],
        'string',
        `missing ${locale} translation for ${entry.label}`,
      );
      assert.ok(entry.translations?.[locale]?.trim().length);
    }
  }
});

test('related software installation stays flattened to direct article links', () => {
  const relatedSoftwareEntry = DOCS_SIDEBAR.find((entry) => entry.label === '相关软件安装');

  assert.ok(relatedSoftwareEntry);
  assert.ok(Array.isArray(relatedSoftwareEntry.items));
  assert.equal(relatedSoftwareEntry.items.length, 4);

  for (const item of relatedSoftwareEntry.items) {
    assert.ok('slug' in item, 'expected a direct link item');
    assert.ok(!('items' in item), 'did not expect nested sidebar groups');
  }

  assert.deepEqual(
    relatedSoftwareEntry.items.map((item) => item.slug),
    [
      'related-software-installation/nodejs/installation',
      'related-software-installation/openspec/setup-openspec',
      'related-software-installation/ai-agent-cli',
      'related-software-installation/omniroute',
    ],
  );
});

test('related software installation direct links provide locale-specific labels', () => {
  const relatedSoftwareEntry = DOCS_SIDEBAR.find((entry) => entry.label === '相关软件安装');

  assert.ok(relatedSoftwareEntry);
  assert.ok(Array.isArray(relatedSoftwareEntry.items));

  const nodeJsEntry = relatedSoftwareEntry.items.find(
    (item) => 'slug' in item && item.slug === 'related-software-installation/nodejs/installation',
  );
  const openSpecEntry = relatedSoftwareEntry.items.find(
    (item) => 'slug' in item && item.slug === 'related-software-installation/openspec/setup-openspec',
  );
  const aiAgentCliEntry = relatedSoftwareEntry.items.find(
    (item) => 'slug' in item && item.slug === 'related-software-installation/ai-agent-cli',
  );
  const omniRouteEntry = relatedSoftwareEntry.items.find(
    (item) => 'slug' in item && item.slug === 'related-software-installation/omniroute',
  );

  assert.equal(nodeJsEntry?.label, '安装 Node.js');
  assert.equal(nodeJsEntry?.translations?.['en-US'], 'Installing Node.js');
  assert.equal(nodeJsEntry?.translations?.['ja-JP'], 'Node.jsのインストール');

  assert.equal(openSpecEntry?.translations?.['en-US'], 'Install OpenSpec');
  assert.equal(openSpecEntry?.translations?.['zh-Hant'], '安裝 OpenSpec');

  assert.equal(aiAgentCliEntry?.translations?.['en-US'], 'AI Agent CLI Installation');
  assert.equal(aiAgentCliEntry?.translations?.['ko-KR'], 'AI 에이전트 CLI 설치');

  assert.equal(omniRouteEntry?.translations?.['en-US'], 'OmniRoute Local Installation and Startup Validation');
  assert.equal(omniRouteEntry?.translations?.['fr-FR'], "Installation locale et validation du démarrage d'OmniRoute");
});
