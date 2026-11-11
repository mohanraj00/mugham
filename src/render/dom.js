// The only way the kit makes DOM nodes. Data goes into text nodes and into a short list of attributes.
// No function here parses a string as markup. tests/test_sinks.py refuses markup sinks in src/.
const ATTRIBUTES = new Set(['id', 'class', 'part', 'role', 'type', 'for', 'name', 'autocomplete', 'tabindex',
  'aria-label', 'aria-describedby', 'aria-invalid', 'aria-live', 'aria-disabled', 'data-state']);

export function text(value) {
  return document.createTextNode(String(value));
}

export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (!ATTRIBUTES.has(name)) throw new Error('attribute not allowed: ' + name);
    if (value === false || value === null || value === undefined) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : text(child));
  }
  return node;
}

export function sheet(css) {
  const result = new CSSStyleSheet();
  result.replaceSync(css);
  return result;
}

// Shared rules for each primitive: the focus ring, forced colors and reduced motion.
export const BASE = sheet(`
  :host { box-sizing: border-box; }
  :host([hidden]) { display: none; }
  *, *::before, *::after { box-sizing: inherit; }
  :focus-visible { outline: 2px solid var(--mu-color-focus); outline-offset: 2px; }
  .refused { font: var(--mu-type-caption); color: var(--mu-color-danger); }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition: none !important; animation: none !important; }
  }
  @media (forced-colors: active) {
    :focus-visible { outline-color: Highlight; }
    .refused { color: CanvasText; }
  }
`);
