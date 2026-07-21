# CMS Phase-2 Inner Tracker Grafana Dashboard Generator

This directory generates interactive Grafana detector-monitoring dashboards for
the CMS Phase-2 Inner Tracker using the Business Charts panel and Apache ECharts
custom series.

## Requirements

- Python 3
- PyYAML
- Grafana with Business Charts installed
- A Prometheus data source with UID `prometheus`

```bash
python3 -m pip install PyYAML
```

The configured versions are Grafana `13.1.0` and Business Charts `7.2.5`.

## Generate dashboards

Run from this directory:

```bash
python3 generate_dashboard.py
```

The configured registers currently produce:

```text
json_files/cmsit_internal_ntc_abs_dashboard.json
json_files/cmsit_internal_ntc_abs_barrel_dashboard.json
json_files/cmsit_internal_ntc_abs_forward_dashboard.json
json_files/cmsit_internal_ntc_abs_endcap_dashboard.json
json_files/cmsit_internal_ntc_rel_dashboard.json
json_files/cmsit_internal_ntc_rel_barrel_dashboard.json
json_files/cmsit_internal_ntc_rel_forward_dashboard.json
json_files/cmsit_internal_ntc_rel_endcap_dashboard.json
```

The combined dashboard retains the complete Barrel, Forward, and Endcap views.
The Barrel-only dashboard has one panel for each of its four layers. Forward and
Endcap dashboards have one panel for every disk on both detector sides.

Generate the chip-detail dashboard separately:

```bash
python3 generate_dashboard_chip_details.py
```

This produces `json_files/cmsit_chip_details_dashboard.json`. Both generators
create the `json_files` directory automatically when it does not exist.
Chip and module links pass the originating detector dashboard URL to the detail
dashboard. Its Back control returns to that originating dashboard.

## Interactive navigation

Forward and endcap:

```text
Overview → Disk → Left or right half
```

Barrel:

```text
Overview → Quadrant in the selected layer
```

Every barrel layer has invisible hit regions in the empty horizontal and
vertical gaps between its central axes and its modules. Hovering an axis-adjacent
gap previews that quadrant; clicking expands it while preserving the other
three layer plots. Every detail view keeps Back and Home controls. X and Y axes,
ticks, labels, and names remain visible in active barrel views.

Selecting a forward/endcap disk enlarges it while preserving the other disks as
clickable thumbnails in the same panel.

The individual Forward dashboard uses three disk panels per row. The individual
Endcap dashboard uses two disk panels per row. Isolated disk panels use a
tighter detector viewport and omit the duplicate in-chart heading.

Module and chip monitoring are separate actions:

- click the stronger module boundary to open the detail dashboard with
  `chip=All`;
- click a colored chip to open the detail dashboard for that chip only.

## Source layout

```text
inner_tracker_dashboard/
├── generate_dashboard.py
├── generate_dashboard_chip_details.py
├── config.py
├── geometry.py
├── templates.py
├── panels.py
├── register_limits.py
├── barrel_geometry.yaml
├── forward_geometry.yaml
├── endcap_geometry.yaml
├── INTERACTIVE_VIEWER_DESIGN.md
└── innertracker_template/
    ├── interaction.js
    ├── navigation.js
    ├── hover.js
    ├── barrel.js
    └── ring.js
```

Business Charts requires one `getOption` program per panel. `templates.py`
combines the three shared JavaScript files with either `barrel.js` or `ring.js`
and injects the detector configuration.

- `interaction.js` manages chart state, events, hover identity, ECharts updates,
  and module/chip dashboard URLs.
- `navigation.js` manages selection, history, Back/Home, and breadcrumbs.
- `hover.js` contains shared transition and highlight styling.
- `ring.js` renders forward/endcap disks, halves, modules, and chips.
- `barrel.js` renders layers, quadrants, modules, and chips.

## Geometry and registers

Hardware mappings are stored in:

```text
barrel_geometry.yaml
forward_geometry.yaml
endcap_geometry.yaml
```

Mapping keys use `board/optical_group/hybrid`. Detector layout constants and
the register list are in `config.py`. Limits and units are in
`register_limits.py`.

After changing geometry, layouts, registers, or JavaScript, rerun
`generate_dashboard.py` and import the generated JSON files into Grafana.

Python caches, `.DS_Store`, and temporary files are not required when
transferring the directory. Generated JSON files may be transferred directly or
regenerated on the destination computer.
