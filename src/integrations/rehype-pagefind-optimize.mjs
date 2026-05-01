import { visit } from 'unist-util-visit';

const PAGEFIND_IGNORE_ATTRIBUTE = 'data-pagefind-ignore';
const CODE_WRAPPER_CLASS_NAMES = new Set(['expressive-code', 'astro-code']);

export function rehypePagefindOptimize() {
  return function transform(tree) {
    visit(tree, 'element', (node) => {
      if (!shouldIgnoreForPagefind(node)) {
        return;
      }

      node.properties ??= {};
      node.properties[PAGEFIND_IGNORE_ATTRIBUTE] = '';
    });
  };
}

export function shouldIgnoreForPagefind(node) {
  if (!node || typeof node !== 'object' || node.type !== 'element') {
    return false;
  }

  if (node.tagName === 'pre') {
    return true;
  }

  const classNames = new Set(toClassNameList(node.properties?.className));

  return [...CODE_WRAPPER_CLASS_NAMES].some((className) => classNames.has(className));
}

function toClassNameList(value) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => String(entry).split(/\s+/u).filter(Boolean));
  }

  if (typeof value === 'string') {
    return value.split(/\s+/u).filter(Boolean);
  }

  return [];
}

