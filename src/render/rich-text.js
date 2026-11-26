// Rules shared by the display, the editor and each rich text value sent with an action.
import { CATALOG } from './catalog.js';
import { fillErrors, parseLinkURL } from './validate.js';

export const RICH_TEXT_SCHEMES = Object.freeze(['https:', 'http:', 'mailto:']);
const linkWatchers = new Set();
let linkSchemes = Object.freeze(['https:']);
const MAX_INLINE = 2000;

export function richTextLinkSchemes() {
  return linkSchemes;
}

export function setRichTextLinkSchemes(values) {
  if (!Array.isArray(values) || !values.every((value) => RICH_TEXT_SCHEMES.includes(value))) {
    throw new TypeError('link schemes: must be an array of ' + RICH_TEXT_SCHEMES.join(', '));
  }
  linkSchemes = Object.freeze([...new Set(values)]);
  for (const watch of linkWatchers) watch();
}

export function watchRichTextLinkSchemes(watch) {
  linkWatchers.add(watch);
  return () => linkWatchers.delete(watch);
}

export function richNode(component, data) {
  return { component, version: CATALOG[component].version, data };
}

export function richHeadingLevel(level, previous) {
  return Math.min(level, previous + 1, CATALOG['rich-heading'].data.level.maximum);
}

// The inline content of each paragraph, heading, list item and quote paragraph, with its path in the fill.
function* runs(blocks) {
  for (const [index, { component, data }] of blocks.entries()) {
    const at = `data.blocks[${index}].data`;
    if (component === 'rich-paragraph' || component === 'rich-heading') yield [at, data.content];
    if (component === 'rich-list') {
      for (const [item, node] of data.items.entries()) yield [`${at}.items[${item}].data`, node.data.content];
    }
    if (component === 'rich-quote') {
      for (const [item, node] of data.paragraphs.entries()) yield [`${at}.paragraphs[${item}].data`, node.data.content];
    }
  }
}

// The contract format does not give the heading order, total inline count or link policy.
export function richTextRules(data, schemes = richTextLinkSchemes()) {
  let level = 0;
  for (const [index, block] of data.blocks.entries()) {
    if (block.component !== 'rich-heading') continue;
    if (block.data.level !== richHeadingLevel(block.data.level, level)) return [`data.blocks[${index}].data.level: a heading cannot skip a level`];
    level = block.data.level;
  }
  let count = 0;
  for (const [at, content] of runs(data.blocks)) {
    count += content.length;
    if (count > MAX_INLINE) return [`data.blocks: more than ${MAX_INLINE} inline nodes`];
    for (const [index, node] of content.entries()) {
      if (node.component === 'rich-link' && !parseLinkURL(node.data.url, schemes)) {
        return [`${at}.content[${index}].data.url: the page does not permit this link`];
      }
    }
  }
  return [];
}

// The editor value is a nested fill. Its parent supplies the slots.
export function richTextValueErrors(value, schemes = richTextLinkSchemes()) {
  if (value?.component !== 'rich-text') return ['value.component: must be rich-text'];
  const errors = fillErrors(value, CATALOG, 'value', 1);
  return errors.length ? errors : richTextRules(value.data, schemes);
}

// Compare two validated values. The order of the keys in a fill has no effect.
export function sameRichTextValue(first, second) {
  if (first === second) return true;
  if (!first || !second || first.component !== 'rich-text' || second.component !== 'rich-text') return false;
  function same(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]));
  }
  return same(first, second);
}
