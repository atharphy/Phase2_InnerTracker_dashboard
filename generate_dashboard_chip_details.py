#!/usr/bin/env python3

import json
import urllib.parse
import urllib.request
from pathlib import Path

from register_limits import REGISTER_LIMITS


PROMETHEUS_URL = "http://localhost:9090"

OUTPUT = "cmsit_chip_details_dashboard.json"
DASHBOARD_TITLE = "CMSIT Chip Details"
DASHBOARD_UID = "cmsit-chip-details"

GRAFANA_VERSION = "13.1.0"
PROMETHEUS_DATASOURCE_UID = "prometheus"

FRESHNESS_SECONDS = 120


def prom_query(query):
    url = (
        f"{PROMETHEUS_URL}/api/v1/query?"
        + urllib.parse.urlencode({"query": query})
    )

    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.load(response)
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"Could not connect to Prometheus at {PROMETHEUS_URL}: {exc}"
        ) from exc

    if data.get("status") != "success":
        raise RuntimeError(f"Prometheus query failed: {data}")

    return data["data"]["result"]


def get_register_units():
    result = prom_query("cmsit_monitor_value")
    register_units = {}

    for item in result:
        metric = item.get("metric", {})

        register = metric.get("register")
        unit = metric.get("unit", "")

        if register and register not in register_units:
            register_units[register] = unit

    return dict(sorted(register_units.items()))


def query_variable(name, label, query):
    return {
        "name": name,
        "type": "query",
        "label": label,
        "hide": 0,
        "datasource": {
            "type": "prometheus",
            "uid": PROMETHEUS_DATASOURCE_UID,
        },
        "query": {
            "query": query,
            "refId": f"StandardVariableQuery-{name}",
        },
        "definition": query,
        "refresh": 1,
        "sort": 1,
        "multi": True,
        "includeAll": True,
        "allValue": ".*",
        "current": {
            "selected": True,
            "text": "All",
            "value": "$__all",
        },
        "options": [],
        "skipUrlSync": False,
    }


def board_variable():
    query = "label_values(cmsit_monitor_value, board)"

    return query_variable(
        name="board",
        label="Board",
        query=query,
    )


def optical_group_variable():
    query = (
        "label_values("
        'cmsit_monitor_value{board=~"${board:regex}"}, '
        "optical_group"
        ")"
    )

    return query_variable(
        name="optical_group",
        label="Optical Group",
        query=query,
    )


def hybrid_variable():
    query = (
        "label_values("
        "cmsit_monitor_value{"
        'board=~"${board:regex}",'
        'optical_group=~"${optical_group:regex}"'
        "}, "
        "hybrid"
        ")"
    )

    return query_variable(
        name="hybrid",
        label="Hybrid",
        query=query,
    )


def chip_variable():
    query = (
        "label_values("
        "cmsit_monitor_value{"
        'board=~"${board:regex}",'
        'optical_group=~"${optical_group:regex}",'
        'hybrid=~"${hybrid:regex}"'
        "}, "
        "chip"
        ")"
    )

    return query_variable(
        name="chip",
        label="Chip",
        query=query,
    )


def return_url_variable():
    return {
        "name": "return_url",
        "type": "textbox",
        "label": "Return URL",
        "hide": 2,
        "query": "/",
        "current": {
            "selected": True,
            "text": "/",
            "value": "/",
        },
        "options": [],
        "skipUrlSync": False,
    }


def make_back_panel():
    return {
        "id": 1,
        "type": "text",
        "title": "",
        "pluginVersion": GRAFANA_VERSION,
        "gridPos": {
            "x": 0,
            "y": 0,
            "w": 24,
            "h": 2,
        },
        "options": {
            "mode": "markdown",
            "content": "[← Back to detector map](${return_url:raw})",
        },
        "transparent": True,
    }


def fresh_expr(register):
    value_selector = (
        "cmsit_monitor_value{"
        f'register="{register}",'
        'board=~"${board:regex}",'
        'optical_group=~"${optical_group:regex}",'
        'hybrid=~"${hybrid:regex}",'
        'chip=~"${chip:regex}"'
        "}"
    )

    update_selector = (
        "cmsit_monitor_last_update_seconds{"
        f'register="{register}",'
        'board=~"${board:regex}",'
        'optical_group=~"${optical_group:regex}",'
        'hybrid=~"${hybrid:regex}",'
        'chip=~"${chip:regex}"'
        "}"
    )

    return (
        f"{value_selector} "
        "and on(board,optical_group,hybrid,chip,register,unit) "
        f"(time() - {update_selector} < {FRESHNESS_SECONDS})"
    )


