function getClassNames(node) {
  const className = node?.properties?.className;
  if (Array.isArray(className)) {
    return className.map(String);
  }

  if (typeof className === 'string') {
    return className.split(/\s+/).filter(Boolean);
  }

  return [];
}

function isElement(node, tagName) {
  return node?.type === 'element' && (tagName ? node.tagName === tagName : true);
}

function isWhitespaceText(node) {
  return node?.type === 'text' && !/\S/.test(node.value ?? '');
}

function getTextContent(node) {
  if (!node) {
    return '';
  }

  if (node.type === 'text') {
    return node.value ?? '';
  }

  if (!Array.isArray(node.children)) {
    return '';
  }

  return node.children.map((child) => getTextContent(child)).join('');
}

function createMermaidPre(diagram) {
  return {
    type: 'element',
    tagName: 'pre',
    properties: {
      className: ['mermaid']
    },
    children: [{ type: 'text', value: diagram }]
  };
}

function canReplaceParentPre(parent, codeNode) {
  if (!isElement(parent, 'pre')) {
    return false;
  }

  return parent.children.every((child) => child === codeNode || isWhitespaceText(child));
}

function visit(node, parent, index) {
  if (!node || !Array.isArray(node.children)) {
    return;
  }

  for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
    const child = node.children[childIndex];

    if (isElement(child, 'code') && getClassNames(child).includes('language-mermaid')) {
      const diagram = getTextContent(child);
      const replacement = createMermaidPre(diagram);

      if (canReplaceParentPre(node, child) && parent && typeof index === 'number') {
        parent.children[index] = replacement;
        return;
      }

      node.children[childIndex] = replacement;
      continue;
    }

    visit(child, node, childIndex);
  }
}

export default function rehypeMermaidPre() {
  return (tree) => {
    visit(tree, null, null);
  };
}
