#!/usr/bin/env python3

import json
from pathlib import Path

from config import (
    OUTPUT,
    BARREL_GEOMETRY_FILE,
    FORWARD_GEOMETRY_FILE,
    ENDCAP_GEOMETRY_FILE,
)

from geometry import (
    load_all_geometry,
)

from panels import (
    make_dashboard,
)


def main() -> None:

    (
        barrel_geometry,
        forward_geometry,
        endcap_geometry,
    ) = load_all_geometry()

    dashboard = make_dashboard(
        barrel_geometry,
        forward_geometry,
        endcap_geometry,
    )

    Path(OUTPUT).write_text(
        json.dumps(
            dashboard,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"Wrote {OUTPUT}")

    print(
        "Loaded geometry files:\n"
        f"  {BARREL_GEOMETRY_FILE}\n"
        f"  {FORWARD_GEOMETRY_FILE}\n"
        f"  {ENDCAP_GEOMETRY_FILE}"
    )


if __name__ == "__main__":
    main()