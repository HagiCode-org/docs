---
name: HagiCode Docs
description: Public documentation, release notes, and preset delivery for the HagiCode ecosystem.
colors:
  text-strong: "#1f2937"
  text-body: "#334155"
  text-muted: "#64748b"
  border-soft: "#d6dee8"
  surface-muted: "#f7f9fc"
  surface-light: "#fbfcfe"
  accent-primary: "#3b82f6"
  accent-primary-strong: "#245ea8"
  accent-primary-soft: "#dbeafe"
  accent-support: "#14b8a6"
  success: "#22c55e"
  surface-dark: "#0f1724"
  surface-dark-muted: "#131d2b"
  border-dark: "#253346"
  text-dark: "#e7edf5"
  text-dark-muted: "#c7d2df"
typography:
  display:
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", "WenQuanYi Micro Hei", "Segoe UI", system-ui, sans-serif'
    fontSize: "clamp(2.25rem, 4vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.1
  headline:
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", "WenQuanYi Micro Hei", "Segoe UI", system-ui, sans-serif'
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", "WenQuanYi Micro Hei", "Segoe UI", system-ui, sans-serif'
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", "WenQuanYi Micro Hei", "Segoe UI", system-ui, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", "WenQuanYi Micro Hei", "Segoe UI", system-ui, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0"
rounded:
  sm: "0.625rem"
  md: "0.875rem"
  lg: "1rem"
  xl: "1.25rem"
  pill: "999px"
spacing:
  xs: "0.375rem"
  sm: "0.5rem"
  md: "0.875rem"
  lg: "1rem"
  xl: "1.25rem"
  xxl: "2rem"
components:
  docs-edit-link:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.pill}"
    padding: "0.625rem 0.95rem"
  header-nav-link:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.sm}"
    padding: "0.375rem 0.75rem"
  language-trigger:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.pill}"
    padding: "0 0.875rem"
    height: "2.25rem"
  language-dialog:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
  language-option-selected:
    backgroundColor: "{colors.accent-primary-soft}"
    textColor: "{colors.accent-primary-strong}"
    rounded: "{rounded.md}"
    padding: "0.85rem"
  install-button:
    backgroundColor: "{colors.accent-primary}"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1rem"
---

# Design System: HagiCode Docs

## Overview

**Creative North Star: "The Trustworthy Field Manual"**

HagiCode Docs should feel like a field manual prepared by an experienced maintainer, not a campaign microsite and not a generic SaaS shell. Readers usually arrive with a job to finish: install the product, compare release behavior, verify a route, copy a preset, or recover context after search. The visual system keeps chrome cool, quiet, and highly legible so the documentation itself remains the main event.

The site uses pale slate surfaces in light mode and deep slate surfaces in dark mode, but both themes stay inside the same restrained temperature band. Accent blue provides orientation and action. Teal and green appear as supporting notes, never as competing brand voices. Motion exists for affordance, not spectacle: pill controls lift slightly, dialogs open with clear depth, and utility CTAs carry just enough polish to feel maintained. It explicitly rejects neon cyberpunk AI styling, glassmorphism-heavy panels, oversized marketing hero theatrics, and dashboard-like card spam.

**Key Characteristics:**
- Cool paper surfaces with dark-slate reading ink.
- One calm bilingual sans-serif voice across navigation, prose, and UI.
- Selective accent lift for action, focus, and confirmation.
- Utility-first components that stay readable on long documents and dense navigation.

## Colors

The palette is restrained and infrastructural. Color exists to orient, confirm, and separate layers, not to generate atmosphere for its own sake.

### Primary
- **Navigation Blue** (`#3b82f6`): The main action and focus color. Use it for links, selected states, edit affordances, and utility buttons that advance the reader toward a task.
- **Anchor Blue** (`#245ea8`): The stronger companion used for text emphasis, hover borders, and high-contrast focus moments when the lighter accent is not enough.

