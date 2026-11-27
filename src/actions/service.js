// Binds one action handler to one service: a base URL and a short service name. The application gives the
// transport, so it owns the sign-in and the credentials. The service owns the decision. This helper only selects
// the URL and maps the HTTP response to a receipt.

const MAX_SERVICE = 80;
// A receipt body is small. A larger body is not a receipt.
const MAX_BODY = 4096;

const isPlain = (value) => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const isText = (value, max) => typeof value === 'string' && value.length >= 1 && [...value].length <= max;

// Maps an HTTP response of a service to a receipt. These rules apply:
// - A 2xx response with the JSON body { ok: true } gives a receipt with ok true.
// - A 2xx or 4xx response with the JSON body { ok: false, code } gives a refusal with the service name and the code.
// - Any other status or body throws an error. Then no receipt came back, and the action stays pending.
// The body can also give id, key, message and reference. The action checks each value before it shows it as text.
// The service name comes from the binding, never from the body.
export async function receiptFromResponse(response, service) {
  if (!isText(service, MAX_SERVICE)) throw new TypeError('The service name must be a text of 1 to 80 characters.');
  if (!response || !Number.isInteger(response.status) || typeof response.text !== 'function') {
    throw new TypeError('No receipt came back: the result is not an HTTP response.');
  }
  const { status } = response;
  const accepted = status >= 200 && status < 300;
  if (!accepted && !(status >= 400 && status < 500)) throw new TypeError(`No receipt came back: the status is ${status}.`);
  const text = await response.text();
  if (typeof text !== 'string' || text.length > MAX_BODY) throw new TypeError('No receipt came back: the body is not valid.');
  const body = JSON.parse(text);
  if (!isPlain(body) || typeof body.ok !== 'boolean') throw new TypeError('No receipt came back: the body has no ok value.');
  if (body.ok && !accepted) throw new TypeError(`No receipt came back: the status ${status} does not agree with ok.`);
  if (!body.ok && (typeof body.code !== 'string' || body.code.length === 0)) throw new TypeError('No receipt came back: a refusal needs a code.');
  const receipt = { ok: body.ok };
  for (const field of ['id', 'key', 'message', 'reference']) {
    if (Object.hasOwn(body, field)) receipt[field] = body[field];
  }
  if (!body.ok) {
    receipt.service = service;
    receipt.code = body.code;
  }
  return receipt;
}

// Returns a handler for onAction. The handler sends each request to a URL below the base URL, and returns the
// receipt of the response.
// - service: the short name of the service, 1 to 80 characters. The kit shows it with a refusal.
// - base: the absolute http or https URL of the service API.
// - send(url, request): the transport of the application. It returns a promise of a Response, for example from
//   fetch. It adds the credentials. If it throws, no receipt came back.
// - path(tool, args, request): the path of the request, relative to the base URL. The default is the tool name.
export function serviceHandler({ service, base, send, path = (tool) => encodeURIComponent(tool) } = {}) {
  if (!isText(service, MAX_SERVICE)) throw new TypeError('The service name must be a text of 1 to 80 characters.');
  if (typeof send !== 'function' || typeof path !== 'function') throw new TypeError('send and path must be functions.');
  let root;
  try {
    root = new URL(base);
  } catch {
    throw new TypeError('The base must be an absolute URL.');
  }
  if ((root.protocol !== 'https:' && root.protocol !== 'http:') || root.username || root.password) {
    throw new TypeError('The base must be an http or https URL with no user name or password.');
  }
  root.search = '';
  root.hash = '';
  if (!root.pathname.endsWith('/')) root.pathname += '/';
  const prefix = root.href;
  return async (tool, args, id, request) => {
    const relative = path(tool, args, request);
    if (typeof relative !== 'string') throw new TypeError('The path must be a text.');
    const url = new URL(relative, prefix);
    // A path cannot leave the base URL, for example with another origin or with "../".
    if (url.origin !== root.origin || !url.href.startsWith(prefix)) throw new TypeError('The path leaves the base URL.');
    return receiptFromResponse(await send(url.href, request), service);
  };
}
