# Screenshot Metadata Workflow

This guide documents the maintainer workflow for importing documentation screenshots into the managed screenshot library under `src/content/docs/img/screenshots/`.

## Purpose

Use `pnpm run screenshots:scan-metadata` when you want to:

- recursively inventory a screenshot folder without moving files
- capture width, height, timestamps, size, extension, and MIME type in a stable JSON report
- preflight a batch before running the heavier `screenshots:sync` import path
- diagnose whether a staging batch contains corrupted or unsupported image files

Use this workflow when you want to:

- import an existing docs screenshot into the managed screenshot library
- write `metadata.json` for each imported screenshot (no analysis pass; fill the fields by hand, see Import Without Analysis)
- rebuild `src/content/docs/img/screenshots/manifest.json`
- switch Markdown or MDX content to use managed screenshot paths

In short:

- `screenshots:scan-metadata` = read-only inventory and progress-visible preflight
- `screenshots:sync` = managed import, metadata, manifest rebuild, and staging cleanup

## Historical Backlog Scope

The `screenshot-management-optimization` change uses this existing workflow to absorb legacy screenshots into `src/content/docs/img/screenshots/`.

- In scope for this backlog pass:
  - `quick-start/create-project` (`6` screenshots)
  - `quick-start/create-proposal-session` (`26` screenshots)
  - `installation/install-desktop` screenshots that remain referenced by published Desktop management sections
  - `ai-compose-commit` (`3` screenshots)
  - `monospecs` (`3` screenshots)
- Affected docs pages to re-check after sync:
  - `src/content/docs/quick-start/create-first-project.mdx`
  - `src/content/docs/quick-start/proposal-session.mdx`
  - `src/content/docs/installation/desktop.mdx`
  - `src/content/docs/guides/ai-compose-commit.md`
  - `src/content/docs/guides/monospecs.mdx`
  - `src/content/translations/docs/en-US/quick-start/create-first-project.mdx`
  - `src/content/translations/docs/en-US/quick-start/proposal-session.mdx`
  - `src/content/translations/docs/en-US/installation/desktop.mdx`
  - `src/content/translations/docs/en-US/guides/ai-compose-commit.md`
- Known exception recorded during inventory:
  - Historical inventory found one missing legacy source, `img/ai-compose-commit/✓ 处理完成.png`; `src/content/translations/docs/en-US/guides/ai-compose-commit.md` was switched to text-only confirmation instead of keeping a broken image reference
- Explicitly out of scope for this backlog pass:
  - `src/content/docs/img/product-overview/**` illustrations, which are managed as static documentation artwork rather than screenshot assets

This change does not introduce a new import script, a new metadata rule, or a parallel migration process. It only reuses the current staging/import/review flow documented on this page.

## Backlog Execution Notes

Current execution result for `screenshot-management-optimization`:

- `71` legacy screenshots were imported or refreshed into `src/content/docs/img/screenshots/`
- `13` Markdown or MDX pages were updated to use managed screenshot paths
- `src/content/docs/img/screenshots/manifest.json` now contains `71` published screenshot entries
- Assets imported without an analysis pass carry `status.recognition = skipped`, which the manifest accepts (see Metadata Fields to Review)

Remaining follow-up items after this backlog pass:

- `src/content/docs/img/product-overview/**` illustrations still use legacy paths by design and remain outside the managed screenshot workflow
- Retired Desktop installation walkthrough screenshots should not be reintroduced as managed examples unless a published page links to them again

## Retired legacy screenshots

The legacy sets listed in the backlog above (`ai-compose-commit`, `monospecs`, `quick-start/create-project`, the loose `installation/install-desktop` and `install-postgres-windows` files, `article-images`) and the managed `screenshots/{ai-compose-commit,monospecs,shared,skills}` entries were removed in 2026-10 once no page referenced them. Every screenshot a page shows is now English, dark theme and captured from the current UI; the current sets live under `img/user-guide/`, `img/quick-start/`, and `img/screenshots/{guides,installation,product}`. Retake a screenshot, rather than adding a new one, when the UI it shows changes.

## Preconditions

- Run commands from `repos/docs`
- No analysis provider or external CLI is needed
- Optional overrides can go in `repos/docs/.env` or the shell. The defaults apply when unset:

```bash
SCREENSHOT_STAGING_DIR=screenshot-staging
SCREENSHOT_LIBRARY_ROOT=src/content/docs/img/screenshots
SCREENSHOT_MANIFEST_PATH=src/content/docs/img/screenshots/manifest.json
```

## Import Without Analysis

`screenshots:sync` copies each staged file into the managed library and writes its `metadata.json` itself. Nothing reads the pixels, so no title, description or tags are generated. Each new asset gets:

- `title`: derived from the slug, for example `Click New Project Button` for `click-new-project-button`
- `description` and `tags`: empty
- `status.generation`, `status.recognition` and `status.thumbnail`: `skipped`

Fill the fields in `metadata.json` by hand:

- `manual.title` sets the title
- `manual.description` sets the description, and the manifest also uses it as the alt text unless `manual.alt` is set
- the top-level `tags` array holds the tags

A later `screenshots:sync` run for the same staged file keeps these manual fields and replaces only `original.*`, the timestamps and the `extra.docsScreenshot` provenance.

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

Run this before sync when you only need a quick inventory or when you want to confirm the batch is healthy before the import:

