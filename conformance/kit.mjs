// The driver of a kit for conformance/run.py. It reads one request on each input line and writes one answer line.
// conformance/README.md gives the format. The first argument is the folder of the kit.
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv.length !== 3) {
  console.error('usage: node kit.mjs path/to/kit');
  process.exit(2);
}
const kit = pathToFileURL(resolve(process.argv[2]) + '/');
const load = (path) => import(new URL(path, kit).href);
const { contractErrors, fillErrors } = await load('src/render/validate.js');
const { resolveContract } = await load('src/render/resolve.js');
const { readEnvelope, readStream } = await load('src/envelope/envelope.js');

// The full form of a contract, and the errors of the short form. With a catalog, a short form with no error
// gives the errors of its full form.
const resolved = (item, checked) => {
  const { contract, errors } = resolveContract(item.contract);
  if (errors.length) return { resolved: null, errors };
  return { resolved: contract, errors: checked ? contractErrors(contract, item.catalog) : [] };
};

const ANSWERS = {
  fill: (item) => ({ errors: fillErrors(item.fill, item.catalog) }),
  contract: (item) => ({ errors: contractErrors(item.contract, item.catalog) }),
  short: (item) => resolved(item, true),
  resolve: (item) => resolved(item, false),
  // The reader uses the catalog of the kit.
  envelope: (item) => ({ result: readEnvelope(item.envelope) }),
  stream: (item) => ({ result: readStream(item.events) }),
};

for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  const item = JSON.parse(line);
  if (!Object.hasOwn(ANSWERS, item.kind)) throw new Error(`the driver does not know the kind ${item.kind}`);
  process.stdout.write(JSON.stringify({ id: item.id, ...ANSWERS[item.kind](item) }) + '\n');
}
