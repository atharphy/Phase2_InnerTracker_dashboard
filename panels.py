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
            "x": 0,
            "y": y,
            "w": 24,
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