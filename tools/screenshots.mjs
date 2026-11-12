#!/usr/bin/env node
// Write the README screenshots to docs/screenshots/. It renders tests/browser/gallery.html with synthetic data in
// headless Chrome, with the helpers of tools/browser_check.mjs. It uses only Node.js and Chrome. See decision 0001.
// The images are documentation. tools/build.py does not put them in the package.
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, evaluate, open, serve, sleep, startChrome } from './browser_check.mjs';

const OUT = join(ROOT, 'docs', 'screenshots');
const MODES = ['light', 'dark'];
// Each section of the gallery and the state that its first element must show.
const EXPECTED = {
  'action-button-default': 'default', 'action-button-pending': 'pending', 'action-button-done': 'done',
  'action-button-error': 'error', 'editable-form-default': 'default', 'editable-form-pending': 'pending',
  'editable-form-done': 'done',
};

async function main() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = mkdtempSync(join(tmpdir(), 'mugham-chrome-'));
  let chrome;
  const written = [];
  try {
    const started = await startChrome(profile);
    chrome = started.chrome;
    const { session } = started;
    const { targetId } = await session.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await session.send('Target.attachToTarget', { targetId, flatten: true });
    for (const method of ['Page.enable', 'Runtime.enable']) await session.send(method, {}, sessionId);
    await session.send('Emulation.setDeviceMetricsOverride', { width: 840, height: 800, deviceScaleFactor: 2, mobile: false }, sessionId);
    mkdirSync(OUT, { recursive: true });
    for (const name of readdirSync(OUT)) if (name.endsWith('.png')) rmSync(join(OUT, name));
    for (const mode of MODES) {
      await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] }, sessionId);
      await open(session, sessionId, `${base}/tests/browser/gallery.html`);
      let sections = null;
      for (let i = 0; i < 100 && !sections; i += 1) {
        sections = await evaluate(session, sessionId, 'window.muGallery || null');
        if (!sections) await sleep(50);
      }
      if (!sections) throw new Error('the gallery did not render');
      await evaluate(session, sessionId, 'document.fonts.ready.then(() => true)');
      for (const { id, state } of sections) {
        if (EXPECTED[id] && EXPECTED[id] !== state) throw new Error(`${id}: the state is ${state}, not ${EXPECTED[id]}`);
        const box = await evaluate(session, sessionId, `(() => { const r = document.getElementById(${JSON.stringify(id)})
          .getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; })()`);
        const { data } = await session.send('Page.captureScreenshot',
          { format: 'png', clip: { ...box, scale: 1 }, captureBeyondViewport: true }, sessionId);
        const file = `${id}-${mode}.png`;
        writeFileSync(join(OUT, file), Buffer.from(data, 'base64'));
        written.push(file);
      }
    }
  } finally {
    if (chrome) chrome.kill();
    server.close();
    await sleep(200);
    rmSync(profile, { recursive: true, force: true });
  }
  console.log(JSON.stringify({ folder: 'docs/screenshots', images: written }, null, 2));
}

main().catch((error) => {
  console.error(String(error.message || error));
  process.exit(1);
});
