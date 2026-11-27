// Rules shared by the display, the editor and each rich text value sent with an action.
import { CATALOG } from './catalog.js';
import { fillErrors, parseLinkURL } from './validate.js';

export const RICH_TEXT_SCHEMES = Object.freeze(['https:', 'http:', 'mailto:']);
export const RICH_TEXT_EDIT_LIMIT = 'The edit does not fit the rich text rules. Use less text or formatting.';
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

function skippedHeading(blocks) {
  let level = 0;
  for (const [index, block] of blocks.entries()) {
    if (block.component !== 'rich-heading') continue;
    const maximum = richHeadingLevel(block.data.level, level);
    if (block.data.level !== maximum) return { index, maximum };
    level = block.data.level;
  }
  return null;
}

function contentError(data, schemes) {
  let count = 0;
  for (const [at, content] of runs(data.blocks)) {
    count += content.length;
    if (count > MAX_INLINE) return `data.blocks: more than ${MAX_INLINE} inline nodes`;
    for (const [index, node] of content.entries()) {
      if (node.component === 'rich-link' && !parseLinkURL(node.data.url, schemes)) {
        return `${at}.content[${index}].data.url: the page does not permit this link`;
      }
    }
  }
  return '';
}

// The contract format does not give the heading order, total inline count or link policy.
export function richTextRules(data, schemes = richTextLinkSchemes()) {
  const heading = skippedHeading(data.blocks);
  const error = heading ? `data.blocks[${heading.index}].data.level: a heading cannot skip a level` : contentError(data, schemes);
  return error ? [error] : [];
}

// The editor value is a nested fill. Its parent supplies the slots.
function shapeErrors(value) {
  if (value?.component !== 'rich-text') return ['value.component: must be rich-text'];
  return fillErrors(value, CATALOG, 'value', 1);
}

export function richTextValueErrors(value, schemes = richTextLinkSchemes()) {
  const errors = shapeErrors(value);
  return errors.length ? errors : richTextRules(value.data, schemes);
}

export function richTextEditProblem(value) {
  if (shapeErrors(value).length || contentError(value.data, richTextLinkSchemes())) return RICH_TEXT_EDIT_LIMIT;
  const heading = skippedHeading(value.data.blocks);
  return heading ? `A heading cannot skip a level. Use Heading ${heading.maximum} first.` : '';
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
