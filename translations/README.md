# translations

This directory is maintained by the `doc-translation` skill (unattended nightly translation with durable state).
Humans edit only `profile.yaml`, `glossary/*/glossary.json` (to set preferred terms; set `"locked": true` to protect an entry) and
`state/*/snapshot.json` (e.g. reset `attempts` to 0 to retry a `blocked` document). Everything else is written by the runs.

```
translations/
├── profile.yaml                 # repository-specific configuration (human-owned)
├── discover.mjs                 # read-only adapter listing the source documents (repository-specific)
├── lib.mjs                      # helpers shared by discover.mjs and publish.mjs
├── publish.mjs                  # copies accepted translations into src/content/translations/docs/<locale>/ and adapts links
└── locales/<locale>/
    ├── content/<doc>            # accepted translations; same relative path as the source document
    ├── drafts/<doc>             # drafts that failed verification; kept for resuming and debugging
    ├── state/                   # ledger.jsonl (append-only history), snapshot.json, backup/, run.lock
    ├── glossary/                # glossary.json, changes.jsonl, style.md
    └── runs/<runId>.md          # one report per run
```

- `state/ledger.jsonl` is the source of truth for history; it is only ever appended to. `snapshot.json` is derived and rebuildable.
- Nothing here is published by itself: wiring `content/` into the site build is separate work.
- Runs commit only this directory and never push.

## Docs specifics

- **Direction**: the source is the Simplified Chinese baseline in `src/content/docs/` (49 pages, `blog/` and `img/` excluded). The nine targets are `en-US zh-Hant ja-JP ko-KR de-DE fr-FR es-ES pt-BR ru-RU`; `en-US` is a translation here, not a source.
- **What counts as pending**: `node translations/discover.mjs --locale <locale> --pending` prints the docs that are missing or older than the baseline (last touch by git commit time, or mtime when uncommitted). A translation already on the site that is not older than the baseline is treated as external and left alone.
- **Site output**: the skill's accepted copy lives in `locales/<locale>/content/`; `node translations/publish.mjs --locale <locale> [--doc <doc>]` rewrites internal links (locale prefix, one more `../` for relative images, translated heading slugs for cross-page anchors, `/zh-CN/` -> `/<locale>/` on the openspec and omniroute sites) and writes `src/content/translations/docs/<locale>/<doc>`.
- **Out of scope**: `blog/` (own pipeline: `pnpm run report:blog-translation`), UI strings in `src/i18n/locales/` (hagi18n), release notes data.
- **Read-only gates after a run**: `node scripts/report-docs-translation-status.mjs --fail-on-findings --report-json <tmp>` and `node scripts/verify-docs-image-references.mjs`.
