# Screenshot Metadata Workflow

This guide documents the maintainer workflow for importing documentation screenshots into the managed screenshot library under `src/content/docs/img/screenshots/`.

## Purpose

Use `npm run screenshots:scan-metadata` when you want to:

- recursively inventory a screenshot folder without moving files
- capture width, height, timestamps, size, extension, and MIME type in a stable JSON report
- preflight a batch before running the heavier `screenshots:sync` import path
- diagnose whether a staging batch contains corrupted or unsupported image files

Use this workflow when you want to:

- import an existing docs screenshot into the managed screenshot library
- generate `metadata.json` with ImgBin analysis results
- rebuild `src/content/docs/img/screenshots/manifest.json`
- switch Markdown or MDX content to use managed screenshot paths

In short:

- `screenshots:scan-metadata` = read-only inventory and progress-visible preflight
- `screenshots:sync` = managed import, analysis, manifest rebuild, and staging cleanup

## Historical Backlog Scope

The `screenshot-management-optimization` change uses this existing workflow to absorb legacy screenshots into `src/content/docs/img/screenshots/`.

- In scope for this backlog pass:
  - `quick-start/create-project` (`6` screenshots)
  - `quick-start/create-proposal-session` (`26` screenshots)
  - `installation/install-desktop` (`14` screenshots, including `1` currently unreferenced legacy file)
  - `installation/install-postgres-windows` (`11` screenshots)
  - `ai-compose-commit` (`3` screenshots)
  - `monospecs` (`3` screenshots)
- Affected docs pages to re-check after sync:
  - `src/content/docs/quick-start/create-first-project.mdx`
  - `src/content/docs/quick-start/proposal-session.mdx`
  - `src/content/docs/installation/desktop.mdx`
  - `src/content/docs/related-software-installation/postgresql/install-on-windows.mdx`
  - `src/content/docs/guides/ai-compose-commit.mdx`
  - `src/content/docs/guides/monospecs.mdx`
  - `src/content/docs/en/quick-start/create-first-project.mdx`
  - `src/content/docs/en/quick-start/proposal-session.mdx`
  - `src/content/docs/en/installation/desktop.mdx`
  - `src/content/docs/en/related-software-installation/postgresql/install-on-windows.mdx`
  - `src/content/docs/en/guides/ai-compose-commit.mdx`
- Known exception recorded during inventory:
  - Historical inventory found one missing legacy source, `img/ai-compose-commit/✓ 处理完成.png`; `src/content/docs/en/guides/ai-compose-commit.mdx` was switched to text-only confirmation instead of keeping a broken image reference
- Explicitly out of scope for this backlog pass:
  - `src/content/docs/img/product-overview/**` illustrations, which are managed as static documentation artwork rather than screenshot assets

This change does not introduce a new import script, a new metadata rule, or a parallel migration process. It only reuses the current staging/import/review flow documented on this page.

## Backlog Execution Notes

Current execution result for `screenshot-management-optimization`:

- `71` legacy screenshots were imported or refreshed into `src/content/docs/img/screenshots/`
- `13` Markdown or MDX pages were updated to use managed screenshot paths
- `src/content/docs/img/screenshots/manifest.json` now contains `71` published screenshot entries
- All checked `metadata.json` files currently report `status.recognition = succeeded`

Remaining follow-up items after this backlog pass:

- `src/content/docs/img/product-overview/**` illustrations still use legacy paths by design and remain outside the managed screenshot workflow
- `src/content/docs/img/installation/install-desktop/向导01-04，选择配置好的AgentCLI.png` is now preserved as a managed asset for historical completeness, but there is still no active page reference pointing to it

## Preconditions

- Run commands from `repos/docs`
- Ensure `@hagicode/imgbin` is installed in `repos/docs` (recommended), or `repos/imgbin/dist/cli.js` exists as a fallback
- Ensure the `claude` CLI is installed and available in `PATH`
- Ensure `repos/docs/.env` contains valid analysis settings
- Ensure the checked-in ImgBin analysis context file exists at `repos/docs/prompts/screenshot-analysis-context.txt`, unless you plan to override it explicitly

