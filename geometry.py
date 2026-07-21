#!/usr/bin/env python3

from pathlib import Path
from typing import Any, Dict, Tuple

try:
    import yaml
except ImportError as exc:
    raise SystemExit(
        "PyYAML is required.\n"
        "Install it with:\n"
        "  python3 -m pip install --user pyyaml"
    ) from exc

from config import (
    BARREL_GEOMETRY_FILE,
    FORWARD_GEOMETRY_FILE,
    ENDCAP_GEOMETRY_FILE,
    BARREL_LAYOUT,
    FORWARD_LAYOUT,
    ENDCAP_LAYOUT,
)

def load_yaml_mapping(filename: str) -> Dict[str, Any]:
    path = Path(filename)

    if not path.exists():
        raise FileNotFoundError(
            f"Geometry file does not exist: {path.resolve()}"
        )

    with path.open("r", encoding="utf-8") as stream:
        data = yaml.safe_load(stream)

    if data is None:
        return {}

    if not isinstance(data, dict):
        raise ValueError(
            f"{filename} must contain a top-level YAML mapping."
        )

    return data

def validate_hardware_key(
    hardware_key: Any,
    filename: str,
) -> str:

    if not isinstance(hardware_key, str):
        raise ValueError(
            f"Every hardware key in {filename} must be a string."
        )

    parts = hardware_key.split("/")

    if len(parts) != 3:
        raise ValueError(
            f"Invalid hardware key '{hardware_key}' in {filename}. "
            "Expected board/optical_group/hybrid."
        )

    return hardware_key

def validate_barrel_geometry(
    geometry: Dict[str, Any],
) -> Dict[str, Any]:

    validated = {}

    for hardware_key, position in geometry.items():

        hardware_key = validate_hardware_key(
            hardware_key,
            BARREL_GEOMETRY_FILE,
        )

        if not isinstance(position, dict):
            raise ValueError(
                f"Barrel entry '{hardware_key}' must be a mapping."
            )

        required = {
            "layer",
            "signed_ladder",
            "z_side",
            "module_index",
        }

        missing = required - set(position)

        if missing:
            raise ValueError(
                f"Barrel entry '{hardware_key}' is missing: "
                f"{', '.join(sorted(missing))}"
            )

        layer = position["layer"]
        signed_ladder = position["signed_ladder"]
        z_side = position["z_side"]
        module_index = position["module_index"]

        if layer not in BARREL_LAYOUT:
            raise ValueError(
                f"Barrel entry '{hardware_key}' has invalid layer {layer}."
            )

        if not isinstance(signed_ladder, int):
            raise ValueError(
                f"Barrel entry '{hardware_key}' has a non-integer signed_ladder."
            )

        max_ladder = BARREL_LAYOUT[layer]["half_ladders"]

        if signed_ladder == 0 or abs(signed_ladder) > max_ladder:
            raise ValueError(
                f"Barrel entry '{hardware_key}' has signed_ladder "
                f"{signed_ladder}; Layer {layer} accepts "
                f"-{max_ladder} ... -1 and 1 ... {max_ladder}."
            )

        if z_side not in {"z+", "z-"}:
            raise ValueError(
                f"Barrel entry '{hardware_key}' has invalid z_side '{z_side}'."
            )

        if not isinstance(module_index, int):
            raise ValueError(
                f"Barrel entry '{hardware_key}' has non-integer module_index."
            )

        max_modules = (
            BARREL_LAYOUT[layer]["z_plus_modules"]
            if z_side == "z+"
            else BARREL_LAYOUT[layer]["z_minus_modules"]
        )

        if module_index < 1 or module_index > max_modules:
            raise ValueError(
                f"Barrel entry '{hardware_key}' has module_index "
                f"{module_index}; Layer {layer} {z_side} accepts "
                f"1 ... {max_modules}."
            )

        validated[hardware_key] = {
            "layer": layer,
            "signed_ladder": signed_ladder,
            "z_side": z_side,
            "module_index": module_index,
        }

    return validated

def validate_ring_geometry(
    geometry: Dict[str, Any],
    filename: str,
    layout: Dict[str, Any],
) -> Dict[str, Any]:

    validated = {}

    for hardware_key, position in geometry.items():

        hardware_key = validate_hardware_key(
            hardware_key,
            filename,
        )

        if not isinstance(position, dict):
            raise ValueError(
                f"Geometry entry '{hardware_key}' in {filename} must be a mapping."
            )

        required = {
            "detector_side",
            "disk",
            "ring",
            "half",
            "module_index",
        }

        missing = required - set(position)

        if missing:
            raise ValueError(
                f"Geometry entry '{hardware_key}' in {filename} "
                f"is missing: {', '.join(sorted(missing))}"
            )

        detector_side = position["detector_side"]
        disk = position["disk"]
        ring = position["ring"]
        half = position["half"]
        module_index = position["module_index"]

        if detector_side not in {"+z", "-z"}:
            raise ValueError(
                f"Geometry entry '{hardware_key}' has detector_side "
                f"'{detector_side}'."
            )

        if not isinstance(disk, int):
            raise ValueError(
                f"Geometry entry '{hardware_key}' has non-integer disk."
            )

        if disk < 1 or disk > layout["n_disks"]:
            raise ValueError(
                f"Geometry entry '{hardware_key}' uses disk {disk}; "
                f"valid range is 1-{layout['n_disks']}."
            )

        if ring not in layout["rings"]:
            raise ValueError(
                f"Geometry entry '{hardware_key}' uses invalid ring {ring}."
            )

        if half not in {"upper", "lower"}:
            raise ValueError(
                f"Geometry entry '{hardware_key}' has invalid half '{half}'."
            )

        if not isinstance(module_index, int):
            raise ValueError(
                f"Geometry entry '{hardware_key}' has non-integer module_index."
            )

        n_modules = layout["rings"][ring]["modules_per_half"]

        if module_index < 0 or module_index >= n_modules:
            raise ValueError(
                f"Geometry entry '{hardware_key}' has module_index "
                f"{module_index}; Ring {ring} accepts "
                f"0 ... {n_modules - 1}."
            )

        validated[hardware_key] = {
            "detector_side": detector_side,
            "disk": disk,
            "ring": ring,
            "half": half,
            "module_index": module_index,
        }

    return validated

def load_all_geometry() -> Tuple[
    Dict[str, Any],
    Dict[str, Any],
    Dict[str, Any],
]:

    barrel = validate_barrel_geometry(
        load_yaml_mapping(BARREL_GEOMETRY_FILE)
    )

    forward = validate_ring_geometry(
        load_yaml_mapping(FORWARD_GEOMETRY_FILE),
        FORWARD_GEOMETRY_FILE,
        FORWARD_LAYOUT,
    )

    endcap = validate_ring_geometry(
        load_yaml_mapping(ENDCAP_GEOMETRY_FILE),
        ENDCAP_GEOMETRY_FILE,
        ENDCAP_LAYOUT,
    )

    return barrel, forward, endcap
