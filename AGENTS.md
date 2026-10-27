# HagiCode Docs - Agent Configuration

## Root Configuration

Inherits all behavior from `/AGENTS.md` at the monorepo root. Local rules extend or override the root file for this repository.

## Project Context

This repository is the standalone HagiCode documentation site built with Astro and Starlight.

- User docs, guides, and reference pages live here.
- Blog content and release-note related flows also run here.
- The marketing website lives in `repos/site`.

## Working Directory

Run commands from `repos/docs/`.

## Key Commands

Run from `repos/docs/`. Most commands chain `prepare:docs-runtime` first so generated locale resources and the assembled content tree exist before Astro or TypeScript run.
For a no-build first pass, use `npm run test:fast`; it prepares the docs runtime and runs TypeScript checking only, so it does not validate rendered pages or production output. Use the full build commands for release and CI verification.

```bash
npm install
npm run dev
npm run build
npm run build:ci
npm run preview
npm run test:fast
npm run typecheck
npm run verify:blog
```

`dev` and `preview` listen on `PORT_DOCS` (default `31265`). `build:ci` is what `.github/workflows/docs-ci.yml` runs (Node 24): `build` plus `verify:blog-sidebar-i18n` and `verify:hagilight-build` (built-page, GA-tag, and AVIF-output tests).

### i18n (hagi18n)

```bash
npm run i18n:check      # audit + stale generated-resource check + doctor
npm run i18n:audit
npm run i18n:doctor
npm run i18n:generate   # refresh src/i18n/generated resources
npm run i18n:sync       # dry-run en-US -> zh-CN
npm run i18n:prune      # dry-run prune
```

### Release notes

```bash
npm run release-notes:fetch
npm run release-notes:materialize
npm run release-notes:sync
npm run verify:release-notes:input
npm run verify:release-notes:output
npm run test:release-notes
```

### Snapshot sync

Comparison article data (`*-vs-hagicode`) is not synced; it comes from the installed `@hagicode/hagilight-core` package.

```bash
npm run sync:tips-snapshot
```

### Screenshots

```bash
npm run screenshots:scan-metadata
npm run screenshots:sync
```

### Article images

```bash
npm run verify:docs-image-references   # read-only audit of body image references
npm run test:docs-image-references
```

### R2 images

Images from the img-gen R2 library reach Docs only through `r2-images.manifest.json`, the list of adopted images and of surfaces that stay unchanged.

```bash
npm run import:r2-images                       # download manifest objects into src/assets/r2/, verify, then write
node ./scripts/import-r2-images.mjs --check    # offline: vendored files match the manifest
npm run test:r2-images                         # manifest, files, usage, budgets, built HTML (run npm run build first for the HTML part)
npm run test:r2-random-image                   # picker: pick, load, error, timeout, save-data, unchanged box
```

