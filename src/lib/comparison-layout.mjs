// Layout helpers for the "X vs HagiCode" article series.
//
// The article data (owned by @hagicode/hagilight-core) is a flat list of sections and generic blocks. The en-US and
// zh-CN articles all follow one seven-section contract; this module recognises that contract so the components can
// give each section the role it plays for a reader: verdict, side-by-side, one side's strengths, decision, and so on.
// Anything that does not match (the older template other locales still use) returns null and renders generically.

export const COMPARISON_SECTION_ROLES = ['verdict', 'glance', 'agent', 'decide', 'together', 'hagicode', 'bottom'];

export function resolveComparisonLayout(sections) {
  if (!Array.isArray(sections) || sections.length !== COMPARISON_SECTION_ROLES.length) {
    return null;
  }

  const glanceBlocks = sections[1]?.blocks;
  const table = Array.isArray(glanceBlocks) && glanceBlocks.length === 1 ? glanceBlocks[0] : null;
  if (table?.type !== 'comparison-table' || !Array.isArray(table.headers) || table.headers.length !== 3) {
    return null;
  }

  return {
    roles: COMPARISON_SECTION_ROLES,
    // Table headers read [aspect, agent, HagiCode]; they are the only place both display names sit together.
    agentName: String(table.headers[1]),
    hagicodeName: String(table.headers[2]),
  };
}

// The two "choose X when" lists of the decision section, matched by block id so a reordered section still pairs up.
export function findDecisionPair(blocks) {
  const agent = blocks.find((block) => block.type === 'bullet-list' && String(block.id).endsWith('-choose-agent'));
  const hagicode = blocks.find((block) => block.type === 'bullet-list' && String(block.id).endsWith('-choose-hagicode'));
  return agent && hagicode ? { agent, hagicode } : null;
}

// Replaces the two choose-lists with one virtual `decision-split` block placed where the first of them stood.
export function groupDecisionBlocks(blocks) {
  const pair = findDecisionPair(blocks);
  if (!pair) {
    return blocks;
  }

  const grouped = [];
  for (const block of blocks) {
    if (block === pair.agent) {
      grouped.push({ id: `${pair.agent.id}-split`, type: 'decision-split', agent: pair.agent, hagicode: pair.hagicode });
    } else if (block !== pair.hagicode) {
      grouped.push(block);
    }
  }

  return grouped;
}

// Article text marks commands and identifiers with backticks. Splits a string into plain and code segments so a
// component can render real <code> elements instead of showing the backticks. An unmatched backtick stays literal.
export function splitInlineCode(text) {
  const source = String(text ?? '');
  const segments = [];
  const pattern = /`([^`\n]+)`/gu;
  let cursor = 0;

  for (const match of source.matchAll(pattern)) {
    if (match.index > cursor) {
      segments.push({ code: false, text: source.slice(cursor, match.index) });
    }
    segments.push({ code: true, text: match[1] });
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) {
    segments.push({ code: false, text: source.slice(cursor) });
  }

  return segments;
}

export function fillCopyTemplate(template, values) {
  return String(template ?? '').replace(/\{(\w+)\}/gu, (placeholder, key) => (key in values ? String(values[key]) : placeholder));
}
