# HagiCode Documentation

[简体中文](./README_cn.md)

Standalone HagiCode documentation site, built with Astro and Starlight.

## Repository Structure

```
docs/
├── src/
│   ├── content/docs/    # Documentation content (Markdown and MDX files)
│   │   └── blog/        # Blog articles
│   ├── components/      # Custom UI components
│   ├── config/          # Navigation and configuration
│   ├── integrations/    # Astro integrations
│   ├── pages/           # Pages
│   ├── styles/          # Style files
│   └── utils/           # Utility functions
├── public/              # Static assets (images, icons, etc.)
├── .github/workflows/   # CI/CD workflows
├── astro.config.mjs     # Astro configuration
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── illustration-management.md  # Image management guide
```

## Quick Start

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

The documentation site will start at http://localhost:31265.

### Build

```bash
npm run build
```

Build output will be generated in the `dist/` directory.

### External Link Cache Validation

`npm run build` still validates internal links and static assets; only when `CI=true` will the build additionally enable external link result caching under `.tmp/link-check-cache/`.

- Successful and unexpired external link cache will be reused directly, avoiding duplicate network requests to the same URL.
- New links, expired records, schema incompatible records, and URLs that failed last time will all re-execute real-time validation and refresh the cache.
- Default TTL is 48 hours, can be overridden via `DOCS_LINK_CHECK_CACHE_TTL_HOURS`; when cache schema is upgraded, old records are automatically ignored and regenerated.
- GitHub Actions will restore `.tmp/link-check-cache/` before docs build, then save new snapshots with rolling keys after build; the directory stays in the local temporary directory and does not enter version control.

To simulate CI external link checks and validate log summaries locally, use:

```bash
CI=true NODE_ENV=production npm run build
npm run test:link-check-cache
```

To force discard old cache, delete `repos/docs/.tmp/link-check-cache/`, or upgrade the cache schema version when implementing changes.

### Homepage and docs/blog Default Path Language Rules

- When accessing `https://docs.hagicode.com/` by default, the homepage entry language is resolved based on `query > saved preference > client language > default English`.
- Without explicit language and without saved preference, the root path `/` will first read the browser language: Chinese clients stay at `/`, English or unrecognized languages will jump to `/en/` as early as possible.
- Docs content pages and blog default prefix-less paths (like `/product-overview/`, `/blog/`) resolve based on `query > saved preference > default English`: they will automatically enter the corresponding `/en/...` path when there's no explicit Chinese signal.
- Explicit `?lang=zh-CN` or saved Chinese preference still preserves prefix-less Chinese docs/blog paths; thus entering from the Chinese homepage keeps subsequent Chinese document flow at root path.
- `/en/` and `/en/blog/` remain stable English landing/blog entry points; this change continues to not reverse the directory semantics of `src/content/docs/**` and `src/content/docs/en/**`.

Recommended to run entry validation after build:

```bash
npm run build:verify-docs-entry-language
```

This validation checks: browser language routing on first homepage visit, English defaults for `/product-overview/` and `/blog/`, explicit `?lang=zh-CN` Chinese override, invalid language fallback, and `/en/` `/en/blog/` stability.

### Managing Documentation Screenshot Metadata

Product screenshot maintenance now has two commands:

- `npm run screenshots:scan-metadata`: Read-only scan any screenshot directory, output basic metadata report, suitable for CI, local盘点, and pre-sync inspection
- `npm run screenshots:sync`: Import staging screenshots into `src/content/docs/img/screenshots/`, call imgbin to generate managed metadata and rebuild manifest

The repository keeps `screenshot-staging/.gitkeep` to ensure the initial staging directory can be committed; successfully imported screenshot source files are automatically removed from staging directory, failed items are kept for retry.

Recommended staging layout:

```text
repos/docs/
├── screenshot-staging/
│   ├── installation/
│   │   └── desktop-start.png
│   └── shared/
│       └── settings-license-success.png
└── src/content/docs/img/screenshots/
    └── manifest.json
```

First do read-only metadata盘点:

```bash
npm run screenshots:scan-metadata -- --input ./screenshot-staging --output ./artifacts/screenshot-report.json
```

The JSON structure of the scan report is fixed:

```json
{
  "summary": {
    "generatedAt": "2026-03-14T09:30:00.000Z",
    "inputDirectory": "screenshot-staging",
    "outputPath": "artifacts/screenshot-report.json",
    "supportedExtensions": [".jpg", ".jpeg", ".png", ".webp"],
    "scannedFileCount": 3,
    "successCount": 3,
    "failureCount": 0
  },
  "entries": [...],
  "failures": []
}
```

Then run the import sync command:

```bash
npm run screenshots:sync
```

