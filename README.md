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

## Desktop version data

Desktop download data is fetched at runtime from the canonical index endpoint published by `repos/index`.
When runtime loading reaches terminal failure, docs falls back to the Index Desktop history page at `https://index.hagicode.com/desktop/history/`.
`repos/index` remains a referenced dependency only; the stable fallback surface is `https://index.hagicode.com/desktop/history/` plus `https://index.hagicode.com/desktop/index.json`.
This repository still serves `public/version-index.json` as a local snapshot for offline fallback, but maintainers should investigate the runtime fetch chain and the index deployment before changing docs UI behavior.
Repository-scoped update detail pages are no longer hosted in this docs site. A future change will introduce the replacement version update information surface.

## Release-notes sync workflow

The replacement release-notes surface now lives in this repository under `src/content/docs/release-notes/`, `src/content/docs/en/release-notes/`, and `src/data/release-notes.index.json`.
Managed outputs are generated from GitHub Release assets published by `HagiCode-org/release-notes`.

### Commands

```bash
npm run release-notes:fetch
npm run release-notes:materialize
npm run release-notes:sync
npm run test:release-notes
```

### Upstream asset contract

- The docs sync workflow only accepts assets named `release-notes-<tag>-history.zip`.
- Each accepted archive must contain `artifacts/tags/<tag>/<tag>.json`.
- Each accepted archive must also contain `published/<tag>.zh-CN.md` and `published/<tag>.en.md`.
- Tags with missing JSON, malformed JSON, tag mismatches, or incomplete locale bodies are skipped with deterministic reasons and do not publish partial pages.

### Automation and troubleshooting

- `.github/workflows/release-notes-sync.yml` runs daily and via `workflow_dispatch`.
- The workflow uses `DOCS_RELEASE_NOTES_TOKEN` for upstream GitHub API access and falls back to the repository `GITHUB_TOKEN` only when that token already has cross-repository visibility.
- The sync scripts depend on the standard `zip` and `unzip` utilities in addition to Node.js.
- If the sync job reports skipped tags, inspect the upstream Release asset contents first; fixing the upstream bundle is preferred over editing generated docs files in this repository.
- If release discovery returns `404`, treat it as an authentication or repository-access problem first and verify that `DOCS_RELEASE_NOTES_TOKEN` can read `HagiCode-org/release-notes`.

## Ecosystem role

Use this repository when the goal is end-user education and public documentation. Product storytelling lives in `repos/site`, while application behavior lives in `repos/web`, `repos/hagicode-desktop`, and `repos/hagicode-core`.
