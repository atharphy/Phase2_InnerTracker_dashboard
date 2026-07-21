#!/usr/bin/env python3

import json
from typing import Optional

from config import (
    BARREL_LAYOUT,
    BARREL_TEMPLATE,
    RING_TEMPLATE,
    INTERACTION_TEMPLATE,
    NAVIGATION_TEMPLATE,
    HOVER_TEMPLATE,
    DETAILS_DASHBOARD_UID,
    DETAILS_DASHBOARD_SLUG,
    QUAD_CHIP_LAYOUT,
    DOUBLE_CHIP_LAYOUT,
)

from register_limits import REGISTER_LIMITS


def detector_template(template: str) -> str:
    return "\n\n".join((
        INTERACTION_TEMPLATE,
        NAVIGATION_TEMPLATE,
        HOVER_TEMPLATE,
        template,
    ))


def common_config(
    register: str,
    geometry: dict,
) -> dict:
    info = REGISTER_LIMITS.get(register, {})

    return {
        "min": info.get("min"),
        "max": info.get("max"),
        "unit": info.get("unit", ""),
        "register": register,
        "geometry": geometry,
        "quadChipLayout": QUAD_CHIP_LAYOUT,
        "doubleChipLayout": DOUBLE_CHIP_LAYOUT,
        "detailsUid": DETAILS_DASHBOARD_UID,
        "detailsSlug": DETAILS_DASHBOARD_SLUG,
    }


# Barrel ECharts

def barrel_echarts_code(
    register: str,
    geometry: dict,
    initial_layer: Optional[int] = None,
    isolated_geometry: bool = False,
) -> str:
    config = common_config(register, geometry)
    config["barrelLayout"] = BARREL_LAYOUT
    config["initialLayer"] = initial_layer
    config["isolatedGeometry"] = isolated_geometry

    return detector_template(BARREL_TEMPLATE).replace(
        "__CONFIG__",
        json.dumps(config),
    )


# Ring-region ECharts ( common for both TEPX and TFPX)

def ring_echarts_code(
    register: str,
    geometry: dict,
    layout: dict,
    region_name: str,
    detector_side: str,
    initial_disk: Optional[int] = None,
    isolated_geometry: bool = False,
) -> str:
    config = common_config(register, geometry)

    config["ringLayout"] = layout
    config["regionName"] = region_name
    config["detectorSide"] = detector_side
    config["initialDisk"] = initial_disk
    config["isolatedGeometry"] = isolated_geometry

    if region_name == "Forward":
        config["columns"] = 4
        config["rows"] = 2
        config["yMax"] = 5.4
        config["outerRadius"] = 1.98
    else:
        config["columns"] = 2
        config["rows"] = 2
        config["yMax"] = 6.4
        config["outerRadius"] = 2.65

    return detector_template(RING_TEMPLATE).replace(
        "__CONFIG__",
        json.dumps(config),
    )
