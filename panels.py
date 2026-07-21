#!/usr/bin/env python3

from register_limits import REGISTER_LIMITS

from config import (
    ECHARTS_PANEL_TYPE,
    GRAFANA_VERSION,
    BUSINESS_CHARTS_VERSION,
    FORWARD_LAYOUT,
    ENDCAP_LAYOUT,
    FRESHNESS_SECONDS,
)

from templates import (
    barrel_echarts_code,
    ring_echarts_code,
    parts_echarts_code,
)


# Prometheus query

def fresh_expr(register: str) -> str:
    return (
        f'label_join('
        f'cmsit_monitor_value{{register="{register}"}} '
        f'and on(board,optical_group,hybrid,chip,register,unit) '
        f'(time() - '
        f'cmsit_monitor_last_update_seconds'
        f'{{register="{register}"}} '
        f'< {FRESHNESS_SECONDS}), '
        f'"module", "/OG", '
        f'"board", "optical_group", "hybrid"'
        f')'
    )



def make_limits_table(
    register: str,
    panel_id: int,
    y: int,
):
    info = REGISTER_LIMITS.get(register, {})

    text = "| Register | Nominal | Min | Max | Unit |\n"
    text += "|---|---:|---:|---:|---|\n"

    text += (
        f"| {register} | "
        f"{info.get('nominal', '')} | "
        f"{info.get('min', '')} | "
        f"{info.get('max', '')} | "
        f"{info.get('unit', '')} |\n"
    )

    return {
        "id": panel_id,
        "type": "text",
        "title": f"{register} Limits",
        "pluginVersion": GRAFANA_VERSION,
        "gridPos": {
            "x": 0,
            "y": y,
            "w": 24,
            "h": 4,
        },
        "options": {
            "mode": "markdown",
            "content": text,
        },
    }

# Prometheus panel target

def panel_target(register: str):
    return {
        "refId": "A",
        "datasource": {
            "type": "prometheus",
            "uid": "prometheus",
        },
        "editorMode": "code",
        "expr": fresh_expr(register),
        "instant": True,
        "range": False,
        "format": "time_series",
    }


def make_echarts_panel(
    *,
    panel_id: int,
    y: int,
    height: int,
    x: int = 0,
    width: int = 24,
    title: str,
    code: str,
    register: str,
    description: str,
):
    return {
        "id": panel_id,
        "type": ECHARTS_PANEL_TYPE,
        "title": title,
        "pluginVersion": BUSINESS_CHARTS_VERSION,
        "datasource": {
            "type": "prometheus",
            "uid": "prometheus",
        },
        "gridPos": {
            "x": x,
            "y": y,
            "w": width,
            "h": height,
        },
        "targets": [
            panel_target(register),
        ],
        "options": {
            "renderer": "canvas",
            "editorMode": "code",
            "getOption": code,
        },
        "description": description,
    }


def make_dashboard(
    register: str,
    barrel_geometry,
    forward_geometry,
    endcap_geometry,
):
    panels = []

    panel_id = 1
    y = 0

    unit = REGISTER_LIMITS.get(
        register,
        {},
    ).get("unit", "")

    # Limits table

    panels.append(
        make_limits_table(
            register,
            panel_id,
            y,
        )
    )

    panel_id += 1
    y += 4

    # Barrel

    panels.append(
        make_echarts_panel(
            panel_id=panel_id,
            y=y,
            height=60,
            title=(
                f"{register} Barrel detector map "
                f"[{unit}]"
            ),
            code=barrel_echarts_code(
                register,
                barrel_geometry,
            ),
            register=register,
            description=(
                "Four Barrel layer plots. "
                "Layers 1 and 2 use double modules; "
                "Layers 3 and 4 use quad modules."
            ),
        )
    )

    panel_id += 1
    y += 60

    # Forward +z and -z

    for side in ("+z", "-z"):
        panels.append(
            make_echarts_panel(
                panel_id=panel_id,
                y=y,
                height=32,
                title=(
                    f"{register} Forward {side} "
                    f"detector map [{unit}]"
                ),
                code=ring_echarts_code(
                    register,
                    forward_geometry,
                    FORWARD_LAYOUT,
                    "Forward",
                    side,
                ),
                register=register,
                description=(
                    f"Eight Forward disks on the {side} "
                    "side of the interaction point."
                ),
            )
        )

        panel_id += 1
        y += 32

    # Endcap +z and -z

    for side in ("+z", "-z"):
        panels.append(
            make_echarts_panel(
                panel_id=panel_id,
                y=y,
                height=34,
                title=(
                    f"{register} Endcap {side} "
                    f"detector map [{unit}]"
                ),
                code=ring_echarts_code(
                    register,
                    endcap_geometry,
                    ENDCAP_LAYOUT,
                    "Endcap",
                    side,
                ),
                register=register,
                description=(
                    f"Four Endcap disks on the {side} "
                    "side of the interaction point."
                ),
            )
        )

        panel_id += 1
        y += 34

    dashboard_slug = (
        register
        .lower()
        .replace("_", "-")
    )

    return {
        "annotations": {
            "list": [],
        },
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 0,
        "id": None,
        "uid": f"cmsit-{dashboard_slug}-geometry",
        "title": f"CMSIT {register} Full Pixel Geometry",
        "tags": [
            "cmsit",
            "rd53",
            register.lower(),
            "barrel",
            "forward",
            "endcap",
            "geometry",
            "echarts",
        ],
        "timezone": "browser",
        "schemaVersion": 41,
        "version": 1,
        "refresh": "5s",
        "time": {
            "from": "now-15m",
            "to": "now",
        },
        "panels": panels,
    }


