# HagiCode Documentation

[简体中文](./README_cn.md)

This repository contains the standalone HagiCode documentation site built with Astro and Starlight.

## Product overview

The docs site is where users learn the platform: product overviews, installation guides, tutorials, blog posts, and downloadable configuration presets all live here.

## What the site covers

- Product introductions and onboarding guides for new users
- Step-by-step installation and configuration documentation
- Blog content and updates for the HagiCode ecosystem
- Preset files and static assets referenced by public docs pages

## Repository layout

- `src/content/docs/` - documentation pages and blog content
- `src/components/` and `src/layouts/` - site UI building blocks
- `public/` - static assets, downloadable presets, and shared media
- `scripts/` and `tests/` - verification helpers for docs quality and routing behavior

## Local development

```bash
npm install
npm run dev
npm run build
npm run preview
```

The local docs server runs on `http://localhost:31265` by default.

## Deployment contract

Production publication is handled by GitHub Actions and the `gh-pages` branch.

- `.github/workflows/docs-ci.yml` is validation-only for pushes and pull requests targeting `main`.
- `.github/workflows/docs-deploy-gh-pages.yml` runs on `main`, executes the repository-defined `npm run build:ci` command, uploads the validated `dist/` snapshot, and publishes only that snapshot to `gh-pages`.
- `gh-pages` is the only production artifact source for docs hosting. The external EAS host is expected to consume `gh-pages` content and must not rebuild `main` directly.
- Successful publication runs expose the `docs-production` GitHub environment with the production URL `https://docs.hagicode.com`.

### Maintainer troubleshooting

1. Open the latest `Docs Deploy gh-pages` workflow run in GitHub Actions.
2. If the `Build validated docs snapshot` job fails, inspect the `Build and verify docs` step logs. In this state the workflow never reaches the branch publication step, so the existing `gh-pages` snapshot stays live.
3. If the `Publish validated snapshot to gh-pages` job fails, inspect the deploy job logs and confirm the repository allows workflow runs to push with `contents: write`.
4. After a successful run, verify that `gh-pages` contains the expected static snapshot and that GitHub shows a successful deployment for the `docs-production` environment.

### Rollout verification checklist

- Ensure the repository has a writable `gh-pages` branch managed only by CI output.
- Confirm `Docs Deploy gh-pages` succeeds on a `main` push and publishes from `dist/` rather than rebuilding in the deploy job.
- Confirm GitHub Actions shows the `docs-production` environment with `https://docs.hagicode.com`.
- Confirm the latest `gh-pages` commit contains the validated static snapshot from the successful workflow run.
- Confirm the external EAS host is configured to deploy from `gh-pages` instead of rebuilding `main`.
- Confirm `https://docs.hagicode.com` serves the expected snapshot after the `gh-pages` update.

## hagi18n maintenance workflow

Docs UI strings are maintained with `@hagicode/hagi18n` from this repository. The source of truth is the YAML tree under `src/i18n/locales/<locale>/`; generated runtime resources are committed under `src/i18n/generated/` because `astro.config.mjs` imports them during config evaluation.

Use these commands from `repos/docs`:

```bash
npm run i18n:audit
npm run i18n:doctor
npm run i18n:generate
npm run i18n:check
```

`npm install` installs the project-local `hagi18n` CLI. To verify CLI availability directly, run `npx hagi18n info` or any script above.

### Updating UI translations

Edit YAML files in `src/i18n/locales/en-US/` and `src/i18n/locales/zh-CN/`. Keep namespace files, scalar key paths, and `{{placeholder}}` tokens aligned between locales. Run `npm run i18n:audit` or `npm run i18n:doctor`, then run `npm run i18n:generate` to refresh `src/i18n/generated/docs-locale-resources.mjs`.

`npm run i18n:check` combines hagi18n validation with a stale generated-resource check. `npm run dev`, `npm run build`, and `npm run typecheck` run `prepare:i18n` first so generated resources exist before Astro or TypeScript consumes them.

### Safe sync and prune commands

Sync and prune default to dry-run previews:

```bash
npm run i18n:sync
npm run i18n:prune
```

Only the explicit write variants mutate locale source files:

```bash
npm run i18n:sync:write
npm run i18n:prune:write
```

### Content boundary

hagi18n manages docs UI strings, blog plugin UI labels, Starlight locale metadata, and common selector labels. MDX documentation pages and blog posts remain organized through Starlight locale folders: Chinese content lives under `src/content/docs/`, and English content lives under `src/content/docs/en/`.

## Screenshot analysis workflow

The managed screenshot sync flow reads `repos/docs/.env` before it launches ImgBin.
The repository default for image analysis is:

- `IMGBIN_ANALYSIS_PROVIDER=codex`
- `IMGBIN_CODEX_MODEL=lemon/gpt-5.4`
- `IMGBIN_CODEX_BASE_URL=http://localhost:36129/v1`

Copy [`./.env.example`](./.env.example) to `.env` when you need a local config file for `npm run screenshots:sync`.

## Desktop version data

