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

from panels import make_dashboard


def main() -> None:

    (
        barrel_geometry,
        forward_geometry,
        endcap_geometry,
    ) = load_all_geometry()

    for register in REGISTERS:

        dashboard = make_dashboard(
            register,
            barrel_geometry,
            forward_geometry,
            endcap_geometry,
        )

        output = (
            f"cmsit_{register.lower()}_dashboard.json"
        )

        Path(output).write_text(
            json.dumps(
                dashboard,
                indent=2,
            ),
            encoding="utf-8",
        )

        print(f"Wrote {output}")

    print(
        "Loaded geometry files:\n"
        f"  {BARREL_GEOMETRY_FILE}\n"
        f"  {FORWARD_GEOMETRY_FILE}\n"
        f"  {ENDCAP_GEOMETRY_FILE}"
    )


if __name__ == "__main__":
    main()