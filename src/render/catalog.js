// The contracts that the kit knows. CI validates each one with tools/catalog.py.
import button from '../../catalog/button.json' with { type: 'json' };
import field from '../../catalog/field.json' with { type: 'json' };
import grid from '../../catalog/grid.json' with { type: 'json' };
import stack from '../../catalog/stack.json' with { type: 'json' };
import text from '../../catalog/text.json' with { type: 'json' };

export const CATALOG = Object.freeze(Object.assign(Object.create(null), { button, field, grid, stack, text }));