Recommended `repos/docs/.env` keys:

```bash
IMGBIN_ANALYSIS_CLI_PATH=claude
IMGBIN_ANALYSIS_API_MODEL=glm-5
ANTHROPIC_MODEL=glm-5
IMGBIN_ANALYSIS_TIMEOUT_MS=180000
SCREENSHOT_ANALYSIS_CONTEXT_FILE=./prompts/screenshot-analysis-context.txt
```

## Analysis Context File Contract

`screenshots:sync` always resolves an analysis context file before it launches ImgBin recognition. The precedence is deterministic:

1. `--analysis-context-file <path>`
2. `SCREENSHOT_ANALYSIS_CONTEXT_FILE`
3. the checked-in default `./prompts/screenshot-analysis-context.txt`

The command validates the resolved file before any import or refresh work begins. If the file is missing or empty after trimming whitespace, the run fails immediately instead of letting ImgBin fail later in the batch.

Keep the context file focused on durable screenshot semantics:

- common docs screenshot domains such as installation, settings, sessions, project setup, confirmations, and editor-like panels
- bilingual UI clues that remain stable across many screenshots
- evidence-first instructions that tell recognition to trust visible pixels over assumptions

Do not put one-off guidance into the shared context file:

- ticket-specific debugging notes
- temporary campaign wording or branch-specific UI guesses
- assumptions that only apply to one screenshot batch
- model-specific hacks that are likely to become stale

## Directory Layout

Put screenshots into a staging tree that mirrors the intended docs category:

```text
repos/docs/
├── screenshot-staging/
│   └── quick-start/
│       └── create-project/
│           └── step1-click-new-project-button.png
└── src/content/docs/img/screenshots/
    └── quick-start/
        └── create-project/
            └── step1-click-new-project-button/
                ├── original.png
                └── metadata.json
```

Generated manifest:

- `src/content/docs/img/screenshots/manifest.json`

Keep `screenshot-staging/.gitkeep` committed so the default staging directory exists even when the queue is empty.

## Metadata Scan Preflight

Run this before sync when you only need a quick inventory or when you want to confirm the batch is healthy before ImgBin analysis:

```bash
npm run screenshots:scan-metadata -- --input ./screenshot-staging --output ./artifacts/screenshot-report.json
```

