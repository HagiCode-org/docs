import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const docsRoot = path.resolve(import.meta.dirname, '..');

const CASES = [
  {
    file: 'src/i18n/locales/zh-CN/starlight.yml',
    type: 'yaml',
    minLength: 36,
  },
  {
    file: 'src/i18n/locales/en-US/starlight.yml',
    type: 'yaml',
    minLength: 90,
  },
  {
    file: 'src/content/docs/blog/2026-04-28-why-hagicode-chose-execa-for-cli-execution.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/blog/2026-05-06-github-actions-multi-platform-code-server-omniroute.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/blog/2026-05-07-chat-image-upload-ai-recognition.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/blog/2026-05-09-steamworks-multilingual-metadata-management.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/blog/2026-05-20-windows-app-automation-to-microsoft-store.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/fr-FR/blog/2026-05-11-opencode-integration.mdx',
    type: 'frontmatter',
    minLength: 90,
  },
  {
    file: 'src/content/docs/installation/desktop.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/release-notes/index.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/llm-guide/index.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/guides/ai-compose-commit.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/installation/docker-compose.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/guides/voice-recognition/doubao.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/llm-guide/model-comparison-evaluation.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/related-software-installation/nodejs/installation.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/ai-service-subscriptions/zai.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/docs/ai-service-subscriptions/aliyun.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/translations/docs/en-US/installation/desktop.mdx',
    type: 'frontmatter',
    minLength: 90,
  },
  {
    file: 'src/content/translations/docs/en-US/blog/2026-01-22-github-issues-集成.mdx',
    type: 'frontmatter',
    minLength: 90,
  },
  {
    file: 'src/content/translations/docs/en-US/blog/2026-01-26-docusaurus-auto-deployment-with-github-actions.mdx',
    type: 'frontmatter',
    minLength: 90,
  },
  {
    file: 'src/content/translations/docs/en-US/blog/2026-01-26-modern-build-system-with-csharp-and-nuke.mdx',
    type: 'frontmatter',
    minLength: 90,
  },
  {
    file: 'src/content/translations/docs/en-US/blog/2026-03-13-primary-profession-management.mdx',
    type: 'frontmatter',
    minLength: 90,
  },
  {
    file: 'src/content/translations/docs/ja-JP/guides/monospecs.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
  {
    file: 'src/content/translations/docs/ja-JP/release-notes/index.mdx',
    type: 'frontmatter',
    minLength: 36,
  },
];

function extractFrontmatterDescription(source) {
  const match = source.match(/^description:\s*(.*)$/m);
  if (!match) {
    return '';
  }

  const value = match[1].trim();
  if (
    value.length >= 2
    && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function extractYamlDescription(source) {
  const match = source.match(/^\s*description:\s*(.*)$/m);
  return match?.[1]?.trim() ?? '';
}

function textLength(value) {
  return Array.from(value).length;
}

test('confirmed docs SEO descriptions remain non-empty and non-trivial', async (t) => {
  for (const entry of CASES) {
    await t.test(entry.file, () => {
      const fullPath = path.join(docsRoot, entry.file);
      const source = fs.readFileSync(fullPath, 'utf8');
      const description = entry.type === 'yaml'
        ? extractYamlDescription(source)
        : extractFrontmatterDescription(source);
      const length = textLength(description);

      assert.notEqual(description, '', 'description should not be empty');
      assert.ok(
        length >= entry.minLength,
        `description length ${length} is shorter than expected minimum ${entry.minLength}`,
      );
    });
  }
});
