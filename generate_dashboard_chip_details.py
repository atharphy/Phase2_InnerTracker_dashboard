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
FRESHNESS_SECONDS = 120


def prom_query(query):
    url = f"{PROMETHEUS_URL}/api/v1/query?" + urllib.parse.urlencode({"query": query})
    with urllib.request.urlopen(url) as response:
        data = json.load(response)
    if data.get("status") != "success":
        raise RuntimeError(data)
    return data["data"]["result"]


def get_label_values(label):
    result = prom_query("cmsit_monitor_value")
    vals = sorted({item["metric"].get(label, "") for item in result if item["metric"].get(label, "")})
    return vals


def get_register_units():
    result = prom_query("cmsit_monitor_value")
    out = {}

    for item in result:
        m = item["metric"]
        reg = m.get("register")
        unit = m.get("unit", "")
        if reg and reg not in out:
            out[reg] = unit

    return dict(sorted(out.items()))


def custom_var(name, values, default=".*"):
    opts = [{"text": "All", "value": ".*", "selected": default == ".*"}]
    for v in values:
        opts.append({"text": v, "value": v, "selected": v == default})

    return {
        "name": name,
        "type": "custom",
        "label": name,
        "query": ",".join([".*"] + values),
        "current": {"text": "All" if default == ".*" else default, "value": default},
        "options": opts,
        "hide": 0,
    }


def fresh_expr(register):
    return (
        f'cmsit_monitor_value{{register="{register}",'
        f'board=~"$board",optical_group=~"$optical_group",hybrid=~"$hybrid",chip=~"$chip"}} '
        f'and on(board,optical_group,hybrid,chip,register,unit) '
        f'(time() - cmsit_monitor_last_update_seconds{{register="{register}",'
        f'board=~"$board",optical_group=~"$optical_group",hybrid=~"$hybrid",chip=~"$chip"}} < {FRESHNESS_SECONDS})'
    )


def thresholds_for(register):
    info = REGISTER_LIMITS.get(register)
    if not info:
        return {"mode": "absolute", "steps": [{"color": "green", "value": None}]}

    return {
        "mode": "absolute",
        "steps": [
            {"color": "red", "value": None},
            {"color": "green", "value": info["min"]},
            {"color": "red", "value": info["max"]},
        ],
    }


def y_axis_label(register, unit):
    return f"{register} [{unit}]" if unit else register


def make_panel(register, unit, panel_id, x, y, w=12, h=8):
    ylabel = y_axis_label(register, unit)

    return {
        "id": panel_id,
        "type": "timeseries",
        "title": register,
        "pluginVersion": GRAFANA_VERSION,
        "datasource": {"type": "prometheus", "uid": "prometheus"},
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "targets": [
            {
                "refId": "A",
                "datasource": {"type": "prometheus", "uid": "prometheus"},
                "editorMode": "code",
                "expr": fresh_expr(register),
                "legendFormat": "B{{board}}/OG{{optical_group}}/H{{hybrid}}/Chip {{chip}}",
                "range": True,
            }
        ],
        "fieldConfig": {
            "defaults": {
                "thresholds": thresholds_for(register),
                "custom": {
                    "axisLabel": ylabel,
                    "drawStyle": "line",
                    "lineInterpolation": "linear",
                    "lineWidth": 2,
                    "fillOpacity": 0,
                    "showPoints": "auto",
                    "pointSize": 4,
                    "spanNulls": FRESHNESS_SECONDS * 1000,
                },
            },
            "overrides": [],
        },
        "options": {
            "legend": {"displayMode": "list", "placement": "bottom", "showLegend": True},
            "tooltip": {"mode": "multi", "sort": "none"},
        },
    }


def make_dashboard():
    reg_units = get_register_units()

    boards = get_label_values("board")
    optical_groups = get_label_values("optical_group")
    hybrids = get_label_values("hybrid")
    chips = get_label_values("chip")

    panels = []
    for i, (reg, unit) in enumerate(reg_units.items()):
        x = 0 if i % 2 == 0 else 12
        y = (i // 2) * 8
        panels.append(make_panel(reg, unit, i + 1, x, y))

    return {
        "annotations": {"list": []},
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 0,
        "id": None,
        "uid": DASHBOARD_UID,
        "title": DASHBOARD_TITLE,
        "tags": ["cmsit", "rd53", "monitoring", "details"],
        "timezone": "browser",
        "schemaVersion": 41,
        "version": 1,
        "refresh": "5s",
        "time": {"from": "now-15m", "to": "now"},
        "templating": {
            "list": [
                custom_var("board", boards),
                custom_var("optical_group", optical_groups),
                custom_var("hybrid", hybrids),
                custom_var("chip", chips),
            ]
        },
        "panels": panels,
    }


def main():
    dashboard = make_dashboard()
    Path(OUTPUT).write_text(json.dumps(dashboard, indent=2))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()