### Secondary
- **Support Teal** (`#14b8a6`): A supporting accent that appears inside gradients and secondary emphasis. It can energize install-related surfaces, but it must not replace blue as the site’s navigation voice.

### Tertiary
- **Confirmation Green** (`#22c55e`): Reserved for successful system states, positive verification, and install flow reassurance.

### Neutral
- **Slate Ink** (`#1f2937`): The strongest light-theme text color for headings and decisive interface copy.
- **Guide Slate** (`#334155`): Default body text. It should carry the bulk of long-form reading without feeling brittle.
- **Muted Slate** (`#64748b`): Supporting metadata, secondary labels, and helper text.
- **Soft Border** (`#d6dee8`): Dividers and control outlines. It should stay quiet and structural.
- **Sidebar Mist** (`#f7f9fc`): Secondary light surfaces such as nav backgrounds and muted shells.
- **Paper Light** (`#fbfcfe`): The main page surface in light mode. It should feel slightly cooled, never pure white.
- **Night Slate** (`#0f1724`): The main dark-theme background. It is deep but still blue-tinted, not absolute black.
- **Night Panel** (`#131d2b`): Raised dark surfaces such as nav and dialog shells.
- **Night Border** (`#253346`): Structural borders in dark mode.
- **Night Ink** (`#e7edf5`): High-contrast text on dark surfaces.
- **Night Muted** (`#c7d2df`): Secondary text on dark surfaces.

**The One Beacon Rule.** Blue is the only primary orientation color. Teal and green may support it, but they never compete with it for navigational authority.

**The Same Horizon Rule.** Light mode and dark mode must feel like the same product under different lighting, not two separate brands stitched together.

## Typography

**Display Font:** PingFang SC, Hiragino Sans GB, Microsoft YaHei UI, Noto Sans CJK SC, Segoe UI, system-ui, sans-serif
**Body Font:** PingFang SC, Hiragino Sans GB, Microsoft YaHei UI, Noto Sans CJK SC, Segoe UI, system-ui, sans-serif
**Label/Mono Font:** SF Mono, Menlo, Cascadia Code, Consolas, Roboto Mono, monospace for code; UI labels stay on the body stack

**Character:** The system uses a calm, platform-native sans stack optimized for Chinese and Latin mixed reading. Typography should feel current, practical, and quiet, with hierarchy created by weight, spacing, and line-length discipline rather than decorative type choices.

### Hierarchy
- **Display** (`700`, `clamp(2.25rem, 4vw, 3.25rem)`, `1.1`): Reserved for hero-level documentation headings and major page anchors. It should appear rarely and never become a branding gimmick.
- **Headline** (`700`, `1.5rem`, `1.25`): Section leaders, panel titles, and strong navigational titles.
- **Title** (`600`, `1.125rem`, `1.35`): Utility component headings, card titles, and grouped navigation labels.
- **Body** (`400`, `1rem`, `1.7`): The default reading layer. Keep prose around `65ch` to `75ch` when layout allows.
- **Label** (`600`, `0.875rem`, `1.25`): Buttons, pills, toggles, and small UI labels. It should feel compact and decisive, never shouty.

**The Mixed-Script Rule.** Chinese and Latin content share one calm UI voice. Do not introduce decorative display faces that fracture bilingual rhythm or make localized pages feel like different products.

## Elevation

This system is flat by default and lifted only when interaction needs help. Most surfaces rely on tonal contrast and 1px structure lines, not permanent shadows. Shadows appear when a component must detach from the document plane, such as dialogs, lightbox surfaces, promoted utilities, or high-signal CTAs.

### Shadow Vocabulary
- **Utility Lift** (`0 14px 34px rgba(37, 99, 235, 0.12)`): Used by edit-link pills and similar small utility CTAs that need a maintained, touchable presence.
- **Dialog Lift** (`0 24px 64px rgba(2, 6, 23, 0.32)`): Used by the language dialog and other overlays that must clearly separate from the reading layer.
- **Media Lift** (`0 16px 36px rgba(15, 23, 42, 0.18)`): Used by richer surfaces such as showcase media, product badges, and segmented install controls.