def thresholds_for(register):
    info = REGISTER_LIMITS.get(register)

    if not info:
        return {
            "mode": "absolute",
            "steps": [
                {
                    "color": "green",
                    "value": None,
                }
            ],
        }

    return {
        "mode": "absolute",
        "steps": [
            {
                "color": "red",
                "value": None,
            },
            {
                "color": "green",
                "value": info["min"],
            },
            {
                "color": "red",
                "value": info["max"],
            },
        ],
    }


def y_axis_label(register, unit):
    if unit:
        return f"{register} [{unit}]"

    return register


def make_panel(register, unit, panel_id, x, y, w=12, h=8):
    ylabel = y_axis_label(register, unit)

    return {
        "id": panel_id,
        "type": "timeseries",
        "title": register,
        "pluginVersion": GRAFANA_VERSION,
        "datasource": {
            "type": "prometheus",
            "uid": PROMETHEUS_DATASOURCE_UID,
        },
        "gridPos": {
            "x": x,
            "y": y,
            "w": w,
            "h": h,
        },
        "targets": [
            {
                "refId": "A",
                "datasource": {
                    "type": "prometheus",
                    "uid": PROMETHEUS_DATASOURCE_UID,
                },
                "editorMode": "code",
                "expr": fresh_expr(register),
                "legendFormat": (
                    "B{{board}}/"
                    "OG{{optical_group}}/"
                    "H{{hybrid}}/"
                    "Chip {{chip}}"
                ),
                "range": True,
            }
        ],
        "fieldConfig": {
            "defaults": {
                "thresholds": thresholds_for(register),
                "custom": {
                    "axisLabel": ylabel,
                    "axisCenteredZero": False,
                    "axisColorMode": "text",
                    "axisPlacement": "auto",
                    "drawStyle": "line",
                    "lineInterpolation": "linear",
                    "lineWidth": 2,
                    "fillOpacity": 0,
                    "gradientMode": "none",
                    "showPoints": "auto",
                    "pointSize": 4,
                    "spanNulls": FRESHNESS_SECONDS * 1000,
                },
            },
            "overrides": [],
        },
        "options": {
            "legend": {
                "displayMode": "list",
                "placement": "bottom",
                "showLegend": True,
            },
            "tooltip": {
                "mode": "multi",
                "sort": "none",
            },
        },
    }


def make_dashboard():
    register_units = get_register_units()

    if not register_units:
        raise RuntimeError(
            "No registers were found in cmsit_monitor_value. "
            "Make sure Prometheus is receiving CMSIT monitoring metrics."
        )

    panels = [make_back_panel()]

    for index, (register, unit) in enumerate(register_units.items()):
        x = 0 if index % 2 == 0 else 12
        y = 2 + (index // 2) * 8

        panels.append(
            make_panel(
                register=register,
                unit=unit,
                panel_id=index + 2,
                x=x,
                y=y,
            )
        )

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
            "monitoring",
            "details",
        ],
        "timezone": "browser",
        "schemaVersion": 41,
        "version": 1,
        "refresh": "5s",
        "time": {
            "from": "now-15m",
            "to": "now",
        },
        "templating": {
            "list": [
                board_variable(),
                optical_group_variable(),
                hybrid_variable(),
                chip_variable(),
                return_url_variable(),
            ]
        },
        "panels": panels,
    }


def main():
    dashboard = make_dashboard()

    output_directory = Path("json_files")
    output_directory.mkdir(parents=True, exist_ok=True)
    output_path = output_directory / OUTPUT
    output_path.write_text(
        json.dumps(dashboard, indent=2),
        encoding="utf-8",
    )

    print(f"Wrote {output_path.resolve()}")
    print(f"Discovered {len(dashboard['panels'])} registers.")
    print(
        "Board, optical group, hybrid and chip variables "
        "will be queried dynamically by Grafana."
    )


if __name__ == "__main__":
    main()
