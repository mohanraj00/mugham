# Table

[table.json](../catalog/table.json) declares `mu-table`. [table-row.json](../catalog/table-row.json) declares each nested row. A row has no separate element, the same as a fact in a card. [examples/tables/table.html](../examples/tables/table.html) shows synthetic rows and an empty table.

The table has a required `label`, one to 12 text headers in `columns`, and zero to 500 fills in `rows`. Each row has a `cells` list with one text value per column, in column order. A cell can be blank. A header cannot be blank. All values show as text.

The optional `status_values` list declares up to 20 allowed status texts. If it is not empty, the table adds a column with the header `Status`. Each row can have one `status` from this list. A row with no status has a blank status cell. The application or the connected service decides each status. The kit shows the supplied text. It makes no decision from a cell value.

The optional `sort_key` is a zero-based index in `columns`. The optional `sort_direction` is `ascending` or `descending`. It needs a sort key and defaults to `ascending`. Without a sort key, the rows keep their input order. Sorting compares the cell strings in JavaScript string order. It does not convert text to numbers or dates. Equal cells keep their input order in each direction. Sorting changes no fill data. A new fill resets the sort to the values in that fill.

Each data column header has a native button. Tab and Shift+Tab move between buttons. Enter or Space sorts the column. A press on an unsorted column starts in ascending order. A press on the sorted column changes the direction. Only the sorted header has `aria-sort`. A polite status gives the header and direction as text. Focus stays on the button. The status column has no sort button.

The named group holds a native table with a caption, `thead`, `th` with `scope="col"`, and `tbody`. Thus each data cell has a column header. The group can take focus so that a keyboard can scroll a wide table. Forced colors keep the borders and buttons visible. The table has no motion. A table of more than 30rem scrolls in the group, and the column headers stay in view. The author stays in view at the bottom of the group.

The `default` state shows rows. The `empty` state shows `No rows. Change the request, or try again later.`, the caption, the headers and the author. The `refused` state shows a status with the reason and the next step, and no table. [Interaction details](../src/components/interaction.md) gives the rules for each component. Besides the field limits, the element refuses an empty column list, a row with the wrong cell count, a sort key outside the columns, a direction with no key, or a status outside `status_values`. The element checks these relations because contract format 2 cannot compare fields.

The required authorship slot follows the actor rule of the kit. Only the outer table fill has slots. A thread binds its envelope actor before it fills the table.

`MuTable` is exported from [src/components/table.js](../src/components/table.js) and [src/components/index.js](../src/components/index.js). Another component can call `define()`, create `mu-table`, bind its `actor`, and set its `fill`. A chart can use this element for its table view.
