// These checks exercise the real image policy without a DOM or a request. Browser checks cover rendering.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fillErrors } from '../src/render/validate.js';
import { CATALOG } from '../src/render/catalog.js';

// Only module setup needs these two browser classes. No test constructs a fake image or a fake dialog.
globalThis.HTMLElement = class {};
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.location = { origin: 'https://example.org' };
const { MuImage } = await import('../src/components/image.js');
const DATA = { url: '/plan.svg', alt: 'Two rooms with a door.', width: 480, height: 320 };
const errors = (data = DATA) => MuImage.prototype.check(data);
const fill = (data) => ({ component: 'image', version: '0.1.0', data,
  slots: { authorship: { type: 'agent', id: 'agent-plan' } } });

test('image: the guide sets matching same-origin policies before it loads images', () => {
  const html = readFileSync(new URL('../examples/guides/image.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../examples/guides/image.js', import.meta.url), 'utf8');
  assert.match(html, /http-equiv="Content-Security-Policy" content="[^"]*; img-src 'self';/);
  assert.match(html, /Content-Security-Policy"[\s\S]*<script type="module" src="image\.js">/);
  assert.match(script, /MuImage\.allowedOrigins = \[location\.origin\];[\s\S]*mount\('image',/);
});

test('image: the default policy refuses each image', () => {
  assert.deepEqual(MuImage.allowedOrigins, []);
  assert.deepEqual(errors(), ['data.url: the page does not permit this image URL']);
});

test('image: a page policy is an immutable copy of exact origins', () => {
  const allowed = ['https://example.org'];
  MuImage.allowedOrigins = allowed;
  allowed.push('https://example.net');
  assert.deepEqual(MuImage.allowedOrigins, ['https://example.org']);
  assert.equal(Object.isFrozen(MuImage.allowedOrigins), true);
  for (const origin of [null, '', 'null', 'https://example.net/', 'https://example.net/path',
    'https://user@example.net', 'https://example.net?x', 'https://example.net#x', 'data:', 'blob:']) {
    assert.throws(() => { MuImage.allowedOrigins = [origin]; }, TypeError);
    assert.deepEqual(MuImage.allowedOrigins, ['https://example.org']);
  }
  assert.throws(() => { MuImage.allowedOrigins = 'https://example.net'; }, TypeError);
});

test('image: relative URLs use the page origin and permitted http or https URLs pass', () => {
  MuImage.allowedOrigins = ['https://example.org', 'http://example.net:8080'];
  for (const url of ['plan.svg', '/plan.svg', '//example.org/plan.svg', 'https://example.org/plan.svg',
    'https://example.org:443/plan.svg', 'http://example.net:8080/plan.svg']) {
    assert.deepEqual(errors({ ...DATA, url }), [], url);
  }
});

test('image: schemes, credentials, invalid URLs and different origins are refused', () => {
  MuImage.allowedOrigins = ['https://example.org'];
  for (const url of ['javascript:alert(1)', 'java\tscript:alert(1)', 'data:image/svg+xml,<svg/>',
    'blob:https://example.org/plan', 'file:///plan.svg', 'https://[', 'https://user:secret@example.org/plan.svg',
    'https://example.org.evil.invalid/plan.svg', 'https://example.org@other.invalid/plan.svg',
    'http://example.org/plan.svg', 'https://example.org:444/plan.svg', '//example.net/plan.svg',
    'https://example.net/plan.svg']) {
    assert.deepEqual(errors({ ...DATA, url }), ['data.url: the page does not permit this image URL'], url);
  }
});

test('image: a fill cannot change the page policy or request options', () => {
  MuImage.allowedOrigins = ['https://example.org'];
  for (const field of ['allowedOrigins', 'origins', 'srcset', 'style', 'referrerpolicy']) {
    assert.deepEqual(fillErrors(fill({ ...DATA, [field]: 'untrusted' }), CATALOG),
      ['data.' + field + ': the contract does not declare this field']);
    assert.deepEqual(MuImage.allowedOrigins, ['https://example.org']);
  }
});

test('image: only the decorative flag permits an empty text alternative', () => {
  for (const alt of ['', ' \n\t']) assert.deepEqual(errors({ ...DATA, alt }),
    ['data.alt: a text alternative is required unless decorative is true']);
  assert.deepEqual(errors({ ...DATA, alt: '', decorative: true }), []);
  assert.deepEqual(errors({ ...DATA, alt: 'A room.' }), []);
});

test('image: valid data stays data and page policy changes take effect', () => {
  const data = { ...DATA, alt: '<img src=x>', caption: '<script>bad</script>' };
  const before = structuredClone(data);
  assert.deepEqual(fillErrors(fill(data), CATALOG), []);
  assert.deepEqual(errors(data), []);
  assert.deepEqual(data, before);
  MuImage.allowedOrigins = [];
  assert.deepEqual(errors(data), ['data.url: the page does not permit this image URL']);
});
