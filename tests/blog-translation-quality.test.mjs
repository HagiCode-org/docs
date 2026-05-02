import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import assert from 'node:assert/strict';
import test from 'node:test';

import { generateTranslationQualityReport } from '../scripts/verify-blog-translation-quality.mjs';

async function withFixture(fn) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-translation-quality-test-'));
  try {
    return await fn(tmpDir);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function writePost(tmpDir, locale, slug, content) {
  const blogDir = locale === 'root' ? 'blog' : locale === 'en' ? 'en/blog' : `${locale}/blog`;
  const fullPath = path.join(tmpDir, blogDir);
  await fs.mkdir(fullPath, { recursive: true });
  const filePath = path.join(fullPath, `${slug}.mdx`);
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

const EN_POST = `---
title: "Getting Started with Docker"
date: 2026-01-15
truncate: true
englishSlug: getting-started-with-docker
tags: [Docker, DevOps, Containers]
description: "Learn the basics of Docker and containerization."
---

# Getting Started with Docker

Docker is a platform for building and running containers.

## Installation

Install Docker with the following command:

\`\`\`bash
sudo apt-get install docker-ce
\`\`\`

## Running a Container

To run a container:

\`\`\`bash
docker run -d -p 8080:80 nginx
\`\`\`

> Docker simplifies deployment workflows.
`;

const JA_POST = `---
title: "Docker入門ガイド"
date: 2026-01-15
truncate: true
englishSlug: getting-started-with-docker
tags: [Docker, DevOps, Containers]
description: "Dockerとコンテナ化の基本を学びましょう。"
---

# Docker入門ガイド

Dockerはコンテナの構築と実行のためのプラットフォームです。

## インストール

以下のコマンドでDockerをインストールします：

\`\`\`bash
sudo apt-get install docker-ce
\`\`\`

## コンテナの実行

コンテナを実行するには：

\`\`\`bash
docker run -d -p 8080:80 nginx
\`\`\`

> Dockerはデプロイワークフローを簡素化します。
`;

const EN_POST_NO_CODE = `---
title: "Hello World"
date: 2026-01-15
truncate: true
englishSlug: hello-world
tags: [General]
description: "A simple hello world post."
---

# Hello World

This is a simple post with no code blocks.

## Section One

Some text here.

## Section Two

More text here.
`;

test('passes when all posts are genuinely translated', async () => {
  await withFixture(async (tmpDir) => {
    await writePost(tmpDir, 'root', 'getting-started-with-docker', EN_POST);
    await writePost(tmpDir, 'ja-JP', 'getting-started-with-docker', JA_POST);
    await writePost(tmpDir, 'de-DE', 'getting-started-with-docker', JA_POST.replace(/Docker/g, 'Docker').replace(/コンテナ/g, 'Container').replace(/インストール/g, 'Installation').replace(/実行/g, 'Ausführung'));

    const report = await generateTranslationQualityReport({ contentRoot: tmpDir, reportPath: null, locale: 'ja-JP' });
    assert.equal(report.summary.totalPosts, 1);
    assert.equal(report.summary.localesChecked, 1);
    assert.equal(report.findings.length, 0);
  });
});

test('detects English duplicate body content', async () => {
  await withFixture(async (tmpDir) => {
    await writePost(tmpDir, 'root', 'getting-started-with-docker', EN_POST);
    await writePost(tmpDir, 'de-DE', 'getting-started-with-docker', EN_POST);

    const report = await generateTranslationQualityReport({ contentRoot: tmpDir, reportPath: null });
    const duplicateFindings = report.findings.filter((f) => f.check === 'base-duplicate');
    assert.equal(duplicateFindings.length, 1);
    assert.equal(duplicateFindings[0].locale, 'de-DE');
    assert.equal(duplicateFindings[0].severity, 'error');
    assert.ok(duplicateFindings[0].similarity >= 0.85);
  });
});

test('detects untranslated frontmatter title', async () => {
  await withFixture(async (tmpDir) => {
    const sameTitlePost = `---
title: "Getting Started with Docker"
date: 2026-01-15
truncate: true
englishSlug: getting-started-with-docker
tags: [Docker, DevOps, Containers]
description: "Dockerとコンテナ化の基本を学びましょう。"
---

# Docker入門ガイド

Dockerはコンテナの構築と実行のためのプラットフォームです。
`;
    await writePost(tmpDir, 'root', 'getting-started-with-docker', EN_POST);
    await writePost(tmpDir, 'ja-JP', 'getting-started-with-docker', sameTitlePost);

    const report = await generateTranslationQualityReport({ contentRoot: tmpDir, reportPath: null });
    const titleFindings = report.findings.filter((f) => f.check === 'untranslated-title');
    assert.equal(titleFindings.length, 1);
    assert.equal(titleFindings[0].locale, 'ja-JP');
    assert.equal(titleFindings[0].severity, 'warning');
  });
});

test('detects untranslated frontmatter description', async () => {
  await withFixture(async (tmpDir) => {
    const sameDescPost = `---
title: "Docker入門ガイド"
date: 2026-01-15
truncate: true
englishSlug: getting-started-with-docker
tags: [Docker, DevOps, Containers]
description: "Learn the basics of Docker and containerization."
---

# Docker入門ガイド

Dockerはコンテナの構築と実行のためのプラットフォームです。
`;
    await writePost(tmpDir, 'root', 'getting-started-with-docker', EN_POST);
    await writePost(tmpDir, 'ja-JP', 'getting-started-with-docker', sameDescPost);

    const report = await generateTranslationQualityReport({ contentRoot: tmpDir, reportPath: null });
    const descFindings = report.findings.filter((f) => f.check === 'untranslated-description');
    assert.equal(descFindings.length, 1);
    assert.equal(descFindings[0].locale, 'ja-JP');
    assert.equal(descFindings[0].severity, 'warning');
  });
});

test('detects mismatched code blocks', async () => {
  await withFixture(async (tmpDir) => {
    const diffCodePost = `---
title: "Docker入門ガイド"
date: 2026-01-15
truncate: true
englishSlug: getting-started-with-docker
tags: [Docker, DevOps, Containers]
description: "Dockerとコンテナ化の基本を学びましょう。"
---

# Docker入門ガイド

## インストール

\`\`\`bash
brew install docker
\`\`\`

## コンテナの実行

\`\`\`bash
docker run -d -p 8080:80 nginx
\`\`\`
`;
    await writePost(tmpDir, 'root', 'getting-started-with-docker', EN_POST);
    await writePost(tmpDir, 'ja-JP', 'getting-started-with-docker', diffCodePost);

    const report = await generateTranslationQualityReport({ contentRoot: tmpDir, reportPath: null });
    const codeFindings = report.findings.filter((f) => f.check === 'code-block-mismatch');
    assert.ok(codeFindings.length >= 1);
  });
});

test('detects missing code blocks', async () => {
  await withFixture(async (tmpDir) => {
    const missingCodePost = `---
title: "Docker入門ガイド"
date: 2026-01-15
truncate: true
englishSlug: getting-started-with-docker
tags: [Docker, DevOps, Containers]
description: "Dockerとコンテナ化の基本を学びましょう。"
---

# Docker入門ガイド

Dockerはコンテナの構築と実行のためのプラットフォームです。
`;
    await writePost(tmpDir, 'root', 'getting-started-with-docker', EN_POST);
    await writePost(tmpDir, 'ja-JP', 'getting-started-with-docker', missingCodePost);

    const report = await generateTranslationQualityReport({ contentRoot: tmpDir, reportPath: null });
    const countFindings = report.findings.filter((f) => f.check === 'code-block-count-mismatch');
    assert.equal(countFindings.length, 1);
    assert.equal(countFindings[0].expectedCount, 2);
    assert.equal(countFindings[0].actualCount, 0);
  });
});

test('reports coverage per locale', async () => {
  await withFixture(async (tmpDir) => {
    await writePost(tmpDir, 'root', 'post-a', EN_POST);
    await writePost(tmpDir, 'root', 'post-b', EN_POST_NO_CODE);
    await writePost(tmpDir, 'ja-JP', 'post-a', JA_POST);
    await writePost(tmpDir, 'de-DE', 'post-a', EN_POST);
    await writePost(tmpDir, 'de-DE', 'post-b', EN_POST_NO_CODE);

    const report = await generateTranslationQualityReport({ contentRoot: tmpDir, reportPath: null });
    assert.equal(report.locales.length, 8);

    const jaReport = report.locales.find((l) => l.code === 'ja-JP');
    assert.equal(jaReport.totalPosts, 2);
    assert.equal(jaReport.checked, 1);
    assert.equal(jaReport.coverage, 50);

    const deReport = report.locales.find((l) => l.code === 'de-DE');
    assert.equal(deReport.totalPosts, 2);
    assert.equal(deReport.checked, 2);
  });
});

test('handles posts with no code blocks gracefully', async () => {
  await withFixture(async (tmpDir) => {
    const noCodeTranslation = `---
title: "Hello World"
date: 2026-01-15
truncate: true
englishSlug: hello-world
tags: [General]
description: "A simple hello world post."
---

# Hello World

This is a translated post with no code blocks.

## Section One

Some translated text here.

## Section Two

More translated text here.
`;
    await writePost(tmpDir, 'root', 'hello-world', EN_POST_NO_CODE);
    await writePost(tmpDir, 'ja-JP', 'hello-world', noCodeTranslation);

    const report = await generateTranslationQualityReport({ contentRoot: tmpDir, reportPath: null });
    const codeFindings = report.findings.filter(
      (f) => f.check === 'code-block-mismatch' || f.check === 'code-block-count-mismatch',
    );
    assert.equal(codeFindings.length, 0);
  });
});

test('handles code blocks with special characters', async () => {
  await withFixture(async (tmpDir) => {
    const specialCodeEn = `---
title: "Regex Guide"
date: 2026-01-15
truncate: true
englishSlug: regex-guide
tags: [Regex]
description: "A guide to regular expressions."
---

# Regex Guide

\`\`\`regex
^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$
\`\`\`

\`\`\`bash
echo 'Hello \\'World\\''
\`\`\`
`;

    const specialCodeJa = `---
title: "正規表現ガイド"
date: 2026-01-15
truncate: true
englishSlug: regex-guide
tags: [Regex]
description: "正規表現のガイド。"
---

# 正規表現ガイド

\`\`\`regex
^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$
\`\`\`

\`\`\`bash
echo 'Hello \\'World\\''
\`\`\`
`;
    await writePost(tmpDir, 'root', 'regex-guide', specialCodeEn);
    await writePost(tmpDir, 'ja-JP', 'regex-guide', specialCodeJa);

    const report = await generateTranslationQualityReport({ contentRoot: tmpDir, reportPath: null });
    const codeFindings = report.findings.filter(
      (f) => f.check === 'code-block-mismatch' || f.check === 'code-block-count-mismatch',
    );
    assert.equal(codeFindings.length, 0);
  });
});

test('writes JSON report when reportPath is specified', async () => {
  await withFixture(async (tmpDir) => {
    const reportPath = path.join(tmpDir, 'report.json');
    await writePost(tmpDir, 'root', 'getting-started-with-docker', EN_POST);
    await writePost(tmpDir, 'ja-JP', 'getting-started-with-docker', JA_POST);

    const report = await generateTranslationQualityReport({ contentRoot: tmpDir, reportPath });
    assert.ok(report.outputPath);
    assert.ok(report.outputPath.endsWith('report.json'));

    const written = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    assert.equal(written.summary.totalPosts, 1);
    assert.ok('findings' in written);
  });
});