def make_detector_dashboard_document(
    register: str,
    detector_name: str,
    panels: list,
):
    dashboard_slug = register.lower().replace("_", "-")
    detector_slug = detector_name.lower()
    return {
        "annotations": {"list": []},
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 0,
        "id": None,
        "uid": f"cmsit-{dashboard_slug}-{detector_slug}",
        "title": f"CMSIT {register} InnerTracker {detector_name}",
        "tags": [
            "cmsit",
            "rd53",
            register.lower(),
            detector_slug,
            "geometry",
            "echarts",
        ],
        "timezone": "browser",
        "schemaVersion": 41,
        "version": 1,
        "refresh": "5s",
        "time": {
            "from": "now-15m",
            "to": "now",
        },
        "panels": panels,
    }


def make_barrel_dashboard(register: str, geometry):
    unit = REGISTER_LIMITS.get(register, {}).get("unit", "")
    panels = [make_limits_table(register, 1, 0)]
    y = 4
    for layer in range(1, 5):
        panels.append(
            make_echarts_panel(
                panel_id=layer + 1,
                y=y,
                height=24,
                title=f"{register} Barrel Layer {layer} [{unit}]",
                code=barrel_echarts_code(
                    register,
                    geometry,
                    initial_layer=layer,
                    isolated_geometry=True,
                ),
                register=register,
                description=f"InnerTracker Barrel Layer {layer}.",
            )
        )
        y += 24
    return make_detector_dashboard_document(
        register,
        "Barrel",
        panels,
    )


def make_ring_dashboard(
    register: str,
    geometry,
    layout: dict,
    region_name: str,
):
    unit = REGISTER_LIMITS.get(register, {}).get("unit", "")
    panels = [make_limits_table(register, 1, 0)]
    panel_id = 2
    disk_index = 0
    columns = 3 if region_name == "Forward" else 2
    panel_height = 14 if region_name == "Forward" else 16
    panel_width = 24 // columns
    for side in ("+z", "-z"):
        for disk in range(1, layout["n_disks"] + 1):
            column = disk_index % columns
            row = disk_index // columns
            panels.append(
                make_echarts_panel(
                    panel_id=panel_id,
                    x=column * panel_width,
                    y=4 + row * panel_height,
                    width=panel_width,
                    height=panel_height,
                    title=(
                        f"{register} {region_name} {side} "
                        f"Disk {disk} [{unit}]"
                    ),
                    code=ring_echarts_code(
                        register,
                        geometry,
                        layout,
                        region_name,
                        side,
                        initial_disk=disk,
                        isolated_geometry=True,
                    ),
                    register=register,
                    description=(
                        f"InnerTracker {region_name} {side} Disk {disk}."
                    ),
                )
            )
            panel_id += 1
            disk_index += 1
    return make_detector_dashboard_document(
        register,
        region_name,
        panels,
    )


def make_forward_dashboard(register: str, geometry):
    return make_ring_dashboard(
        register,
        geometry,
        FORWARD_LAYOUT,
        "Forward",
    )


def make_endcap_dashboard(register: str, geometry):
    return make_ring_dashboard(
        register,
        geometry,
        ENDCAP_LAYOUT,
        "Endcap",
    )


def make_parts_dashboard(
    register: str,
    barrel_geometry,
    forward_geometry,
    endcap_geometry,
):
    unit = REGISTER_LIMITS.get(register, {}).get("unit", "")
    panels = [
        make_limits_table(register, 1, 0),
        make_echarts_panel(
            panel_id=2,
            y=4,
            height=120,
            title=f"{register} Detector Parts [{unit}]",
            code=parts_echarts_code(
                register,
                barrel_geometry,
                forward_geometry,
                endcap_geometry,
            ),
            register=register,
            description=(
                "Add and remove independently selected TBPX quadrants, "
                "TEPX half-disks, and TFPX half-disks."
            ),
        ),
    ]
    return make_detector_dashboard_document(
        register,
        "Parts",
        panels,
    )