```bash
pnpm run screenshots:scan-metadata --input ./screenshot-staging --output ./artifacts/screenshot-report.json
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

```bash
pnpm run screenshots:sync
```

The command loads `repos/docs/.env` when it exists, imports every supported file under `screenshot-staging/` into the managed library, writes or refreshes each asset's `metadata.json`, and rebuilds `manifest.json`. It starts no external process and creates no temporary workspace.

At startup it logs the input, library and manifest paths, so CI logs show which directories were used.

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

### When to look beyond the checked-in metadata

Use the checked-in `title`, `description`, `tags` and `extra.docsScreenshot` fields first. There is no search index any more. Fall back to a text search over the `metadata.json` files only when one of these is true:

- the screenshot title is too generic to decide which page owns it
- multiple screenshots appear to describe the same feature and you need extra clues
- a maintainer is triaging a screenshot that has not been wired into docs yet

If you run a search as a fallback, copy the conclusion back into planning notes, the related OpenSpec change, or another checked-in maintainer artifact so the next maintainer does not need to repeat the search.

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
3. currently referenced `installation/install-desktop` management screenshots
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
pnpm run screenshots:sync
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

## Article Image Optimization

Hagilight 0.9.0 optimizes local body images that use a relative path, through `contentImages` in `astro.config.mjs`. Keep references relative as shown above. Site-root paths such as `/article-images/...` and remote URLs are not processed.

- Plain `.md` pages wrap each local image in `<picture>` with an AVIF source, a WebP source, and the `<img>`.
- `.mdx` pages are not wrapped. Their images keep Astro's single WebP `<img>`. A page can move to `.md` only when it has no imports, exports, or components.
- Gallery images rendered by the article promotion keep their AVIF, WebP, and JPEG chain.

Check references without building:

```bash
pnpm run verify:docs-image-references
pnpm run test:docs-image-references
```

The audit is read-only and is not part of `build` or `build:ci`. It exits with status 1 and prints the file and line of any site-root or remote body image, and it lists which pages are picture-eligible and which are MDX-only.

## Metadata Fields to Review

Check these fields in `metadata.json`:

- `title`
- `description`
- `tags`
- `status.recognition`
- `paths.original`
- `extra.docsScreenshot.category`
- `extra.docsScreenshot.relativeSourcePath`

`status.recognition` must be `succeeded` or `skipped` for the screenshot to appear in the generated manifest. `pending`, `failed` or a missing status keeps it out.

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
pnpm run screenshots:sync --help
```

Preview without writing:

```bash
pnpm run screenshots:sync --dry-run
```

Scan metadata only:

```bash
pnpm run screenshots:scan-metadata --input ./screenshot-staging --output ./artifacts/screenshot-report.json
```

Force one category:

```bash
pnpm run screenshots:sync --category quick-start
```

## Troubleshooting

### Manifest entry missing

Check `metadata.json`:

- `status.recognition` must be `succeeded` or `skipped`
- `paths.original` must name an existing `original.*` file in the same directory

Entries with `pending`, `failed` or no `status` are left out of the manifest.

### `Managed asset path already exists without metadata`

The target directory exists but has no `metadata.json`, so the sync refuses to overwrite it. Inspect the directory, restore or remove it, then re-run the batch. The staged file stays in `screenshot-staging/` until its import succeeds.

### `Unknown argument` from `screenshots:sync`

The analysis-era flags `--reindex`, `--analysis-context-file`, `--analysis-prompt`, `--no-overwrite` and the analysis tool executable flag were removed. Drop them from scripts and shell history. The sync accepts `--input`, `--library-root`, `--manifest`, `--category`, `--dry-run` and `--help`.

### `screenshots:sync` printed startup output but progress feels stalled

The sync only copies files and writes JSON, so a stall is usually a slow disk or a large file. Use the lightweight preflight first:

1. Run `pnpm run screenshots:scan-metadata --input ./screenshot-staging --output ./artifacts/screenshot-report.json`
2. Confirm the scan reports the expected file count, dimensions, and timestamps
3. Fix any corrupted files reported in `failures` before retrying `screenshots:sync`
4. Re-run `screenshots:sync` only after the scan output looks healthy

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

The import path without analysis is covered by `pnpm run test:screenshot-metadata`: first import, refresh that keeps hand-written `manual` fields, dry run, failure on a metadata-less directory, and manifest acceptance of `skipped` assets.

## User Guide Screenshots (static, not managed)

The pages under `src/content/docs/user-guide/` and `src/content/translations/docs/en-US/user-guide/` use plain PNG files in `src/content/docs/img/user-guide/<module>/`. They are intentionally **not** part of the managed `screenshots:sync` library: they do not go through `screenshots:sync`, and they are retaken whenever the workbench UI changes.

Capture rules:

- Use the **English** interface (`English` in the header language dialog) and the default **Spring Light** theme, at a `1440x900` viewport. The project rail, wizard, and Settings drawer shots keep that size; header and status bar shots are clipped strips.
- Run the local stack from the monorepo root with a scrubbed environment so it cannot see another deployment's data: `npm run start:api` (backend on `127.0.0.1:35167`) and `npm run web` (Vite on `37599`). Put the Agent CLI you need (for example `claude`) on that `PATH`, otherwise sessions fail with "Unable to locate the Claude Code executable".
- Use a throwaway demo repository (a few files and two commits) as the project and a small read-only prompt for the sample session.
- Never publish real local paths or accounts. Replace visible paths with `/home/user/projects/<name>` before taking the shot, and skip tabs that show account names (Settings → GitHub) or machine layout (Settings → Data Management, HagiTask source paths).
- Name files `NN-short-description.png` inside the module folder and reference them from the zh-CN source (`../img/user-guide/...`) and the English translation (`../../img/user-guide/...`).
