#!/usr/bin/env python3

import json
from pathlib import Path

from config import (
    REGISTERS,
    BARREL_GEOMETRY_FILE,
    FORWARD_GEOMETRY_FILE,
    ENDCAP_GEOMETRY_FILE,
)

from geometry import load_all_geometry

from panels import (
    make_dashboard,
    make_barrel_dashboard,
    make_forward_dashboard,
    make_endcap_dashboard,
)


def main() -> None:

    output_directory = Path("json_files")
    output_directory.mkdir(parents=True, exist_ok=True)

    (
        barrel_geometry,
        forward_geometry,
        endcap_geometry,
    ) = load_all_geometry()

    for register in REGISTERS:

        dashboards = {
            f"cmsit_{register.lower()}_dashboard.json": make_dashboard(
                register,
                barrel_geometry,
                forward_geometry,
                endcap_geometry,
            ),
            f"cmsit_{register.lower()}_barrel_dashboard.json": (
                make_barrel_dashboard(register, barrel_geometry)
            ),
            f"cmsit_{register.lower()}_forward_dashboard.json": (
                make_forward_dashboard(register, forward_geometry)
            ),
            f"cmsit_{register.lower()}_endcap_dashboard.json": (
                make_endcap_dashboard(register, endcap_geometry)
            ),
        }

        for output, dashboard in dashboards.items():
            output_path = output_directory / output
            output_path.write_text(
                json.dumps(dashboard, indent=2),
                encoding="utf-8",
            )
            print(f"Wrote {output_path}")

    print(
        "Loaded geometry files:\n"
        f"  {BARREL_GEOMETRY_FILE}\n"
        f"  {FORWARD_GEOMETRY_FILE}\n"
        f"  {ENDCAP_GEOMETRY_FILE}"
    )


if __name__ == "__main__":
    main()