Report shape:

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
  "entries": [
    {
      "relativePath": "ai-compose-commit/trigger-button.png",
      "fileName": "trigger-button.png",
      "extension": ".png",
      "mimeType": "image/png",
      "sizeBytes": 290816,
      "createdAt": "2026-03-14T09:00:00.000Z",
      "modifiedAt": "2026-03-14T09:00:00.000Z",
      "width": 1440,
      "height": 900
    }
  ],
  "failures": []
}
```

Expected progress log example:

```text
[screenshots:scan-metadata] starting scan
[screenshots:scan-metadata] input: ./screenshot-staging
[screenshots:scan-metadata] discovered 3 supported screenshot files
[screenshots:scan-metadata] [1/3] scanning ai-compose-commit/trigger-button.png
[screenshots:scan-metadata] [1/3] ok 1440x900 284 KB
[screenshots:scan-metadata] [2/3] scanning ai-compose-commit/confirm-dialog.png
[screenshots:scan-metadata] [2/3] ok 1440x900 301 KB
[screenshots:scan-metadata] [3/3] scanning monospecs/select-repository.png
[screenshots:scan-metadata] [3/3] ok 1728x1117 512 KB
[screenshots:scan-metadata] wrote report to ./artifacts/screenshot-report.json
[screenshots:scan-metadata] completed: 3 succeeded, 0 failed
```

## Recommended Command

If `repos/docs/.env` is configured, the sync command now loads it automatically and creates a workspace-local `.tmp` directory when `TMPDIR`, `TMP`, and `TEMP` are not already set:

```bash
npm run screenshots:sync
```

The command resolves ImgBin in this order:

1. `--imgbin`
2. `IMGBIN_EXECUTABLE` from `repos/docs/.env` or the shell
3. installed `repos/docs/node_modules/@hagicode/imgbin`
4. fallback `../imgbin/dist/cli.js`

The command resolves the analysis context in this order:

1. `--analysis-context-file`
2. `SCREENSHOT_ANALYSIS_CONTEXT_FILE`
3. `./prompts/screenshot-analysis-context.txt`

At startup, `screenshots:sync` prints the resolved analysis context file so CI logs can confirm which file was actually used.

After a successful sync, the docs screenshot library also refreshes its ImgBin search index so future `imgbin search` runs can immediately match recognized titles, tags, descriptions, and imported source paths.

## Repository Compression Follow-up

After screenshot files are imported, the repository-level `Compress images` GitHub Actions workflow may further optimize supported bitmap files on commit.

- Target formats: `png`, `jpg`, `jpeg`, `webp`
- Typical affected paths: `src/content/docs/img/**`, including `src/content/docs/img/screenshots/**`
- Out of scope for the workflow: `metadata.json`, `manifest.json`, prompt files, slug directories, and other non-bitmap assets

This follow-up compression does not replace the responsibilities of `screenshots:sync`. Maintainers still need `screenshots:sync` to:

- create or refresh managed screenshot directories
- generate `metadata.json`
- rebuild `src/content/docs/img/screenshots/manifest.json`
- preserve the slug and category layout used by docs references

In other words, `screenshots:sync` manages screenshot identity and metadata, while the repository workflow may only shrink the binary image payload afterward.

## Minimal Import Steps

1. Copy the screenshot into `screenshot-staging/<category>/...`
2. Change directory to `repos/docs`
3. Run the recommended command
4. Verify the managed asset directory was created
5. Verify `metadata.json` and `manifest.json`
6. Confirm the successfully processed staging file was removed
7. Update docs content to reference the managed screenshot path

## Authoring feature docs from managed screenshots

When a screenshot batch is already imported, treat the checked-in metadata as the primary source for page planning instead of re-reading the image manually every time.

### Recommended authoring order

1. Find the candidate assets in `src/content/docs/img/screenshots/manifest.json` or the nearby `metadata.json` files.
2. Record a route plan before writing prose:
   - Chinese route, for example `/adventure-team-introduction`
   - English mirror route, for example `/en/adventure-team-introduction`
   - section name that owns each screenshot
3. Write the MDX page with the managed screenshot path, usually `.../original.png`.
4. Keep the screenshot-to-section mapping in maintainer notes, change artifacts, or planning docs instead of the published page when the public docs should stay reader-focused.
5. Add related links only after the page body is stable, so navigation changes stay minimal and reviewable.

### Minimum traceability fields

Each screenshot-backed feature doc should still preserve the same five mapping fields somewhere reviewable for maintainers, even if they do not appear in the published page:

- `slug`
- `title`
- `relativeSourcePath`
- `section`
- `route`

These fields are enough for a maintainer to jump from a rendered page back to:

- the managed asset directory under `src/content/docs/img/screenshots/**`
- the checked-in `metadata.json`
- the original staging filename recorded by `relativeSourcePath`

### When to use ImgBin search results

Use checked-in metadata first. Fall back to existing ImgBin search results only when one of these is true:

- the screenshot title is too generic to decide which page owns it
- multiple screenshots appear to describe the same feature and you need extra semantic clues
- a maintainer is triaging a screenshot that has not been wired into docs yet

If you use ImgBin search as a fallback, copy the conclusion back into planning notes, the related OpenSpec change, or another checked-in maintainer artifact so the next maintainer does not need to repeat the search.

### Example route and section planning

Before writing, create a small inventory like this in your notes or change proposal:

| `slug` | Intended page | `section` | Why |
| --- | --- | --- | --- |
| `screenshot-a1e8035a` | `/adventure-team-introduction` | `成员与编组面板` | Hero roster grid and loadout details explain the roster workspace |
| `screenshot-11d59f8f` | `/adventure-team-introduction` | `协作流程与副本推进` | Dungeon proposal cards and roster editor show the team workflow |
| `guide1-language` | `/quick-start/wizard-setup` | `步骤 1：语言` | Language settings and sidebar progress anchor the first wizard step |

This keeps feature pages bilingual, screenshot-backed, and easy to maintain when metadata changes later.

## Batch Execution for Historical Screenshots

When processing a large legacy backlog, split the work into small, reviewable batches instead of staging every file at once.

Recommended batches for this repository:

1. `quick-start/create-project`
2. `quick-start/create-proposal-session`
3. `installation/install-desktop` + `installation/install-postgres-windows`
4. `ai-compose-commit` + `monospecs`

For each batch:

1. Copy only that batch into `screenshot-staging/`
2. Run the recommended sync command
3. Review the generated or refreshed `metadata.json` files
4. Confirm `src/content/docs/img/screenshots/manifest.json` includes the successful items
5. Update the affected Markdown or MDX references before moving to the next batch

This makes it easier to isolate failures, retry only the relevant files, and confirm page-level rendering before the next batch starts.

## Example: Import an Existing Docs Screenshot

Source screenshot:

- `src/content/docs/img/quick-start/create-project/step1-click-new-project-button.png`

Stage the file:

```bash
mkdir -p screenshot-staging/quick-start/create-project
cp src/content/docs/img/quick-start/create-project/step1-click-new-project-button.png \
  screenshot-staging/quick-start/create-project/
```

Run the import:

```bash
npm run screenshots:sync
```

## Success Criteria

Expected CLI output:

```text
Scanned 1 staged screenshot.
Per-file results:
- ✓ quick-start/create-project/step1-click-new-project-button.png [quick-start/create-project/step1-click-new-project-button]: imported -> src/content/docs/img/screenshots/quick-start/create-project/step1-click-new-project-button
Manifest entries: N
Completed without failures.
```

Verify these files exist:

- `src/content/docs/img/screenshots/<category>/<slug>/original.png`
- `src/content/docs/img/screenshots/<category>/<slug>/metadata.json`
- `src/content/docs/img/screenshots/manifest.json`

After a successful import or refresh:

- the processed screenshot file is removed from `screenshot-staging/...`
- failed screenshots remain in staging so they can be retried later

## How to Reference Managed Screenshots

Manifest entries expose a static image path like:

- `img/screenshots/quick-start/create-project/step1-click-new-project-button/original.png`

From a docs file such as `src/content/docs/quick-start/create-first-project.mdx`, the Markdown relative path is:

```md
![Create new project button](../img/screenshots/quick-start/create-project/step1-click-new-project-button/original.png)
```

The helper at `src/utils/screenshot-manifest.js` can also resolve manifest entries into Markdown-ready paths.

## Metadata Fields to Review

Check these fields in `metadata.json`:

- `title`
- `description`
- `tags`
- `status.recognition`
- `paths.original`
- `extra.docsScreenshot.category`
- `extra.docsScreenshot.relativeSourcePath`

`status.recognition` must be `succeeded` for the screenshot to appear in the generated manifest.

For backlog processing, also verify:

- `extra.docsScreenshot.category`
- `extra.docsScreenshot.categorySegments`
- `extra.docsScreenshot.relativeSourcePath`
- `extra.docsScreenshot.duplicateStrategy`

## Repeat Runs

Re-running the workflow for the same category and slug will:

- reuse the existing managed directory
- refresh `original.*` and `metadata.json`
- remove the newly staged source file after a successful refresh
- avoid creating uncontrolled duplicate directories

Expected summary text for a rerun:

```text
refreshed-existing
```

This is the expected path when legacy screenshots were already imported once and you need to refresh the original image, metadata, or manifest entry.

## Useful Commands

Show help:

```bash
npm run screenshots:sync -- --help
```

Preview without writing:

```bash
npm run screenshots:sync -- --dry-run
```

Scan metadata only:

```bash
npm run screenshots:scan-metadata -- --input ./screenshot-staging --output ./artifacts/screenshot-report.json
```

Force one category:

```bash
npm run screenshots:sync -- --category quick-start
```

Reindex after import:

```bash
npm run screenshots:sync -- --reindex
```

Override the analysis context for one run:

```bash
npm run screenshots:sync -- --analysis-context-file ./prompts/experimental-context.txt
```

## Troubleshooting

### `Claude CLI analysis timed out after 60000ms`

Increase the timeout in `repos/docs/.env` or your shell environment:

```bash
IMGBIN_ANALYSIS_TIMEOUT_MS=180000
```

### `ImgBin executable not found`

Verify:

- `../imgbin/dist/cli.js` exists
- or `@hagicode/imgbin` is installed in `repos/docs`
- or `IMGBIN_EXECUTABLE` points to a valid executable

### `Analysis context file not found` or `Analysis context file is empty`

Verify:

- `repos/docs/prompts/screenshot-analysis-context.txt` exists and is not blank
- or `SCREENSHOT_ANALYSIS_CONTEXT_FILE` points to a real non-empty file
- or your `--analysis-context-file` override path is correct

If this is a one-off batch, prefer a CLI override. If the missing file should be the repository default, restore or fix `repos/docs/prompts/screenshot-analysis-context.txt` so CI and local runs stay aligned.

### `Claude analysis model is not configured`

Verify `repos/docs/.env` contains either:

- `IMGBIN_ANALYSIS_API_MODEL`
- `ANTHROPIC_MODEL`

### `EXDEV: cross-device link not permitted`

The sync command now auto-creates `.tmp` and exports `TMPDIR` / `TMP` / `TEMP` to that workspace-local directory by default. If you still need to override it, set one of these values in `repos/docs/.env` or your shell:

```bash
TMPDIR=/custom/workspace/tmp
```

### Manifest entry missing

Check `metadata.json`:

- `status.recognition` must be `succeeded`

Failed recognition results do not enter the manifest.

### `screenshots:sync` printed startup output but progress feels stalled

This usually means the sync command has moved into ImgBin analysis, import, or another batch step that does not emit per-file logs as frequently as the lightweight scanner.

Use this preflight path first:

1. Run `npm run screenshots:scan-metadata -- --input ./screenshot-staging --output ./artifacts/screenshot-report.json`
2. Confirm the scan reports the expected file count, dimensions, and timestamps
3. Fix any corrupted files reported in `failures` before retrying `screenshots:sync`
4. Re-run `screenshots:sync` only after the scan output looks healthy

The metadata scan command is intentionally the faster, more observable command for confirming that the batch itself is sane; the sync command still owns managed import, AI analysis, and manifest rebuild.

Also check the startup line that reports `analysis context:`. If it points at the wrong file, fix the CLI flag or environment override before retrying.

### Historical backlog item failed during sync

Use the existing retry path instead of inventing a parallel fix:

1. Leave the failed file in `screenshot-staging/` if the sync command already preserved it
2. Review the partial managed asset directory if one was created
3. Re-run the same batch after correcting the source image or environment issue
4. If the source file itself is missing, record the affected docs page and leave it for manual follow-up

Do not change the workflow rules just to handle one backlog item. This change is specifically about replaying the current process against old screenshots.

## Team Conventions

- Match staging categories to docs sections when possible
- Use step-oriented filenames such as `step1-click-new-project-button.png`
- Review generated `title`, `alt`, and `tags` before updating docs references
- Prefer managed screenshot paths over direct legacy `img/...` paths for newly processed assets
- During backlog cleanup, keep a short written note of processed batches, pages updated, and any remaining missing source files

## Current Status

Validated in this repository:

- first-time import of real docs screenshots
- rerun refresh of existing managed screenshots
- manifest generation
- Markdown path resolution through the manifest helper

Current limitation:

- if you override the temp directory, it still needs to live on a filesystem that permits the import move/rename flow