- Album: the only album in use is `cat-head-gallery` (each slot pool in `r2-images.manifest.json` is the 50 audited keys minus that slot's default, every key at or under 40 KiB). `ALLOWED_ALBUMS` in `scripts/import-r2-images.mjs` lists the albums this repository may vendor from; the importer refuses any other album before it downloads, and `npm run test:r2-images` checks the allowlist. To add an album, audit every candidate on contact sheets, record rejects and the verdict in `audit`, then add it to the allowlist in the same change.
- Every R2 image has a vendored default under `src/assets/r2/` imported through Astro `<Picture>` (AVIF and WebP, width and height, `loading="lazy"` unless it is the first visible image). Never reference an R2 URL or a `public/` path for a default.
- Only decorative slots may take a random pool. A pool is an explicit list of 12 to 200 keys from one album, each under the slot's byte cap, baked into the `<picture>` as `data-r2-pool`. `src/scripts/r2-random-image.ts` picks one key uniformly per page view, preloads it with `Image()` and swaps it in only if it loads within 3 s. The default stays on error, timeout, save-data or with scripts off. Screenshots and figures a page refers to never get a pool.
- Adding an image: pick an entry from a published album, audit it (contact sheet, text, brand, privacy) and record the verdict in its `audit` field, add the entry, run `npm run import:r2-images`, then import it in the component and run `npm run test:r2-images`. A surface that takes no image goes in `unchangedSurfaces` with a one-line reason.
- Meaningful images need alt text in every Docs locale in the hagi18n files; decorative images use empty alt and `aria-hidden="true"`.
- Do not hot-link `img-gen.hagicode.com` from Markdown, MDX, Astro templates or `public/`. The only R2 requests at runtime are the picker's single pool image, and the only R2 data in static HTML is the pool list.
- `repos/gallery` and `repos/img-gen` are read-only references for album names, index shape and object keys. Do not edit them or republish R2 objects from here.

### Tests

```bash
npm run test:runtime-version-index   # vitest; chains prepare:docs-runtime
```

Script and content workflow tests in `tests/` use `node --test` and have per-area `test:*` scripts in `package.json` (for example `test:blog-seo-description`, `test:structured-articles`, `test:tips-snapshot`).
`test/rss-output.test.mjs` (singular `test/`) checks built RSS feeds in `dist/` and has no npm script; run it with `node --test` after a build. Other read-only gates: `verify:docs-entry-language` (run after a build), `verify:traffic-entry-contract`, `verify:desktop-version-guidance`.

### Translation reporting

```bash
npm run report:translation
npm run translate:missing:pi
npm run translate:missing:claude
npm run verify:docs-translation
```

Blog translation and SEO helpers:

```bash
npm run report:blog-translation
npm run verify:blog-i18n                 # blog i18n build check; `build:verify-blog-i18n` builds first
npm run verify:blog-translation-quality  # add :ci to fail on findings
npm run sync:blog-seo-descriptions       # dry-run; use :write to apply
npm run indexnow:dry-run                 # preview the IndexNow submission
```

## PostHog Site Events

`src/lib/posthog-events.ts` holds the frozen event table and the capture wrapper that every HagiCode site shares. The wrapper sends nothing when `window.posthog` is missing, when the visitor has opted out, or when `capture` throws. It queues the event while the PostHog stub has not loaded. It keeps only the keys in the event's table row, and only string, finite number or boolean values that match the row's kind (enumerations are exact matches; strings are capped at 128 characters). It never sends URLs, paths, query strings, free text or the hagilight super properties (`site_id`, `site_framework`, `hagilight_version`, `locale`, `page_type`).

Only `src/components/InstallButton.tsx` calls the wrapper.

| Event | Sent when | Properties |
|-------|-----------|------------|
| `download_desktop_windows`, `download_desktop_macos`, `download_desktop_linux` | A visitor activates a primary-source download: the China or GitHub button, or the same two links in the version dropdown. The platform is the one the resolved download model belongs to. Torrent links and disabled sources send nothing. | `platform` (`windows`, `macos`, `linux`), `architecture` (`x64`, `arm64`, `unknown`), `asset_type` (the `AssetType` value, for example `linux-appimage`), `source` (`accelerated` or `github`), `app_version` (the index version without a leading `v`) |
| `open_microsoft_store` | The Windows primary store button (`install_primary`) or the store badge shortcut (`install_shortcut`) is activated. | `source` (`install_primary` or `install_shortcut`) |
| `open_steam_store` | The Steam shortcut is activated. | `source` (`install_shortcut`) |

Deduplication rule: the install controls carry `gaEventAttributes`, so one click can also produce hagilight's `cta_click`. The business event above is the canonical record of that click. Dashboards must not add these events to `cta_click` counts.

Tests: `src/lib/posthog-events.test.ts` (wrapper rules and the exact allowlisted set for every row) and the `InstallButton PostHog events` block in `src/components/__tests__/InstallButton.test.tsx`.

## Deployment

`.github/workflows/docs-deploy-gh-pages.yml` runs `build:ci` on pushes to `main` (or manually) and publishes to gh-pages, then warms the deployed domains with `scripts/warm-deployment-domains.mjs`. `.github/workflows/indexnow.yml` runs `npm run indexnow:submit` daily and on demand. The Azure Static Web Apps workflow is paused (manual dispatch only), and `esa.jsonc` holds the ESA build settings. Do not change deployment config as part of content work.

## Key Paths

- `src/content/docs/`: documentation and blog content
- `src/content/translations/docs/<locale>/`: non-baseline localized docs authoring files (canonical locale codes such as `en-US`, `zh-Hant`)
- `src/content/.generated/docs/`: build-time assembled Starlight input tree generated by `prepare:docs-content`; do not edit directly
- `src/components/`: custom site components
- `src/i18n/locales/`: source-of-truth YAML UI strings per locale
- `src/i18n/generated/`: committed generated locale resources imported by `astro.config.mjs`
- `src/data/release-notes/`: release-note source data and materialized output
- `scripts/`: content preparation, verification, and sync tooling
- `tests/`: script and content workflow tests
- `shared/`: shared TypeScript sources with their own `package.json`
- `templates/seo/`, `prompts/`: SEO article templates and prompts used by the SEO article workflow

## Agent Guidelines

- Favor clear documentation structure over marketing language.
- Keep content in Markdown or MDX patterns already established in the repo.
- Preserve frontmatter, heading structure, internal links, and verification-script expectations.
- Use repo scripts for content materialization, translation, release notes, and screenshot workflows instead of editing generated output directly.
- Keep docs-specific concerns here; broader product marketing belongs in `repos/site`.
- Tag new calls to action for Google Analytics with `gaEventAttributes()`.

## References

- `README.md`
- `PRODUCT.md`
- `DESIGN.md`
- `SEO_ARTICLE_WORKFLOW.md`
- `SCREENSHOT_METADATA_WORKFLOW.md`
- `scripts/`