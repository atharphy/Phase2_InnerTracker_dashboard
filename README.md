# CMSIT Full Pixel Dashboard Generator

This directory contains the Python scripts used to generate the Grafana dashboards for the CMS Inner Tracker monitoring.

The dashboard is generated automatically from detector geometry YAML files and JavaScript ECharts templates, allowing the detector layout and visualization logic to be maintained independently.

---

# Directory Structure

```
innertracker_dashboard/
│
├── generate_dashboard.py
├── generate_dashboard_chip_details.py
│
├── config.py
├── geometry.py
├── templates.py
├── panels.py
│
├── register_limits.py
│
├── barrel_geometry.yaml
├── forward_geometry.yaml
├── endcap_geometry.yaml
│
└── innertracker_template/
    ├── barrel.js
    └── ring.js
```

---

# Overview

The dashboard generation is divided into four parts:

1. Detector geometry
2. Dashboard configuration
3. JavaScript drawing templates
4. Dashboard assembly

The generated output is

```
cmsit_full_pixel_geometry_dashboard.json
```

which can be imported directly into Grafana.

---

# File Descriptions

## generate_dashboard.py

Main dashboard generator.

Responsibilities:

- loads detector geometry
- creates panel configuration
- injects configuration into JavaScript templates
- assembles the Grafana dashboard JSON

Normally this is the only script that needs to be executed.

Run

```bash
python3 generate_dashboard.py
```

---

## config.py

Contains global configuration shared across the dashboard.

Examples include

- dashboard title
- dashboard UID
- Grafana versions
- refresh interval
- detector layouts
- chip layouts
- template filenames
- geometry filenames

If detector constants change, this is usually the place to edit them.

---

## geometry.py

Responsible for reading and validating detector geometry YAML files.

It

- loads YAML files
- validates detector positions
- checks module numbering
- checks ladder numbering
- verifies disk/ring consistency

It returns validated Python dictionaries that are later used by the dashboard generator.

---

## panels.py

Contains helper functions used to construct Grafana panels.

This includes

- Prometheus query generation
- Register limits table
- Shared panel configuration
- ECharts panel construction

No detector-specific drawing logic is contained here.

---

## templates.py

Loads the JavaScript templates stored inside

```
innertracker_template/
```

These templates contain the ECharts drawing logic.

Python simply injects detector configuration into these templates before embedding them into the Grafana dashboard.

---

## register_limits.py

Defines

- nominal values
- minimum limits
- maximum limits
- display units

for every monitored register.

These values are used for

- chip colouring
- limits table
- axis labels

Adding a new register normally only requires updating this file.

---

# Geometry Files

The detector mapping is stored in

```
barrel_geometry.yaml
forward_geometry.yaml
endcap_geometry.yaml
```

These files map hardware

```
board/optical_group/hybrid
```

to detector positions.

Example

```yaml
0/0/1:
  layer: 2
  signed_ladder: -3
  z_side: z+
  module_index: 4
```

Changing hardware mapping only requires editing these YAML files.

No Python code should need modification.

---

# JavaScript Templates

The folder

```
innertracker_template/
```

contains the ECharts code.

```
barrel.js
```

Draws the barrel detector.

```
ring.js
```

Draws both

- Forward
- Endcap

The same template is reused by passing different detector layouts from Python.

Most users should not need to modify these files unless changing the detector visualization itself.

---

# Adding a New Register

1. Add the register to

```
register_limits.py
```

2. Add the register name to

```python
REGISTERS = [
    ...
]
```

inside `config.py`.

Re-run

```bash
python3 generate_dashboard.py
```

The new register will automatically appear throughout the dashboard.

---

# Updating Detector Geometry

Only edit

```
barrel_geometry.yaml
forward_geometry.yaml
endcap_geometry.yaml
```

After updating the geometry simply regenerate the dashboard.

No JavaScript changes are required.

---

# Changing Detector Layout

Detector constants such as

- number of layers
- number of disks
- ring radii
- module types

are defined in

```
config.py
```

If the detector design changes these values should be updated there.

---

# Changing Dashboard Appearance

Panel sizes, descriptions and ordering are controlled inside

```
generate_dashboard.py
```

The detector drawing itself is controlled inside

```
innertracker_template/
```

---

# Workflow

```
Geometry YAML
        │
        ▼
geometry.py
        │
        ▼
Validated detector geometry
        │
        ▼
generate_dashboard.py
        │
        ├────────► config.py
        │
        ├────────► panels.py
        │
        ├────────► templates.py
        │
        ▼
Inject configuration into
barrel.js / ring.js
        │
        ▼
Grafana dashboard JSON
        │
        ▼
Import into Grafana
```

---

# Chip Details Dashboard

The file

```
generate_dashboard_chip_details.py
```

creates a separate dashboard containing time-series plots for individual chips.

It is intentionally kept as a standalone script because it is relatively small and does not share the detector geometry logic used by the main dashboard.

---

# Summary

Most common modifications only require editing a single file:

| Change | File |
|---------|------|
| Add register | `register_limits.py`, `config.py` |
| Update hardware mapping | `*.yaml` |
| Change detector layout | `config.py` |
| Change detector drawing | `innertracker_template/*.js` |
| Change Grafana panel layout | `generate_dashboard.py` |
| Change chip-details dashboard | `generate_dashboard_chip_details.py` |
