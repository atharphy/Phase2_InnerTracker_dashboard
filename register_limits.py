#!/usr/bin/env python3

import json
import urllib.parse
import urllib.request
from pathlib import Path
from statistics import mean

PROMETHEUS_URL = "http://localhost:9090"
OUTPUT = "register_limits.py"
MARGIN = 0.20


def prom_query(query):
    params = urllib.parse.urlencode({"query": query})
    url = f"{PROMETHEUS_URL}/api/v1/query?{params}"

    with urllib.request.urlopen(url) as response:
        data = json.load(response)

    if data.get("status") != "success":
        raise RuntimeError(data)

    return data["data"]["result"]


def main():
    result = prom_query("cmsit_monitor_value")

    values = {}

    for item in result:
        metric = item["metric"]
        register = metric.get("register")
        unit = metric.get("unit", "")
        value = float(item["value"][1])

        if not register:
            continue

        values.setdefault(register, {"unit": unit, "values": []})
        values[register]["values"].append(value)

    lines = []
    lines.append("# Auto-generated from current Prometheus values")
    lines.append("# Nominal value = average across currently visible chips")
    lines.append("# Limits = nominal +/- 20%")
    lines.append("")
    lines.append("REGISTER_LIMITS = {")

    for register in sorted(values):
        vals = values[register]["values"]
        unit = values[register]["unit"]
        nominal = mean(vals)
        low = nominal * (1.0 - MARGIN)
        high = nominal * (1.0 + MARGIN)

        lines.append(f'    "{register}": {{')
        lines.append(f'        "unit": "{unit}",')
        lines.append(f'        "nominal": {nominal:.6g},')
        lines.append(f'        "min": {low:.6g},')
        lines.append(f'        "max": {high:.6g},')
        lines.append(f'        "margin": {MARGIN},')
        lines.append("    },")
        lines.append("")

    lines.append("}")

    Path(OUTPUT).write_text("\n".join(lines))
    print(f"Wrote {OUTPUT}")

    for register in sorted(values):
        info = values[register]
        nominal = mean(info["values"])
        print(f"{register:25s} nominal={nominal:.6g} {info['unit']}")


if __name__ == "__main__":
    main()