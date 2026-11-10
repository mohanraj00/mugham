// The action path of the kit. An action is a tool name and its arguments. The application binds them in code.
// A fill never selects the tool. The state is pending until a receipt with the same id comes back.
const TOOL = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
const MAX_MESSAGE = 200;

function scalar(value) {
  return typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}

export function bindingErrors(binding) {
  if (binding === null || typeof binding !== 'object' || Array.isArray(binding)) return ['the action must be an object'];
  const errors = [];
  if (typeof binding.tool !== 'string' || binding.tool.length > 80 || !TOOL.test(binding.tool)) errors.push('the tool name is not valid');
  const args = binding.arguments ?? {};
  if (args === null || typeof args !== 'object' || Array.isArray(args)) errors.push('the arguments must be an object');
  else if (!Object.values(args).every(scalar)) errors.push('each argument must be a string, a number or true or false');
  return errors;
}

export class ActionState {
  #binding = null;
  #request = null;
  #state = 'disabled';
  #message = '';

  get state() {
    return this.#state;
  }

  get message() {
    return this.#message;
  }

  bind(binding) {
    if (binding === null) {
      this.#binding = null;
      this.#request = null;
      this.#state = 'disabled';
      this.#message = '';
      return [];
    }
    const errors = bindingErrors(binding);
    if (errors.length) return errors;
    this.#binding = Object.freeze({ tool: binding.tool, arguments: Object.freeze({ ...(binding.arguments ?? {}) }) });
    this.#request = null;
    this.#state = 'default';
    this.#message = '';
    return [];
  }

  // Returns a request, or null if the action cannot start now. The extra values come from a fill,
  // so they cannot change an argument that the application binds: the bound arguments come last.
  start(extra = {}) {
    if (!this.#binding || this.#state === 'pending' || this.#state === 'done') return null;
    this.#request = Object.freeze({ id: crypto.randomUUID(), tool: this.#binding.tool,
      arguments: Object.freeze({ ...extra, ...this.#binding.arguments }) });
    this.#state = 'pending';
    this.#message = '';
    return this.#request;
  }

  // After done or error, the action can start again. The message says why. A pending action cannot reopen,
  // because its receipt has not come back.
  reopen(message = '') {
    if (this.#state !== 'done' && this.#state !== 'error') return false;
    this.#state = 'default';
    this.#message = [...String(message)].slice(0, MAX_MESSAGE).join('');
    return true;
  }

  // Returns true if the receipt belongs to the pending request. Only a valid receipt changes the state.
  receipt(value) {
    if (!this.#request || this.#state !== 'pending' || value === null || typeof value !== 'object') return false;
    if (value.id !== this.#request.id || typeof value.ok !== 'boolean') return false;
    const message = value.message ?? '';
    if (typeof message !== 'string' || [...message].length > MAX_MESSAGE) return false;
    this.#state = value.ok ? 'done' : 'error';
    this.#message = message;
    this.#request = null;
    return true;
  }
}
