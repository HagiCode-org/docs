export const DOCS_CONTENT_LAYOUT_WIDE = 'wide';
export const DOCS_CONTENT_LAYOUT_NARROW = 'narrow';
export const DOCS_CONTENT_LAYOUT_MODES = Object.freeze([
  DOCS_CONTENT_LAYOUT_WIDE,
  DOCS_CONTENT_LAYOUT_NARROW,
]);

export const DEFAULT_DOCS_CONTENT_LAYOUT_MODE = DOCS_CONTENT_LAYOUT_WIDE;
export const DOCS_CONTENT_LAYOUT_STORAGE_KEY = 'hagicode-docs-content-layout';
export const DOCS_CONTENT_LAYOUT_ATTRIBUTE = 'data-docs-content-layout';
export const DOCS_CONTENT_LAYOUT_BUTTON_SELECTOR = '[data-docs-content-layout-mode]';

export function isDocsContentLayoutMode(value) {
  return typeof value === 'string' && DOCS_CONTENT_LAYOUT_MODES.includes(value);
}

export function normalizeDocsContentLayout(value) {
  return isDocsContentLayoutMode(value) ? value : DEFAULT_DOCS_CONTENT_LAYOUT_MODE;
}

export function readDocsContentLayout(storage = globalThis.localStorage) {
  try {
    return normalizeDocsContentLayout(storage?.getItem?.(DOCS_CONTENT_LAYOUT_STORAGE_KEY) ?? null);
  } catch {
    return DEFAULT_DOCS_CONTENT_LAYOUT_MODE;
  }
}

export function getDocsContentLayout(root = globalThis.document?.documentElement) {
  return normalizeDocsContentLayout(root?.getAttribute?.(DOCS_CONTENT_LAYOUT_ATTRIBUTE) ?? null);
}

export function writeDocsContentLayout(root = globalThis.document?.documentElement, value) {
  const mode = normalizeDocsContentLayout(value);
  root?.setAttribute?.(DOCS_CONTENT_LAYOUT_ATTRIBUTE, mode);
  return mode;
}

export function persistDocsContentLayout(storage = globalThis.localStorage, value) {
  const mode = normalizeDocsContentLayout(value);

  try {
    storage?.setItem?.(DOCS_CONTENT_LAYOUT_STORAGE_KEY, mode);
  } catch {
    // Ignore storage write failures. The layout state can still live on the root attribute.
  }

  return mode;
}

export function syncDocsContentLayout(
  root = globalThis.document?.documentElement,
  storage = globalThis.localStorage,
  value
) {
  const mode =
    typeof value === 'undefined'
      ? readDocsContentLayout(storage)
      : normalizeDocsContentLayout(value);

  writeDocsContentLayout(root, mode);

  if (typeof value !== 'undefined') {
    persistDocsContentLayout(storage, mode);
  }

  return mode;
}

export function syncDocsContentLayoutToggleState(container, value) {
  const mode = normalizeDocsContentLayout(value);

  for (const button of container?.querySelectorAll?.(DOCS_CONTENT_LAYOUT_BUTTON_SELECTOR) ?? []) {
    const isSelected =
      button.getAttribute('data-docs-content-layout-mode') === mode;

    button.setAttribute('aria-pressed', String(isSelected));
    button.toggleAttribute('data-selected', isSelected);
  }

  return mode;
}
