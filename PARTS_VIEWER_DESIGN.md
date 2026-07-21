# Detector Parts Viewer Design

## Purpose

The Parts dashboard is a comparison workspace for selected CMS Phase-2 Inner
Tracker regions. One Grafana Business Charts panel owns the selection controls
and all detector cards, allowing each card to retain a different geometry
selection.

## State

The ECharts chart instance and browser local storage keep:

- the current subdetector, layer/disk, and part selection;
- the selector that is currently open;
- the independently added detector cards;
- a stable identifier for each card.

Grafana data refreshes reuse this state. The storage key includes the dashboard
path and register, so navigation, browser reloads, and reopening the dashboard
restore the same cards. Delete updates the saved workspace immediately.

## Geometry choices

- TBPX exposes Layers 1--4 and four signed-ladder/Z quadrants.
- TEPX exposes Disks 1--4, left/right halves, and both detector sides.
- TFPX exposes Disks 1--8, left/right halves, and both detector sides.

Left and Right are separated by the vertical Y axis. The renderer applies the
same disk rotation, module gap factor, Inner Disk colors, Outer Disk colors,
module outlines, chip divisions, and monitoring colors as the interactive
detector viewer.

The established YAML hardware mappings and detector layout constants remain
the geometry source. Barrel cards render signed-ladder and Z-module axes. Ring
cards use the established ring radii, module counts, module types, and half-disk
orientation.

## Monitoring actions

Chip interiors link to the shared chip-detail dashboard with one chip selected.
The stronger module perimeter links to the same dashboard with `chip=All`.
Both links include the hardware board, optical group, hybrid, time range, and
originating detector-dashboard URL.

## Layout

Cards use two columns on wide displays and one column on narrower displays.
The Grafana panel is intentionally tall so multiple detector parts can remain
readable. Add and Delete actions update only ECharts graphics and do not modify
Grafana's outer dashboard grid.
