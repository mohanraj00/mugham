// The contracts that the kit knows. CI validates each one with tools/catalog.py.
import actionButton from '../../catalog/action-button.json' with { type: 'json' };
import button from '../../catalog/button.json' with { type: 'json' };
import card from '../../catalog/card.json' with { type: 'json' };
import cardGrid from '../../catalog/card-grid.json' with { type: 'json' };
import choiceField from '../../catalog/choice-field.json' with { type: 'json' };
import citation from '../../catalog/citation.json' with { type: 'json' };
import dateField from '../../catalog/date-field.json' with { type: 'json' };
import editableForm from '../../catalog/editable-form.json' with { type: 'json' };
import excerpt from '../../catalog/excerpt.json' with { type: 'json' };
import fact from '../../catalog/fact.json' with { type: 'json' };
import field from '../../catalog/field.json' with { type: 'json' };
import grid from '../../catalog/grid.json' with { type: 'json' };
import longTextField from '../../catalog/long-text-field.json' with { type: 'json' };
import numberField from '../../catalog/number-field.json' with { type: 'json' };
import stack from '../../catalog/stack.json' with { type: 'json' };
import text from '../../catalog/text.json' with { type: 'json' };
import table from '../../catalog/table.json' with { type: 'json' };
import tableRow from '../../catalog/table-row.json' with { type: 'json' };

export const CATALOG = Object.freeze(Object.assign(Object.create(null), {
  'action-button': actionButton, button, card, 'card-grid': cardGrid, 'choice-field': choiceField, citation, 'date-field': dateField,
  'editable-form': editableForm, excerpt, fact, field, grid, 'long-text-field': longTextField, 'number-field': numberField, stack,
  text, table, 'table-row': tableRow,
}));