The default ImgBin analysis context file is at `repos/docs/prompts/screenshot-analysis-context.txt`. `screenshots:sync` resolves it with the following priority locally and in CI:

1. `--analysis-context-file <path>`
2. `SCREENSHOT_ANALYSIS_CONTEXT_FILE`
3. Repository default file `./prompts/screenshot-analysis-context.txt`

The script will validate the file exists and is non-empty after trimming before actually calling ImgBin; if the context file is missing or empty, it will fail directly and output the corresponding path, avoiding configuration issues halfway through batch import.

Common parameters:

- `screenshots:scan-metadata --input <dir>`: Specify read-only scan directory, default `screenshot-staging`
- `screenshots:scan-metadata --output <path>`: Write JSON report to file, also output same structure to stdout
- `--input <dir>`: Specify screenshot staging root directory
- `--library-root <dir>`: Specify managed screenshot root directory, default `src/content/docs/img/screenshots`
- `--manifest <path>`: Specify manifest output file, default `src/content/docs/img/screenshots/manifest.json`
- `--imgbin <path>`: Explicitly specify imgbin CLI; defaults to `@hagicode/imgbin` installed in `repos/docs`, otherwise falls back to `../imgbin/dist/cli.js`
- `--category <name>`: Force all screenshots to use the same category
- `--analysis-context-file <path>`: Override default ImgBin analysis context file
- `--analysis-prompt <path>`: Additional custom analysis prompt; does not replace context file
- `--dry-run`: Only preview scan and target paths, do not write any files
- `--reindex`: Rebuild imgbin search index after import

Environment variables:

```bash
IMGBIN_EXECUTABLE=../imgbin/dist/cli.js
SCREENSHOT_STAGING_DIR=./screenshot-staging
SCREENSHOT_LIBRARY_ROOT=./src/content/docs/img/screenshots
SCREENSHOT_MANIFEST_PATH=./src/content/docs/img/screenshots/manifest.json
SCREENSHOT_ANALYSIS_CONTEXT_FILE=./prompts/screenshot-analysis-context.txt
SCREENSHOT_ANALYSIS_PROMPT=./prompts/custom-analysis-prompt.txt
```

If these variables are already written to `repos/docs/.env`, then `npm run screenshots:sync` will automatically read them and automatically create `.tmp` as the import transit directory when `TMPDIR`, `TMP`, `TEMP` are not explicitly set. By default, the command will first call `@hagicode/imgbin` installed in `repos/docs` and automatically load `./prompts/screenshot-analysis-context.txt`.

### Automatic Image Compression

`repos/docs` has enabled repository-level GitHub Actions image compression workflow. As long as commits or merges include the following bitmap formats, the repository will automatically attempt compression after commit:

- `png`
- `jpg`
- `jpeg`
- `webp`

This automation covers common image directories in the docs repository:

- `src/content/docs/img/**`
- `src/content/docs/img/screenshots/**`
- `public/img/**`

Behavior notes:

- `pull_request`, push to `main`, manual trigger, and scheduled tasks all run the `Compress images` workflow
- Compression happens in GitHub Actions, not a required local step before `npm run build`
- Non-target formats like `svg`, `gif`, JSON metadata, prompt files continue to be manually maintained per existing process
- Non-PR events that detect compressible results will automatically create an `Auto Compress Images` PR to flow back to the repository

When maintaining `screenshot-analysis-context.txt`, recommend only writing "long-term stable, cross-screenshot valid" semantics, such as page type, common button forms, bilingual interface clues, installation/configuration/session/confirmation success workflow semantics. Do not put one-time troubleshooting notes, temporary ticket explanations, guesses that only apply to single screenshots, model vendor-specific hacks, or version number lists into this file; these contents are more suitable for single command parameters, change descriptions, or separate experimental prompts.

Behavior conventions:

1. Supports four screenshot formats: `png`, `jpg`, `jpeg`, `webp`.
2. `screenshots:scan-metadata` is read-only scan, does not move files, does not call imgbin, does not refresh manifest; it's suitable for confirming dimensions, timestamps, and bad images before actual sync.
3. Category is derived from staging subdirectory by default; if screenshots are placed directly in staging root, they will enter `shared/` category.
4. Filenames are normalized to stable slug; if duplicate screenshots appear under the same category, a hash suffix based on relative path is automatically appended to ensure repeated execution does not produce ambiguous directories.
5. Existing managed screenshot directories are reused and refreshed with `original.*` and `metadata.json`, will not generate uncontrolled `-2`, `-3` duplicate directories.
6. Successfully processed screenshots are automatically removed from staging directory; failed screenshots remain in place for troubleshooting and retry.
7. Single screenshot failure during batch processing does not roll back already successful imports; command continues processing remaining files and reports failure count with non-zero exit code for CI/CD detection.
8. `screenshots:sync` automatically reads `repos/docs/.env` and automatically creates `.tmp` as working directory when `TMPDIR`, `TMP`, `TEMP` are not explicitly set.
9. `screenshots:sync` prints the analysis context file to be used at startup, making it easy to confirm in CI logs whether it hit the default path or explicit override.
10. `screenshots:sync` may only print startup info during imgbin analysis or batch import phase, appearing to "start but not move yet"; at this point prioritize running `screenshots:scan-metadata` for pre-inspection to confirm file set and basic metadata are fine before continuing sync.
11. Every successful run rebuilds `src/content/docs/img/screenshots/manifest.json` and refreshes the imgbin search index under the library for subsequent retrieval by title, tags, description, and source path.

