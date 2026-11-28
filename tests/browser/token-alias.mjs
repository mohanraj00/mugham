// Check the style of a component after a token name changes.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, evaluate, newPage, sleep, startChrome } from '../../tools/browser_check.mjs';

function padding(css, overrides) {
  document.documentElement.dataset.muMode = 'light';
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  const section = document.createElement('section');
  const host = document.createElement('mu-token-probe');
  const shadow = host.attachShadow({ mode: 'open' });
  const control = document.createElement('button');
  control.textContent = 'Sample control';
  control.style.paddingLeft = 'var(--mu-space-new-name, var(--mu-space-1, 1rem))';
  shadow.append(control);
  section.append(host);
  document.body.append(section);
  return overrides.map((value) => {
    section.style.cssText = value;
    return getComputedStyle(control).paddingLeft;
  });
}

const cases = [
  ['The component uses the default value', '', '12px'],
  ['The page sets only the old name', '--mu-space-1: 20px', '20px'],
  ['The page sets only the new name', '--mu-space-new-name: 24px', '24px'],
  ['The new name takes priority', '--mu-space-new-name: 24px; --mu-space-1: 20px', '24px'],
];
const profile = mkdtempSync(join(tmpdir(), 'mugham-chrome-'));
let chrome;
let report;
try {
  const css = execFileSync(process.env.PYTHON || 'python3', ['-B', '-c',
    "from tools.tokens import css, load; print(css(load('tests/vectors/renamed-tokens.json')))",
  ], { cwd: ROOT, encoding: 'utf8' });
  const started = await startChrome(profile);
  chrome = started.chrome;
  const { session } = started;
  const { sessionId } = await newPage(session);
  const overrides = cases.map(([, value]) => value);
  const values = await evaluate(session, sessionId, `(${padding})(${JSON.stringify(css)}, ${JSON.stringify(overrides)})`);
  const steps = cases.map(([step, , expected], i) => ({ step, ok: values[i] === expected, expected, value: values[i] }));
  report = { passed: steps.every((step) => step.ok), steps };
} catch (error) {
  report = { passed: false, error: String(error.message || error) };
} finally {
  if (chrome) chrome.kill();
  await sleep(200);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
}
process.stdout.write(JSON.stringify(report, null, 2) + '\n', () => process.exit(report.passed ? 0 : 1));
