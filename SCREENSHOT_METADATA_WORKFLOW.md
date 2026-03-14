# Screenshot Metadata Workflow

This guide documents the maintainer workflow for importing documentation screenshots into the managed screenshot library under `src/content/docs/img/screenshots/`.

## Purpose

Use this workflow when you want to:

- import an existing docs screenshot into the managed screenshot library
- generate `metadata.json` with ImgBin analysis results
- rebuild `src/content/docs/img/screenshots/manifest.json`
- switch Markdown or MDX content to use managed screenshot paths

## Historical Backlog Scope

The `screenshot-management-optimization` change uses this existing workflow to absorb legacy screenshots into `src/content/docs/img/screenshots/`.

- In scope for this backlog pass:
  - `quick-start/create-normal-session` (`8` screenshots)
  - `quick-start/create-project` (`6` screenshots)
  - `quick-start/create-proposal-session` (`26` screenshots)
  - `installation/install-desktop` (`14` screenshots, including `1` currently unreferenced legacy file)
  - `installation/install-postgres-windows` (`11` screenshots)
  - `ai-compose-commit` (`3` screenshots)
  - `monospecs` (`3` screenshots)
- Affected docs pages to re-check after sync:
  - `src/content/docs/quick-start/conversation-session.mdx`
  - `src/content/docs/quick-start/create-first-project.mdx`
  - `src/content/docs/quick-start/proposal-session.mdx`
  - `src/content/docs/installation/desktop.mdx`
  - `src/content/docs/related-software-installation/postgresql/install-on-windows.mdx`
  - `src/content/docs/guides/ai-compose-commit.mdx`
  - `src/content/docs/guides/monospecs.mdx`
  - `src/content/docs/en/quick-start/conversation-session.mdx`
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
- Ensure `repos/imgbin/dist/cli.js` exists
- Ensure the `claude` CLI is installed and available in `PATH`
- Ensure `repos/imgbin/.env` contains valid analysis settings

Recommended `repos/imgbin/.env` keys:

```bash
IMGBIN_ANALYSIS_CLI_PATH=claude
IMGBIN_ANALYSIS_API_MODEL=glm-5
ANTHROPIC_MODEL=glm-5
IMGBIN_ANALYSIS_TIMEOUT_MS=180000
```

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

## Recommended Command

There is a known cross-filesystem move issue during first-time imports, so use a workspace-local `TMPDIR` for now:

```bash
mkdir -p .tmp
set -a
source ../imgbin/.env
set +a
export IMGBIN_ANALYSIS_TIMEOUT_MS=180000
export TMPDIR="$PWD/.tmp"
IMGBIN_EXECUTABLE=../imgbin/dist/cli.js npm run screenshots:sync -- --input ./screenshot-staging
```

## Minimal Import Steps

1. Copy the screenshot into `screenshot-staging/<category>/...`
2. Change directory to `repos/docs`
3. Run the recommended command
4. Verify the managed asset directory was created
5. Verify `metadata.json` and `manifest.json`
6. Confirm the successfully processed staging file was removed
7. Update docs content to reference the managed screenshot path

## Batch Execution for Historical Screenshots

When processing a large legacy backlog, split the work into small, reviewable batches instead of staging every file at once.

Recommended batches for this repository:

1. `quick-start/create-normal-session` + `quick-start/create-project`
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
mkdir -p .tmp
set -a
source ../imgbin/.env
set +a
export IMGBIN_ANALYSIS_TIMEOUT_MS=180000
export TMPDIR="$PWD/.tmp"
IMGBIN_EXECUTABLE=../imgbin/dist/cli.js npm run screenshots:sync -- --input ./screenshot-staging
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
IMGBIN_EXECUTABLE=../imgbin/dist/cli.js npm run screenshots:sync -- --input ./screenshot-staging --dry-run
```

Force one category:

```bash
IMGBIN_EXECUTABLE=../imgbin/dist/cli.js npm run screenshots:sync -- --input ./screenshot-staging --category quick-start
```

Reindex after import:

```bash
IMGBIN_EXECUTABLE=../imgbin/dist/cli.js npm run screenshots:sync -- --input ./screenshot-staging --reindex
```

## Troubleshooting

### `Claude CLI analysis timed out after 60000ms`

Increase the timeout:

```bash
export IMGBIN_ANALYSIS_TIMEOUT_MS=180000
```

### `ImgBin executable not found`

Verify:

- `../imgbin/dist/cli.js` exists
- `IMGBIN_EXECUTABLE=../imgbin/dist/cli.js` is set

### `Claude analysis model is not configured`

Verify `repos/imgbin/.env` contains either:

- `IMGBIN_ANALYSIS_API_MODEL`
- `ANTHROPIC_MODEL`

### `EXDEV: cross-device link not permitted`

This is the known first-import issue. Use:

```bash
mkdir -p .tmp
export TMPDIR="$PWD/.tmp"
```

### Manifest entry missing

Check `metadata.json`:

- `status.recognition` must be `succeeded`

Failed recognition results do not enter the manifest.

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

- first-time imports still need the `TMPDIR="$PWD/.tmp"` workaround until the cross-filesystem move issue is fixed in code