Desktop download data is fetched at runtime from the canonical index endpoint published by `repos/index`.
When runtime loading reaches terminal failure, docs falls back to the Index Desktop history page at `https://index.hagicode.com/desktop/history/`.
`repos/index` remains a referenced dependency only; the stable fallback surface is `https://index.hagicode.com/desktop/history/` plus `https://index.hagicode.com/desktop/index.json`.
This repository still serves `public/version-index.json` as a local snapshot for offline fallback, but maintainers should investigate the runtime fetch chain and the index deployment before changing docs UI behavior.
Repository-scoped update detail pages are no longer hosted in this docs site. A future change will introduce the replacement version update information surface.

## Release-notes sync workflow

The replacement release-notes surface now lives in this repository under `src/content/docs/release-notes/`, `src/content/docs/en/release-notes/`, and the managed `src/data/release-notes/` directory.
Managed outputs are generated from the authoritative `repos/release-notes` workspace data.
For monorepo automation, the preferred path is direct repository-to-repository transfer. GitHub Release assets remain only as an optional fallback source for standalone sync jobs. `hagirepocron` is expected to reach this repo only after `release-notes` has produced a complete bilingual published dataset for each tag.

### Commands

```bash
npm run release-notes:fetch
npm run release-notes:materialize
npm run release-notes:sync
npm run verify:release-notes:input
npm run verify:release-notes:output
npm run test:release-notes

# Monorepo / cron path: read release-notes directly from a sibling checkout
DOCS_RELEASE_NOTES_SOURCE=local \
DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT=../release-notes \
npm run release-notes:sync
```

### Source modes

- `DOCS_RELEASE_NOTES_SOURCE=local`
  - Reads `artifacts/tags/<tag>/<tag>.json` and `published/<tag>.<locale>.md` directly from `DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT`.
  - This is the intended mode for `hagirepocron` and other same-machine orchestration.
- `DOCS_RELEASE_NOTES_SOURCE=github`
  - Fetches GitHub Releases plus `release-notes-<tag>-history.zip` assets from `DOCS_RELEASE_NOTES_REPOSITORY`.
  - Use this only when docs runs without access to a sibling `release-notes` checkout.
- `DOCS_RELEASE_NOTES_SOURCE=auto`
  - Default mode.
  - Uses local mode when `DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT` is set; otherwise falls back to GitHub mode.

### Local repository contract

- Each synchronized tag must provide `artifacts/tags/<tag>/<tag>.json`.
- Each synchronized tag must also provide `published/<tag>.zh-CN.md` and `published/<tag>.en.md`.
- In the monorepo cron path, these published bilingual files are expected to come from the upstream `release-notes` AI preparation step before docs sync begins.
- Tags with missing JSON, malformed JSON, tag mismatches, or incomplete locale bodies are skipped with deterministic reasons and do not publish partial pages.

### GitHub fallback asset contract

- The GitHub fallback workflow only accepts assets named `release-notes-<tag>-history.zip`.
- Each accepted archive must contain `artifacts/tags/<tag>/<tag>.json`.
- Each accepted archive must also contain `published/<tag>.zh-CN.md` and `published/<tag>.en.md`.

### Automation and troubleshooting

- `.github/workflows/release-notes-sync.yml` runs daily and via `workflow_dispatch`.
- In the monorepo cron path, `hagirepocron` sets `DOCS_RELEASE_NOTES_SOURCE=local` and passes the sibling `release-notes` checkout root, so docs no longer depends on published release assets to materialize pages.
- Docs-managed output now uses `src/data/release-notes/index.json` plus `src/data/release-notes/<tag>.json`, together with `src/content/docs/release-notes/index.mdx` and `src/content/docs/en/release-notes/index.mdx`.
- The lightweight index keeps browse metadata only; detailed rendered bodies live in the per-tag JSON files generated inside this repository.
- Incomplete upstream tags must not create partial detail files or extra docs routes.
- `npm run build` runs release-notes input verification before Astro and output verification after Astro. Empty release-notes pages are valid only when `src/data/release-notes/index.json` has zero entries; if entries exist, missing detail JSON, missing localized body HTML, missing anchors, or empty-state output must fail the build.
- The workflow uses `DOCS_RELEASE_NOTES_TOKEN` for upstream GitHub API access and falls back to the repository `GITHUB_TOKEN` only when that token already has cross-repository visibility.
- In CI, `DOCS_RELEASE_NOTES_ALLOW_STALE_ON_SOURCE_ERROR=true` keeps the job green when the upstream repository is temporarily inaccessible and existing managed outputs are already present.
- The sync scripts depend on the standard `zip` and `unzip` utilities in addition to Node.js.
- If the sync job reports skipped tags in local mode, inspect the source files in `release-notes` first; in GitHub mode, inspect the published asset contents.
- If release discovery returns `404`, treat it as an authentication or repository-access problem first and verify that `DOCS_RELEASE_NOTES_TOKEN` can read `HagiCode-org/release-notes`.
- For monorepo-local development, prefer `DOCS_RELEASE_NOTES_SOURCE=local` plus `DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT`.

## Ecosystem role

Use this repository when the goal is end-user education and public documentation. Product storytelling lives in `repos/site`, while application behavior lives in `repos/web`, `repos/hagicode-desktop`, and `repos/hagicode-core`.
