#!/usr/bin/env python3

from register_limits import REGISTER_LIMITS

from config import (
    ECHARTS_PANEL_TYPE,
    GRAFANA_VERSION,
    BUSINESS_CHARTS_VERSION,
    REGISTERS,
    FORWARD_LAYOUT,
    ENDCAP_LAYOUT,
    FRESHNESS_SECONDS,
    DASHBOARD_UID,
    DASHBOARD_TITLE,
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


# Limits table

def make_limits_table(panel_id: int, y: int):

    text = "| Register | Nominal | Min | Max | Unit |\n"
    text += "|---|---:|---:|---:|---|\n"

    for register in REGISTERS:
        info = REGISTER_LIMITS.get(register, {})

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
        "title": "Register Limits",
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

def panel_target(register):

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
    panel_id,
    y,
    height,
    title,
    code,
    register,
    description,
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
    barrel_geometry,
    forward_geometry,
    endcap_geometry,
):

    panels = []

    panel_id = 1
    y = 0

    panels.append(make_limits_table(panel_id, y))

    panel_id += 1
    y += 4

    for register in REGISTERS:

        unit = REGISTER_LIMITS.get(
            register,
            {},
        ).get("unit", "")

        # Barrel

        panels.append(
            make_echarts_panel(
                panel_id=panel_id,
                y=y,
                height=60,
                title=f"{register} Barrel detector map [{unit}]",
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

        # Forward

        for side in ("+z", "-z"):

            panels.append(
                make_echarts_panel(
                    panel_id=panel_id,
                    y=y,
                    height=32,
                    title=f"{register} Forward {side} detector map [{unit}]",
                    code=ring_echarts_code(
                        register,
                        forward_geometry,
                        FORWARD_LAYOUT,
                        "Forward",
                        side,
                    ),
                    register=register,
                    description=(
                        "Eight Forward disks."
                    ),
                )
            )

            panel_id += 1
            y += 32

        # Endcap

        for side in ("+z", "-z"):

            panels.append(
                make_echarts_panel(
                    panel_id=panel_id,
                    y=y,
                    height=34,
                    title=f"{register} Endcap {side} detector map [{unit}]",
                    code=ring_echarts_code(
                        register,
                        endcap_geometry,
                        ENDCAP_LAYOUT,
                        "Endcap",
                        side,
                    ),
                    register=register,
                    description=(
                        "Four Endcap disks."
                    ),
                )
            )

            panel_id += 1
            y += 34

    return {
        "annotations": {
            "list": [],
        },
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 0,
        "id": None,
        "uid": DASHBOARD_UID,
        "title": DASHBOARD_TITLE,
        "tags": [
            "cmsit",
            "rd53",
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