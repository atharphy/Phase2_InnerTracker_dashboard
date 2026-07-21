#!/usr/bin/env python3

from pathlib import Path

def load_template(filename: str) -> str:
    return Path(
        "innertracker_template",
        filename,
    ).read_text(encoding="utf-8")


OUTPUT = "cmsit_full_pixel_geometry_dashboard.json"

DASHBOARD_TITLE = "CMSIT Full Pixel Geometry"
DASHBOARD_UID = "cmsit-full-pixel-geometry"

GRAFANA_VERSION = "13.1.0"
BUSINESS_CHARTS_VERSION = "7.2.5"

ECHARTS_PANEL_TYPE = "volkovlabs-echarts-panel"

FRESHNESS_SECONDS = 120

REGISTERS = [
    "INTERNAL_NTC_ABS",
    "INTERNAL_NTC_REL",
]

DETAILS_DASHBOARD_UID = "cmsit-parts-chip-details"
DETAILS_DASHBOARD_SLUG = "cmsit-parts-chip-details"


# Geometry files ( update this to update the individual modules and there location in ring/barrel)

BARREL_GEOMETRY_FILE = "barrel_geometry.yaml"
FORWARD_GEOMETRY_FILE = "forward_geometry.yaml"
ENDCAP_GEOMETRY_FILE = "endcap_geometry.yaml"


BARREL_TEMPLATE = load_template("barrel.js")
RING_TEMPLATE = load_template("ring.js")
INTERACTION_TEMPLATE = load_template("interaction.js")
NAVIGATION_TEMPLATE = load_template("navigation.js")
HOVER_TEMPLATE = load_template("hover.js")
PARTS_TEMPLATE = load_template("parts.js")


# TBPX geometry layout

# The ladder count is the count in one half-cylinder.
# The complete layer has twice this number of ladders.

BARREL_LAYOUT = {
    1: {
        "half_ladders": 6,
        "z_plus_modules": 5,
        "z_minus_modules": 4,
        "module_type": "double",
    },
    2: {
        "half_ladders": 12,
        "z_plus_modules": 4,
        "z_minus_modules": 5,
        "module_type": "double",
    },
    3: {
        "half_ladders": 10,
        "z_plus_modules": 5,
        "z_minus_modules": 4,
        "module_type": "quad",
    },
    4: {
        "half_ladders": 14,
        "z_plus_modules": 4,
        "z_minus_modules": 5,
        "module_type": "quad",
    },
}


# TFPX layout

# Rings 1 and 3 are on the Inner Disk surface.
# Rings 2 and 4 are on the Outer Disk surface.
#
# There are 8 disks on each detector side.

FORWARD_LAYOUT = {
    "n_disks": 8,
    "rings": {
        1: {
            "modules_per_half": 5,
            "disk_surface": "inner",
            "module_type": "double",
            "inner_radius": 0.30,
            "outer_radius": 0.66,
        },
        2: {
            "modules_per_half": 8,
            "disk_surface": "outer",
            "module_type": "double",
            "inner_radius": 0.74,
            "outer_radius": 1.08,
        },
        3: {
            "modules_per_half": 6,
            "disk_surface": "inner",
            "module_type": "quad",
            "inner_radius": 1.16,
            "outer_radius": 1.53,
        },
        4: {
            "modules_per_half": 8,
            "disk_surface": "outer",
            "module_type": "quad",
            "inner_radius": 1.61,
            "outer_radius": 1.98,
        },
    },
}

# TEPX layout

# Rings 1, 3 and 5 are on the Inner Disk surface.
# Rings 2 and 4 are on the Outer Disk surface.
#
# There are 4 disks on each detector side.
#
# All Endcap modules are quad modules.

ENDCAP_LAYOUT = {
    "n_disks": 4,
    "rings": {
        1: {
            "modules_per_half": 5,
            "disk_surface": "inner",
            "module_type": "quad",
            "inner_radius": 0.34,
            "outer_radius": 0.73,
        },
        2: {
            "modules_per_half": 7,
            "disk_surface": "outer",
            "module_type": "quad",
            "inner_radius": 0.82,
            "outer_radius": 1.21,
        },
        3: {
            "modules_per_half": 9,
            "disk_surface": "inner",
            "module_type": "quad",
            "inner_radius": 1.30,
            "outer_radius": 1.69,
        },
        4: {
            "modules_per_half": 11,
            "disk_surface": "outer",
            "module_type": "quad",
            "inner_radius": 1.78,
            "outer_radius": 2.17,
        },
        5: {
            "modules_per_half": 12,
            "disk_surface": "inner",
            "module_type": "quad",
            "inner_radius": 2.26,
            "outer_radius": 2.65,
        },
    },
}


# Chip layouts (how they are filled in the map per module). The chip layout is the same for both Barrel and Forward modules.

# Quad module:
#
# 0 1
# 3 2

QUAD_CHIP_LAYOUT = {
    "0": [0, 0],
    "1": [1, 0],
    "3": [0, 1],
    "2": [1, 1],
}


# Double module:
#
# 0 1

DOUBLE_CHIP_LAYOUT = {
    "0": [0, 0],
    "1": [1, 0],
}
