# Interactive viewer design

The viewer keeps geometry drill-down inside the Business Charts panel and uses
Grafana navigation only for module and chip monitoring plots.

The chart instance stores the active view, selection, navigation history, hover
identity, and registered handlers. ECharts updates reuse stable series and datum
IDs and replace merged component arrays when the view changes.

Ring navigation uses overview, disk, and half views. Barrel navigation uses
overview, layer, and quadrant views. Module boundaries open all module chips in
the detail dashboard, while chip interiors open one chip.

Python composes `interaction.js`, `navigation.js`, `hover.js`, and the relevant
detector renderer into the single program required by Business Charts.
