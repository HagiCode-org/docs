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

Desktop download data is fetched at runtime from the public desktop index endpoints.
The checked-in `public/version-index.json` snapshot remains an offline fallback detail only, not a docs-maintained freshness workflow.

## Ecosystem role

Use this repository when the goal is end-user education and public documentation. Product storytelling lives in `repos/site`, while application behavior lives in `repos/web`, `repos/hagicode-desktop`, and `repos/hagicode-core`.