**The Hover-Only Lift Rule.** Resting documentation surfaces stay grounded. Depth appears only as a response to focus, hover, dialog state, or media emphasis.

## Components

### Buttons
- **Shape:** Soft but disciplined corners, usually medium radius (`0.875rem`) or full pill (`999px`) depending on the control family.
- **Primary:** The install button is the loudest element in the system. It uses a blue-led gradient, white text, medium radius, and compact horizontal padding (`0.625rem 1rem`). Keep it in utility zones, not sprayed through article prose.
- **Hover / Focus:** Movement stays shallow, usually `translateY(-1px)` to `translateY(-2px)`, paired with border or shadow reinforcement. Focus rings must stay visible and blue-led.
- **Secondary / Ghost:** Header links, language triggers, and close buttons use border-led or tint-led treatments on pale or dark surfaces. They should feel precise, not flatly invisible.

### Chips
- **Style:** Selected locale and state badges use soft blue tints with stronger blue text, almost always in pill form.
- **State:** A selected chip should read as active even in peripheral vision. Use tint plus border or text emphasis, never color alone without a shape or contrast shift.

### Cards / Containers
- **Corner Style:** Containers generally use softened corners from `0.875rem` to `1.25rem`.
- **Background:** Prefer quiet tinted surfaces over loud fills. Light mode uses paper and mist surfaces; dark mode uses navy-slate panels.
- **Shadow Strategy:** Most containers are flat. Add media or dialog lift only when the surface needs to detach from the page.
- **Border:** Use a 1px structural border before reaching for shadow.
- **Internal Padding:** Standard utility padding sits between `1rem` and `1.25rem`.

### Inputs / Fields
- **Style:** The language switcher is the canonical field family. It uses pill or rounded-rectangle shapes, border-led outlines, and restrained tinted backgrounds.
- **Focus:** Focus is explicit and blue-led, with a visible outline rather than a subtle color drift.
- **Error / Disabled:** Disabled controls flatten animation and reduce emphasis. Error styling should stay structural and readable, not alarmist.

### Navigation
- **Style:** Header navigation is compact, text-first, and utility-oriented. Nav links use small-radius capsules with short labels and restrained hover fills.
- **State:** Active and hovered navigation should feel more anchored, not louder. Blue belongs to state and destination, not every idle link.
- **Mobile treatment:** Navigation should collapse by subtraction, not by visual reinvention. Preserve the same tone when controls condense for smaller screens.

### Utility CTAs
- **Docs Edit Link:** This is the model utility CTA. Use a pale gradient or tinted surface, pill radius, subtle blue shadow, and strong readable text.
- **Language Dialog:** Treat this as a focused utility overlay, not a modal spectacle. It should feel calm, deep enough to separate, and easy to dismiss.

## Do's and Don'ts

### Do:
- **Do** keep page backgrounds slightly cooled (`#fbfcfe` in light mode, `#0f1724` in dark mode) instead of falling back to pure white or pure black.
- **Do** reserve blue for action, focus, selection, and route orientation so it retains authority.
- **Do** use borders before shadows, and add shadow only when a surface genuinely needs lift.
- **Do** keep documentation controls compact and decisive, with labels that scan quickly in both Chinese and English.
- **Do** honor reduced-motion settings by disabling looping or decorative animation when users opt out.

### Don't:
- **Don't** turn the docs into a neon cyberpunk AI site with glowing accents, black-purple atmospherics, or decorative futurism.
- **Don't** use glassmorphism-heavy panels as the default container style.
- **Don't** inject oversized marketing hero theatrics, vanity metrics, or promotional layouts that interrupt reading flow.
- **Don't** rely on decorative gradients as the primary voice outside focused utility CTAs such as install actions.
- **Don't** use colored side-stripe borders on cards, list items, or callouts. If a surface needs emphasis, solve it with full-surface tint, iconography, stronger heading contrast, or better layout.
