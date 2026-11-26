#!/usr/bin/env node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, open, serve, sleep, startChrome } from './browser_check.mjs';

const CASES = [
  { id: 'text-500', messageCount: 500, gridRows: 0 },
  { id: 'text-1000', messageCount: 1000, gridRows: 0 },
  { id: 'grid-500', messageCount: 500, gridRows: 200 },
];
const TARGET = { caseId: 'text-500', targetMs: 16, marginMs: 16 };

async function heapUsage(session, sessionId) {
  await session.send('HeapProfiler.collectGarbage', {}, sessionId);
  const { usedSize, embedderHeapUsedSize } = await session.send('Runtime.getHeapUsage', {}, sessionId);
  return { jsHeapBytes: usedSize, embedderHeapBytes: embedderHeapUsedSize };
}

async function measureCase(session, sessionId, benchCase) {
  let timer;
  const limit = new Promise((_, fail) => {
    timer = setTimeout(() => fail(new Error('The bench case did not finish in 30 seconds.')), 30000);
  });
  try {
    return await Promise.race([evaluate(session, sessionId, `window.muRunThreadBench(${JSON.stringify(benchCase)})`), limit]);
  } finally {
    clearTimeout(timer);
  }
}

export async function runThreadBench(session, base) {
  const cases = [];
  const { targetId } = await session.send('Target.createTarget', { url: 'about:blank' });
  try {
    const { sessionId } = await session.send('Target.attachToTarget', { targetId, flatten: true });
    await session.send('Page.enable', {}, sessionId);
    await session.send('Page.bringToFront', {}, sessionId);
    await session.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
    for (const benchCase of CASES) {
      try {
        await open(session, sessionId, `${base}/tests/browser/thread-bench.html`);
        const before = await heapUsage(session, sessionId);
        const result = await measureCase(session, sessionId, benchCase);
        const after = await heapUsage(session, sessionId);
        const sorted = [...result.samplesMs].sort((a, b) => a - b);
        const middle = (sorted.length - 1) / 2;
        const medianMs = (sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2;
        const p95Ms = sorted[Math.ceil(sorted.length * 0.95) - 1];
        if (!Number.isFinite(p95Ms)) throw new Error('The bench did not give a valid update time.');
        cases.push({ ...benchCase, ...result, medianMs, p95Ms, memory: { before, after } });
      } catch (error) {
        throw new Error(`${benchCase.id}: ${error.message}`, { cause: error });
      }
    }
  } finally {
    await session.send('Target.closeTarget', { targetId });
  }

  const { p95Ms } = cases.find(({ id }) => id === TARGET.caseId);
  const limitMs = TARGET.targetMs + TARGET.marginMs;
  const errors = p95Ms > limitMs ? [`Thread bench ${TARGET.caseId}: the 95th percentile was ${p95Ms.toFixed(2)} ms. The CI limit is ${limitMs} ms.`] : [];
  return { target: { ...TARGET, limitMs, met: p95Ms < TARGET.targetMs }, cases, errors };
}

async function main() {
  let server;
  let profile;
  let chrome;
  const report = { passed: false, chrome: '', errors: [] };
  try {
    server = await serve();
    profile = mkdtempSync(join(tmpdir(), 'mugham-thread-bench-'));
    const started = await startChrome(profile);
    chrome = started.chrome;
    const { session } = started;
    report.chrome = (await session.send('Browser.getVersion')).product;
    report.threadBench = await runThreadBench(session, `http://127.0.0.1:${server.address().port}`);
    report.errors.push(...report.threadBench.errors);
  } catch (error) {
    report.errors.push(error.message);
  } finally {
    chrome?.kill();
    server?.close();
    if (profile) {
      await sleep(200);
      rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
    }
  }
  report.passed = report.errors.length === 0;
  process.stdout.write(JSON.stringify(report, null, 2) + '\n', () => process.exit(report.passed ? 0 : 1));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
