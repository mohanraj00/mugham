# Register a component

Release: v0.9.0

## Purpose

Add a domain component of your application. The kit checks each fill of it with the same rules as a catalog component.

## API call

`register(contract, element)` from `src/components/index.js`. `contract` is a contract in the short form or the full form. `element` is a class that extends `MuElement`, with `static component` set to the contract name. The call defines the element as `mu-app-<name>` and returns that tag.

## Example

<!-- source: examples/cards/register.js -->
```js
define();
defineThread();
register(SEED_TRAY, SeedTray);

const AGENT = { type: 'agent', id: 'agent-garden', name: 'Garden helper' };
const { mount, outer } = createKit({ actor: AGENT });
```

<!-- source: examples/cards/register.js -->
```js
// A valid fill. The element shows it.
const valid = mount('seed-tray', { label: 'Tray A1', sown: '2026-03-02', seedlings: 24, stage: 'sprouted' });
// The contract permits 200 seedlings at most, so the element refuses this fill.
const invalid = mount('seed-tray', { label: 'Tray A2', sown: '2026-03-02', seedlings: 500, stage: 'sown' });
```

The contract is [seed-tray.json](../../../examples/cards/seed-tray.json). The element is in [register.js](../../../examples/cards/register.js). Make each node with `el` from `src/render/dom.js`, so that each value stays text.

## Result

- `mu-app-seed-tray` shows tray A1.
- Tray A2 shows a refusal, because 500 is more than the maximum of 200.
- A thread accepts a `seed-tray` part, and still refuses an undeclared component.

## Errors

`register` throws a `TypeError` and changes nothing if:

- the contract is missing or not valid;
- the name is the name of a catalog contract, or it is already registered;
- `static component` of the element is not the contract name;
- the tag `mu-app-<name>` is already defined.

[catalog/README.md](../../../catalog/README.md#application-contracts) gives the rules. [Contracts](../contracts.md) shows how to write a contract.