Documentation side references can read the manifest via `src/utils/screenshot-manifest.js`, then generate Markdown/MDX usable relative image addresses based on current documentation path.

### Preview Build Results

```bash
npm run preview
```

## Contributing Guide

### Editing Documentation

Documentation content is located in the `src/content/docs/` directory. After editing Markdown files, changes will automatically reflect in the development server.

### Maintaining "LLM Guide" Category

`src/content/docs/llm-guide/` and `src/content/docs/en/llm-guide/` are used to maintain model comparison documentation. Please follow these constraints when updating:

1. When updating evaluation conclusions, synchronize update "test time and scenario description".
2. Chinese and English pages maintain the same chapter skeleton to avoid language switch information inconsistency.
3. Model entries must include at least: model name, test time, code quality rating, cost-effectiveness rating.
4. Recommend reviewing monthly; if model capabilities or prices change significantly, should immediately supplement updates.

### Adding Blog Articles

1. Create new file in `src/content/docs/blog/`
2. Use date prefix naming (e.g., `2026-02-21-my-post.mdx`)
3. Add frontmatter metadata
4. Treat frontmatter `title` as the only page-level H1; start the body at `##`/`###` and do not add Markdown `#` headings inside the article body.

### Adding Static Assets

Put images and other static files in the `public/` directory. They will be copied to the root of `dist/` during build.

### Blog Multilingual and Ad Display Maintenance

When adjusting `src/components/StarlightHeader.astro`, `src/components/MarkdownContent.astro`, `src/components/BlogHeaderAd.astro`, `src/components/BlogFooterAd.astro`, please synchronously check:

1. Locale resolution chain stays consistent: `Astro.currentLocale` -> `starlightRoute.locale` -> `root`.
2. Blog navigation has non-empty copy in both Chinese and English build artifacts (`博客` / `Blog`).
3. StarlightAd header/footer ad area titles, descriptions, CTA copy are non-empty in build artifacts.
4. After language switch, Blog routes stay continuous (root Chinese path and `/en/blog/` English path can switch to each other).

Recommended to run post-build validation:

```bash
npm run build:verify-blog
# Or only verify built artifacts
npm run verify:blog
```

### StarlightAd Online Visibility Troubleshooting

If "ad square visible but text not visible" appears online, prioritize check:

1. **Missing theme variables**: Confirm `--color-primary`, `--color-secondary`, `--sl-color-text-high` are resolvable under target theme.
2. **Style cascade overriding text color**: Check if `color: transparent`, `-webkit-text-fill-color: transparent` or high-priority overrides exist.
3. **Build difference**: Compare local `dist/` with online page rendering results, confirm ad text nodes exist and are non-empty in build artifacts.
4. **Empty content source**: Confirm `public/presets/claude-code/providers/*.json` `promotion` field is complete, or fallback copy renders normally.

### Post-launch Sampling Checklist

Recommend sampling and checking the following pages and items after each release:

1. `https://docs.hagicode.com/blog/`: First visit without preference should automatically enter English blog; if Chinese preference is saved, Chinese path is preserved.
2. `https://docs.hagicode.com/en/blog/`: Navigation copy shows English and can return to Chinese path.
3. Any Chinese blog detail page: Top/bottom ad title, description, button copy visible.
4. Click language switch on any Chinese blog detail page: Route and copy switch behavior meets expectations.
5. If fallback copy found: Confirm if it's due to missing translation and record follow-up supplement plan.

## CI/CD

Documentation is automatically deployed to Azure Static Web Apps via GitHub Actions.

- Push to `main` branch triggers deployment
- Pull Requests trigger build validation
- Image-related `png`, `jpg`, `jpeg`, `webp` changes also trigger separate `Compress images` workflow
- This workflow performs compression after commit in repository, does not replace local screenshot metadata or documentation build process

## Related Resources

- [Astro Documentation](https://docs.astro.build)
- [Starlight Documentation](https://starlight.astro.build)
- [Illustration Management Guide](./illustration-management.md)
