# Chart

Release: v0.9.0

`mu-chart` draws a bar chart, a line chart or a stacked bar chart as SVG. Its type is `bar`, `line` or `stacked_bar`. It uses no chart library. [The contract](../catalog/chart.json) declares the title, type, categories, series, units and axis labels. Each series uses [chart-series](../catalog/chart-series.json).

Use 1 to 50 categories and 1 to 6 series. Each series has one value for each category, in the same order. A category can be a date as text. A value must be a finite number from -1000000000000 to 1000000000000. The element refuses empty lists, a different value count, values of another type and data above these limits. The application or its service gives the data. The kit makes no decision.

Each series has a number, a text label and a fixed line pattern. Each point shows its series number and value. The scale includes zero. Stacked bars keep positive and negative totals separate. A chart with only zero values uses a scale from zero to one. Long category labels use short lines. The plot can scroll in a narrow view.

Tab moves to one point in the chart. ArrowRight and ArrowDown move to the next point. ArrowLeft and ArrowUp move to the previous point. The order is each point of the first series, then each point of the next series. The keys wrap at each end. Focus on a point shows its full series label, category, value and units as text in a polite live region. Each SVG point also has this text as its accessible name.

`Show data table` opens the existing `mu-table` element. Its columns use the horizontal axis label and the series labels. Its rows use the categories and values. Each value includes its units. The table gets the trusted actor and authorship of the chart. `Hide data table` closes it. A new fill closes the table and resets the point in the Tab order.

All labels and author names stay text. An SVG node uses `document.createElementNS`. Its attributes have fixed names. Coordinates must be finite numbers. No fill can send markup, styles or code. The chart uses theme tokens and supports light, dark, forced colors and reduced motion.

[The example](../examples/media/chart.html) shows each type with synthetic data.
