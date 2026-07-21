# CMS Phase-2 Inner Tracker Detector Parts Dashboard

This project generates a Grafana Business Charts dashboard for building a
custom workspace from independently selected detector parts.

## Selection workflow

The Business Charts panel provides three context-sensitive selectors:

1. Subdetector: `TBPX`, `TEPX`, or `TFPX`.
2. Geometry: Barrel Layer 1--4, TEPX Disk 1--4, or TFPX Disk 1--8.
3. Part:
   - TBPX: `Ladder (+) Z (+)`, `Ladder (+) Z (-)`,
     `Ladder (-) Z (+)`, or `Ladder (-) Z (-)`.
   - TEPX/TFPX: `Left (+Z side)`, `Right (+Z side)`,
     `Left (-Z side)`, or `Right (-Z side)`.

Select `Add panel` to retain the chosen part in the workspace. Every detector
card has its own `Delete` control. Cards are independent, so Barrel, Endcap,
and Forward parts can be compared in the same Business Charts panel.
Expanded selector menus move the detector-card area downward to prevent menu,
message, and card overlap. A single ring card uses the full available width and
a taller geometry area; multiple cards switch to the responsive comparison
layout.

Barrel cards retain signed-ladder and module-position-along-Z labels. Ring
cards divide disks on the vertical Y axis, so Left and Right are horizontal
detector sides rather than upper and lower semicircles. Ring cards preserve the
interactive viewer's blue Inner Disk bands, orange Outer Disk bands, module
gaps, dark empty-module fill, lighter internal divisions, and live-chip colors.
Strong module
boundaries open all module chips in the chip-detail dashboard. Individual chip
areas open only the selected chip.

## Requirements

- Python 3
- PyYAML
- Grafana 13.1.0
- Business Charts 7.2.5
- Prometheus datasource UID `prometheus`

```bash
python3 -m pip install --user pyyaml
```

## Generate dashboards

Run from this directory:

```bash
python3 generate_dashboard.py
```

The configured registers produce:

```text
json_files/cmsit_internal_ntc_abs_parts_dashboard.json
json_files/cmsit_internal_ntc_rel_parts_dashboard.json
```

Generate the shared chip-detail dashboard separately:

```bash
python3 generate_dashboard_chip_details.py
```

All JSON output is written to `json_files/`, which is created automatically.
The geometry mappings remain in `barrel_geometry.yaml`,
`forward_geometry.yaml`, and `endcap_geometry.yaml`.

## Workspace behavior

The selected-card list is held in the ECharts panel runtime. It remains while
the dashboard is open and while monitoring data refreshes. Reloading the full
browser page resets the workspace. Persisting a workspace across reloads would
require serializing its selected parts into dashboard variables or browser
storage.
