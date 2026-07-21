const cfg = __CONFIG__;

const MODULE_GAP_FACTOR = 0.82;

const DISK_ROTATION = Math.PI / 2;

const DISK_SURFACE_COLORS = {
  inner: {
    fill: "rgba(63, 132, 214, 0.09)",
    line: "rgba(100, 170, 255, 0.58)"
  },
  outer: {
    fill: "rgba(224, 145, 63, 0.08)",
    line: "rgba(255, 180, 95, 0.55)"
  }
};

function statusColor(value) {
  if (
    cfg.min !== null &&
    cfg.min !== undefined &&
    value < cfg.min
  ) {
    return "#d93025";
  }

  if (
    cfg.max !== null &&
    cfg.max !== undefined &&
    value > cfg.max
  ) {
    return "#d93025";
  }

  return "#32a852";
}

function hardwareKey(labels) {
  return (
    String(labels.board ?? "") + "/" +
    String(labels.optical_group ?? "") + "/" +
    String(labels.hybrid ?? "")
  );
}

function fieldValue(field, index) {
  return Number(
    field.values.get
      ? field.values.get(index)
      : field.values[index]
  );
}

function chipLayout(moduleType) {
  if (moduleType === "double") {
    return cfg.doubleChipLayout;
  }

  return cfg.quadChipLayout;
}

function moduleAngleRange(
  ring,
  half,
  moduleIndex
) {
  const n = ring.modules_per_half;
  const halfStart = half === "upper" ? Math.PI : 0;

  const pitch = Math.PI / n;

  const centre =
    halfStart +
    (moduleIndex + 0.5) * pitch +
    DISK_ROTATION;

  const width = pitch * MODULE_GAP_FACTOR;

  return {
    start: centre - width / 2,
    end: centre + width / 2,
    centre: centre
  };
}

function chipSector(
  ring,
  half,
  moduleIndex,
  moduleType,
  chip
) {
  const moduleAngles = moduleAngleRange(
    ring,
    half,
    moduleIndex
  );

  const layout = chipLayout(moduleType);
  const xy = layout[String(chip)];

  if (!xy) {
    return null;
  }

  const angularColumns = 2;
  const radialRows =
    moduleType === "double" ? 1 : 2;

  const moduleAngleWidth =
    moduleAngles.end - moduleAngles.start;

  const chipAngleWidth =
    moduleAngleWidth / angularColumns;

  const chipRadialWidth =
    (
      ring.outer_radius -
      ring.inner_radius
    ) / radialRows;

  const startAngle =
    moduleAngles.start +
    xy[0] * chipAngleWidth;

  const endAngle =
    startAngle + chipAngleWidth;

  // Row 0 is placed toward the outside of the disk.
  const outerRadius =
    ring.outer_radius -
    xy[1] * chipRadialWidth;

  const innerRadius =
    outerRadius - chipRadialWidth;

  return {
    startAngle: startAngle,
    endAngle: endAngle,
    innerRadius: innerRadius,
    outerRadius: outerRadius
  };
}

const chartW = context.panel.chart.getWidth();
const chartH = context.panel.chart.getHeight();

const plotW = Math.max(1, chartW - 40);
const plotH = Math.max(1, chartH - 80);

const Y_MAX = cfg.yMax;
const X_MAX = Y_MAX * plotW / plotH;

function diskCentre(diskNumber) {
  const index = diskNumber - 1;

  const column = index % cfg.columns;
  const row = Math.floor(index / cfg.columns);

  const xStep = 2 * X_MAX / cfg.columns;
  const yStep = 2 * Y_MAX / cfg.rows;

  return {
    x:
      -X_MAX +
      (column + 0.5) * xStep,
    y:
      Y_MAX -
      (row + 0.5) * yStep
  };
}

const rows = [];

for (const frame of context.panel.data.series) {
  for (const field of frame.fields) {
    if (field.type !== "number") {
      continue;
    }

    const labels = field.labels || {};
    const key = hardwareKey(labels);

    for (let i = 0; i < field.values.length; i++) {
      const value = fieldValue(field, i);

      if (!Number.isFinite(value)) {
        continue;
      }

      rows.push({
        value: value,
        hardwareKey: key,
        chip: String(labels.chip ?? "0"),
        board: String(labels.board ?? ""),
        optical_group: String(
          labels.optical_group ?? ""
        ),
        hybrid: String(labels.hybrid ?? ""),
        module: String(labels.module ?? ""),
        register: String(
          labels.register ?? cfg.register
        ),
        unit: String(labels.unit ?? cfg.unit ?? "")
      });
    }
  }
}

const ringHardwareByModule = {};

for (const [key, geom] of Object.entries(cfg.geometry)) {
  const moduleKey = [
    geom.detector_side,
    geom.disk,
    geom.ring,
    geom.half,
    geom.module_index
  ].join(":");
  ringHardwareByModule[moduleKey] = key;
}

const ringBands = [];
const moduleSlots = [];
const liveChips = [];
const halfAxes = [];
const labels = [];
const diskTargets = [];
const halfTargets = [];

for (
  let diskNumber = 1;
  diskNumber <= cfg.ringLayout.n_disks;
  diskNumber++
) {
  const centre = diskCentre(diskNumber);

  diskTargets.push({
    id: "disk-target-" + diskNumber,
    value: [centre.x, centre.y, 0, cfg.outerRadius, 0, Math.PI * 2],
    objectType: "disk",
    disk: diskNumber,
    detectorSide: cfg.detectorSide
  });

  for (const half of ["upper", "lower"]) {
    halfTargets.push({
      id: "half-target-" + diskNumber + "-" + half,
      value: [
        centre.x,
        centre.y,
        0,
        cfg.outerRadius,
        half === "upper" ? -Math.PI / 2 : Math.PI / 2,
        half === "upper" ? Math.PI / 2 : Math.PI * 1.5
      ],
      objectType: "half",
      disk: diskNumber,
      half: half,
      detectorSide: cfg.detectorSide
    });
  }

  labels.push({
    id: "disk-label-" + diskNumber,
    disk: diskNumber,
    value: [
      centre.x,
      centre.y + cfg.outerRadius + 0.28
    ],
    text: "Disk " + diskNumber,
    font: "bold 13px sans-serif"
  });

  halfAxes.push({
    id: "half-axis-" + diskNumber,
    disk: diskNumber,
    value: [
      centre.x,
      centre.y - cfg.outerRadius - 0.08,
      centre.x,
      centre.y + cfg.outerRadius + 0.08
    ]
  });

  for (
    const [ringKey, ring]
    of Object.entries(cfg.ringLayout.rings)
  ) {
    const ringNumber = Number(ringKey);
    const surfaceColors =
    DISK_SURFACE_COLORS[ring.disk_surface];

    ringBands.push({
    id: "ring-band-" + diskNumber + "-" + ringNumber,
    value: [
        centre.x,
        centre.y,
        ring.inner_radius,
        ring.outer_radius
    ],
    objectType: "ring",
    disk: diskNumber,
    ring: ringNumber,
    diskSurface: ring.disk_surface,
    itemStyle: {
        color: surfaceColors.fill,
        borderColor: surfaceColors.line,
        borderWidth: 1
    }
    });

    for (const half of ["upper", "lower"]) {
      for (
        let moduleIndex = 0;
        moduleIndex < ring.modules_per_half;
        moduleIndex++
      ) {
        const angles = moduleAngleRange(
          ring,
          half,
          moduleIndex
        );
        const moduleHardwareKey = ringHardwareByModule[[
          cfg.detectorSide,
          diskNumber,
          ringNumber,
          half,
          moduleIndex
        ].join(":")];

        moduleSlots.push({
          id: ["module", diskNumber, ringNumber, half, moduleIndex].join("-"),
          value: [
            centre.x,
            centre.y,
            ring.inner_radius,
            ring.outer_radius,
            angles.start,
            angles.end
          ],
          objectType: "module",
          disk: diskNumber,
          ring: ringNumber,
          diskSurface: ring.disk_surface,
          detectorSide: cfg.detectorSide,
          half: half,
          moduleIndex: moduleIndex,
          moduleType: ring.module_type,
          ...hardwareMetadata(moduleHardwareKey)
        });
      }
    }
  }
}

for (const row of rows) {
  const geom = cfg.geometry[row.hardwareKey];

  if (!geom) {
    console.warn(
      "No " +
      cfg.regionName +
      " geometry for",
      row.hardwareKey
    );
    continue;
  }

  // Each panel displays only one side of the interaction point.
  if (String(geom.detector_side) !== cfg.detectorSide) {
    continue;
  }
  
  const diskNumber = Number(geom.disk);
  const ringNumber = Number(geom.ring);
  const half = String(geom.half);
  const moduleIndex = Number(geom.module_index);

  const ring =
    cfg.ringLayout.rings[String(ringNumber)]
    || cfg.ringLayout.rings[ringNumber];

  if (!ring) {
    continue;
  }

  const sector = chipSector(
    ring,
    half,
    moduleIndex,
    ring.module_type,
    row.chip
  );

  if (!sector) {
    console.warn(
      "Chip",
      row.chip,
      "does not fit",
      ring.module_type,
      "module",
      row.hardwareKey
    );
    continue;
  }

  const centre = diskCentre(diskNumber);

  liveChips.push({
    id: ["chip", diskNumber, row.hardwareKey, row.chip].join("-"),
    value: [
      centre.x,
      centre.y,
      sector.innerRadius,
      sector.outerRadius,
      sector.startAngle,
      sector.endAngle,
      row.value
    ],
    objectType: "chip",
    disk: diskNumber,
    ring: ringNumber,
    diskSurface: ring.disk_surface,
    detectorSide: cfg.detectorSide,
    half: half,
    moduleIndex: moduleIndex,
    moduleType: ring.module_type,
    hardwareKey: row.hardwareKey,
    chip: row.chip,
    board: row.board,
    optical_group: row.optical_group,
    hybrid: row.hybrid,
    module: row.module,
    register: row.register,
    unit: row.unit,
    itemStyle: {
      color: statusColor(row.value),
      borderColor: "#111111",
      borderWidth: 1
    }
  });
}

function sectorPixelShape(api) {
  const cx = api.value(0);
  const cy = api.value(1);

  const innerRadius = api.value(2);
  const outerRadius = api.value(3);

  const startAngle = api.value(4);
  const endAngle = api.value(5);

  const centre = api.coord([cx, cy]);

  const innerEdge = api.coord([
    cx + innerRadius,
    cy
  ]);

  const outerEdge = api.coord([
    cx + outerRadius,
    cy
  ]);

  return {
    cx: centre[0],
    cy: centre[1],
    r0: Math.abs(innerEdge[0] - centre[0]),
    r: Math.abs(outerEdge[0] - centre[0]),
    startAngle: startAngle,
    endAngle: endAngle,
    clockwise: true
  };
}

const ringRuntime = detectorViewerRuntime(context.panel.chart);

if (
  cfg.initialDisk &&
  ringRuntime.view.mode === DETECTOR_VIEW_MODES.OVERVIEW
) {
  ringRuntime.view = {
    mode: DETECTOR_VIEW_MODES.DISK,
    selection: {
      disk: Number(cfg.initialDisk),
      detectorSide: cfg.detectorSide
    }
  };
  ringRuntime.history = [];
}

function ringMatchesSelection(data, view) {
  const selection = view.selection || {};

  if (selection.disk !== undefined && data.disk !== selection.disk) {
    return false;
  }
  if (
    (view.mode === DETECTOR_VIEW_MODES.HALF ||
      view.mode === DETECTOR_VIEW_MODES.MODULE) &&
    data.half !== undefined &&
    data.half !== selection.half
  ) {
    return false;
  }
  if (
    view.mode === DETECTOR_VIEW_MODES.MODULE &&
    data.ring !== undefined &&
    data.ring !== selection.ring
  ) {
    return false;
  }
  if (
    view.mode === DETECTOR_VIEW_MODES.MODULE &&
    selection.moduleIndex !== undefined &&
    data.moduleIndex !== selection.moduleIndex
  ) {
    return false;
  }

  return true;
}

function ringViewBounds(view) {
  if (view.mode === DETECTOR_VIEW_MODES.OVERVIEW) {
    return { xMin: -X_MAX, xMax: X_MAX, yMin: -Y_MAX, yMax: Y_MAX };
  }

  const selection = view.selection || {};
  const centre = diskCentre(selection.disk);
  let focusX = centre.x;
  let focusY = centre.y;
  let yRadius = cfg.outerRadius * 1.14;

  if (view.mode === DETECTOR_VIEW_MODES.HALF) {
    yRadius = cfg.outerRadius * 1.14;
  }

  if (view.mode === DETECTOR_VIEW_MODES.MODULE) {
    const ring = cfg.ringLayout.rings[String(selection.ring)]
      || cfg.ringLayout.rings[selection.ring];
    const angles = moduleAngleRange(
      ring,
      selection.half,
      selection.moduleIndex
    );
    const angle = angles.centre;
    const radius = (ring.inner_radius + ring.outer_radius) / 2;
    focusX += radius * Math.cos(angle);
    focusY += radius * Math.sin(angle);
    yRadius = Math.max(
      cfg.outerRadius * 0.72,
      Math.max(
        ring.outer_radius - ring.inner_radius,
        radius * (angles.end - angles.start)
      ) * 2.5
    );
  }

  const xRadius = yRadius * plotW / plotH;
  return {
    xMin: focusX - xRadius,
    xMax: focusX + xRadius,
    yMin: focusY - yRadius,
    yMax: focusY + yRadius
  };
}

function ringTargetSeries(name, id, data, zIndex) {
  return {
    id: id,
    name: name,
    type: "custom",
    coordinateSystem: "cartesian2d",
    data: data,
    z: zIndex,
    renderItem: function(params, api) {
      const datum = data[params.dataIndex];
      const shape = sectorPixelShape(api);
      const hovered = isDetectorHovered(ringRuntime, datum);
      const element = {
        type: "sector",
        shape: shape,
        cursor: "pointer",
        style: detectorHighlightStyle({
          fill: hovered ? "rgba(90, 175, 255, 0.16)" : "rgba(0, 0, 0, 0.001)",
          stroke: hovered ? "rgba(145, 210, 255, 0.98)" : "rgba(0, 0, 0, 0)",
          lineWidth: 0
        }, hovered)
      };
      return detectorTransition(element, hovered, shape.cx, shape.cy);
    }
  };
}

function ringDisplayPlacement(diskNumber, view) {
  if (view.mode === DETECTOR_VIEW_MODES.OVERVIEW) {
    return {
      centre: diskCentre(diskNumber),
      scale: 1
    };
  }

  const selectedDisk = Number(view.selection.disk);
  if (cfg.isolatedGeometry) {
    return {
      centre: { x: 0, y: 0 },
      scale: 1.45
    };
  }
  if (diskNumber === selectedDisk) {
    return {
      centre: { x: -X_MAX * 0.32, y: 0 },
      scale: 1.45
    };
  }

  const otherDisks = [];
  for (
    let candidate = 1;
    candidate <= cfg.ringLayout.n_disks;
    candidate++
  ) {
    if (candidate !== selectedDisk) {
      otherDisks.push(candidate);
    }
  }
  const index = otherDisks.indexOf(diskNumber);
  const columns = otherDisks.length > 4 ? 2 : 1;
  const rows = Math.ceil(otherDisks.length / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = columns === 1
    ? X_MAX * 0.68
    : X_MAX * (0.48 + column * 0.32);
  const yStep = 2 * Y_MAX / Math.max(1, rows);
  const y = Y_MAX - (row + 0.5) * yStep;

  return {
    centre: { x: x, y: y },
    scale: columns === 1 ? 0.42 : 0.34
  };
}

function transformRingDatum(data, kind, view) {
  if (view.mode === DETECTOR_VIEW_MODES.OVERVIEW) {
    return data;
  }

  const source = diskCentre(data.disk);
  const placement = ringDisplayPlacement(data.disk, view);
  const value = data.value.slice();

  if (kind === "sector") {
    value[0] = placement.centre.x;
    value[1] = placement.centre.y;
    value[2] *= placement.scale;
    value[3] *= placement.scale;
  } else if (kind === "axis") {
    value[0] = placement.centre.x;
    value[1] = placement.centre.y + (value[1] - source.y) * placement.scale;
    value[2] = placement.centre.x;
    value[3] = placement.centre.y + (value[3] - source.y) * placement.scale;
  } else {
    value[0] = placement.centre.x + (value[0] - source.x) * placement.scale;
    value[1] = placement.centre.y + (value[1] - source.y) * placement.scale;
  }

  return {
    ...data,
    value: value
  };
}

function ringModuleActionSeries(data) {
  return {
    id: "ring-module-actions",
    name: "Module boundaries",
    type: "custom",
    coordinateSystem: "cartesian2d",
    data: data,
    z: 35,
    renderItem: function(params, api) {
      const datum = data[params.dataIndex];
      const shape = sectorPixelShape(api);
      const hovered = isDetectorHovered(ringRuntime, datum);
      return {
        type: "group",
        cursor: datum.hardwareKey ? "pointer" : "default",
        children: [
          {
            type: "sector",
            shape: shape,
            style: {
              fill: null,
              stroke: "rgba(255,255,255,0.001)",
              lineWidth: 10
            }
          },
          {
            type: "sector",
            silent: true,
            shape: shape,
            style: {
              fill: null,
              stroke: hovered ? "#b9ddff" : "rgba(205,205,205,0.55)",
              lineWidth: hovered ? 2.2 : 1
            }
          }
        ]
      };
    }
  };
}

function buildRingOption(refresh) {
  const view = ringRuntime.view;
  const isolatedRadius = cfg.outerRadius * 1.82;
  const isolatedXRadius = isolatedRadius * plotW / plotH;
  const bounds = cfg.isolatedGeometry
    ? {
        xMin: -isolatedXRadius,
        xMax: isolatedXRadius,
        yMin: -isolatedRadius,
        yMax: isolatedRadius
      }
    : {
        xMin: -X_MAX,
        xMax: X_MAX,
        yMin: -Y_MAX,
        yMax: Y_MAX
      };
  const visibleBands = ringBands.filter(function(data) {
    if (cfg.isolatedGeometry) {
      return data.disk === view.selection.disk &&
        ringMatchesSelection(data, view);
    }
    return view.mode === DETECTOR_VIEW_MODES.OVERVIEW ||
      data.disk !== view.selection.disk ||
      ringMatchesSelection(data, view);
  }).map(function(data) {
    return transformRingDatum(data, "sector", view);
  });
  const visibleModules = moduleSlots.filter(function(data) {
    if (cfg.isolatedGeometry) {
      return data.disk === view.selection.disk &&
        ringMatchesSelection(data, view);
    }
    return view.mode === DETECTOR_VIEW_MODES.OVERVIEW ||
      data.disk !== view.selection.disk ||
      ringMatchesSelection(data, view);
  }).map(function(data) {
    return transformRingDatum(data, "sector", view);
  });
  const visibleChips = liveChips.filter(function(data) {
    if (cfg.isolatedGeometry) {
      return data.disk === view.selection.disk &&
        ringMatchesSelection(data, view);
    }
    return view.mode === DETECTOR_VIEW_MODES.OVERVIEW ||
      data.disk !== view.selection.disk ||
      ringMatchesSelection(data, view);
  }).map(function(data) {
    return transformRingDatum(data, "sector", view);
  });
  const visibleAxes = halfAxes.filter(function(data) {
    return !cfg.isolatedGeometry || data.disk === view.selection.disk;
  }).map(function(data) {
    return transformRingDatum(data, "axis", view);
  });
  const visibleLabels = labels.filter(function(data) {
    return !cfg.isolatedGeometry || data.disk === view.selection.disk;
  }).map(function(data) {
    return transformRingDatum(data, "point", view);
  });
  const activeTargets = view.mode === DETECTOR_VIEW_MODES.OVERVIEW
    ? diskTargets
    : view.mode === DETECTOR_VIEW_MODES.DISK
      ? diskTargets.filter(function(data) {
          return data.disk !== view.selection.disk;
        }).concat(halfTargets.filter(function(data) {
          return data.disk === view.selection.disk;
        }))
      : diskTargets.filter(function(data) {
          return data.disk !== view.selection.disk;
        });
  const isolatedTargets = cfg.isolatedGeometry
    ? halfTargets.filter(function(data) {
        return data.disk === view.selection.disk;
      })
    : activeTargets;
  const transformedTargets = isolatedTargets.map(function(data) {
    return transformRingDatum(data, "sector", view);
  });
  const graphics = navigationGraphics(
    ringRuntime,
    refresh,
    cfg.regionName + " " + cfg.detectorSide
  );


  return {
  backgroundColor: "transparent",

  title: {
    show: !cfg.isolatedGeometry,
    text:
      cfg.register +
      " " +
      cfg.regionName +
      " detector map, " +
      cfg.detectorSide +
      " side [" +
      (cfg.unit || "") +
      "]",
    left: "center",
    top: 4,
    textStyle: {
      color: "#eeeeee",
      fontSize: 18
    }
  },

  tooltip: {
    formatter: function(params) {
      const d = params.data;

      if (!d) {
        return "";
      }

      if (d.objectType !== "chip") {
        const label = d.objectType === "disk"
          ? "Disk " + d.disk
          : d.objectType === "half"
            ? (d.half === "upper" ? "Right Half" : "Left Half")
            : "Module " + d.moduleIndex;
        const action = d.objectType === "module"
          ? d.hardwareKey
            ? "Click to open all module chips"
            : "No hardware mapping for this module"
          : "Click to inspect";
        return "<b>" + label + "</b><br>" + action;
      }

      return [
        "<b>" +
          cfg.regionName +
          " Disk " +
          d.disk +
          "</b>",
        "Detector side: " + d.detectorSide,
        "Ring: " + d.ring,
        "Disk surface: " + ( d.diskSurface === "inner" ? "Inner Disk" : "Outer Disk" ),
        "Disk half: " + d.half,
        "Module index: " + d.moduleIndex,
        "Module type: " +
          (
            d.moduleType === "double"
              ? "Double 1x2"
              : "Quad 2x2"
          ),
        "Hardware: " + d.hardwareKey,
        "Chip: " + d.chip,
        "Register: " + d.register,
        "Value: " +
          d.value[6].toFixed(2) +
          " " +
          d.unit,
        "",
        "Click to open chip details"
      ].join("<br>");
    }
  },

  grid: {
    left: 20,
    right: 20,
    top: cfg.isolatedGeometry
      ? 42
      : view.mode === DETECTOR_VIEW_MODES.OVERVIEW ? 55 : 82,
    bottom: 20
  },

  xAxis: {
    type: "value",
    min: bounds.xMin,
    max: bounds.xMax,
    show: false
  },

  yAxis: {
    type: "value",
    min: bounds.yMin,
    max: bounds.yMax,
    show: false
  },

  graphic: graphics.concat([
    {
      type: "group",
      right: 15,
      bottom: 15,
      children: [
        {
          type: "rect",
          shape: {
            x: 0,
            y: 0,
            width: 15,
            height: 11
          },
          style: {
            fill: DISK_SURFACE_COLORS.inner.fill,
            stroke: DISK_SURFACE_COLORS.inner.line,
            lineWidth: 1
          }
        },
        {
          type: "text",
          style: {
            x: 20,
            y: 6,
            text: "Inner Disk",
            fill: "#dddddd",
            font: "11px sans-serif",
            textVerticalAlign: "middle"
          }
        },
        {
          type: "rect",
          shape: {
            x: 95,
            y: 0,
            width: 15,
            height: 11
          },
          style: {
            fill: DISK_SURFACE_COLORS.outer.fill,
            stroke: DISK_SURFACE_COLORS.outer.line,
            lineWidth: 1
          }
        },
        {
          type: "text",
          style: {
            x: 115,
            y: 6,
            text: "Outer Disk",
            fill: "#dddddd",
            font: "11px sans-serif",
            textVerticalAlign: "middle"
          }
        },
        {
          type: "text",
          style: {
            x: 0,
            y: 25,
            text:
              "Detector side: " +
              cfg.detectorSide,
            fill: "#dddddd",
            font: "bold 10px sans-serif"
          }
        },
        {
          type: "text",
          style: {
            x: 0,
            y: 40,
            text: "Double = 1x2   Quad = 2x2",
            fill: "#bbbbbb",
            font: "10px sans-serif"
          }
        }
      ]
    }
  ]),

  animation: true,
  animationDuration: DETECTOR_MOTION.duration,
  animationDurationUpdate: DETECTOR_MOTION.duration,
  animationEasing: DETECTOR_MOTION.easing,
  animationEasingUpdate: DETECTOR_MOTION.easing,

  series: [
    {
      id: "ring-backgrounds",
      name: "Ring backgrounds",
      type: "custom",
      coordinateSystem: "cartesian2d",
      data: visibleBands,
      silent: true,

      renderItem: function(params, api) {
        const cx = api.value(0);
        const cy = api.value(1);
        const innerRadius = api.value(2);
        const outerRadius = api.value(3);

        const centre = api.coord([cx, cy]);

        const innerEdge = api.coord([
          cx + innerRadius,
          cy
        ]);

        const outerEdge = api.coord([
          cx + outerRadius,
          cy
        ]);

        return {
          type: "sector",
          shape: {
            cx: centre[0],
            cy: centre[1],
            r0: Math.abs(
              innerEdge[0] - centre[0]
            ),
            r: Math.abs(
              outerEdge[0] - centre[0]
            ),
            startAngle: 0,
            endAngle: Math.PI * 2,
            clockwise: true
          },
          style: api.style()
        };
      }
    },

    {
      id: "ring-half-axes",
      name: "Half-disk axes",
      type: "custom",
      coordinateSystem: "cartesian2d",
      data: visibleAxes,
      silent: true,

      renderItem: function(params, api) {
        const p0 = api.coord([
          api.value(0),
          api.value(1)
        ]);

        const p1 = api.coord([
          api.value(2),
          api.value(3)
        ]);

        return {
          type: "line",
          shape: {
            x1: p0[0],
            y1: p0[1],
            x2: p1[0],
            y2: p1[1]
          },
          style: {
            stroke: "rgba(220,220,220,0.65)",
            lineWidth: 1.3
          }
        };
      }
    },

    {
      id: "ring-module-slots",
      name: "Module slots",
      type: "custom",
      coordinateSystem: "cartesian2d",
      data: visibleModules,
      silent: false,
      z: 25,

      renderItem: function(params, api) {
        const d = visibleModules[params.dataIndex];
        const shape = sectorPixelShape(api);
        const hovered = isDetectorHovered(ringRuntime, d);

        const angleMiddle =
          (
            shape.startAngle +
            shape.endAngle
          ) / 2;

        const radialMiddle =
          (
            shape.r0 +
            shape.r
          ) / 2;

        const children = [];

        if (d.moduleType === "double") {
          const angleMiddleSplit =
            (
              shape.startAngle +
              shape.endAngle
            ) / 2;

          children.push({
            type: "sector",
            shape: {
              ...shape,
              endAngle: angleMiddleSplit
            },
            style: {
              fill: "#1d2126",
              stroke: "rgba(190,190,190,0.30)",
              lineWidth: 1
            }
          });

          children.push({
            type: "sector",
            shape: {
              ...shape,
              startAngle: angleMiddleSplit
            },
            style: {
              fill: "#1d2126",
              stroke: "rgba(190,190,190,0.30)",
              lineWidth: 1
            }
          });
        } else {
          const angleMiddleSplit =
            (
              shape.startAngle +
              shape.endAngle
            ) / 2;

          children.push({
            type: "sector",
            shape: {
              ...shape,
              r0: radialMiddle,
              endAngle: angleMiddleSplit
            },
            style: {
              fill: "#1d2126",
              stroke: "rgba(190,190,190,0.25)",
              lineWidth: 1
            }
          });

          children.push({
            type: "sector",
            shape: {
              ...shape,
              r0: radialMiddle,
              startAngle: angleMiddleSplit
            },
            style: {
              fill: "#1d2126",
              stroke: "rgba(190,190,190,0.25)",
              lineWidth: 1
            }
          });

          children.push({
            type: "sector",
            shape: {
              ...shape,
              r: radialMiddle,
              endAngle: angleMiddleSplit
            },
            style: {
              fill: "#1d2126",
              stroke: "rgba(190,190,190,0.25)",
              lineWidth: 1
            }
          });

          children.push({
            type: "sector",
            shape: {
              ...shape,
              r: radialMiddle,
              startAngle: angleMiddleSplit
            },
            style: {
              fill: "#1d2126",
              stroke: "rgba(190,190,190,0.25)",
              lineWidth: 1
            }
          });
        }

        children.push({
          type: "sector",
          shape: shape,
          style: detectorHighlightStyle({
            fill: "transparent",
            stroke: hovered ? "#b9ddff" : "rgba(205,205,205,0.55)",
            lineWidth: hovered ? 2.2 : 1
          }, hovered)
        });

        return detectorTransition({
          type: "group",
          cursor: d.hardwareKey ? "pointer" : "default",
          children: children
        }, hovered, shape.cx, shape.cy);
      }
    },

    ringTargetSeries(
      "Detector navigation targets",
      "ring-navigation-targets",
      transformedTargets,
      20
    ),

    {
      id: "ring-live-chips",
      name: "Live chips",
      type: "custom",
      coordinateSystem: "cartesian2d",
      data: visibleChips,
      silent: false,
      z: 30,

      renderItem: function(params, api) {
        const datum = visibleChips[params.dataIndex];
        const value = api.value(6);
        const shape = sectorPixelShape(api);
        const hovered = isDetectorHovered(ringRuntime, datum);

        const radiusMiddle =
          (shape.r0 + shape.r) / 2;

        const angleMiddle =
          (
            shape.startAngle +
            shape.endAngle
          ) / 2;

        const textX =
          shape.cx +
          radiusMiddle * Math.cos(angleMiddle);

        const textY =
          shape.cy +
          radiusMiddle * Math.sin(angleMiddle);

        return detectorTransition({
          type: "group",
          cursor: "pointer",
          children: [
            {
              type: "sector",
              shape: shape,
              style: detectorHighlightStyle({
                fill: datum.itemStyle.color,
                stroke: hovered ? "#ffffff" : "#111111",
                lineWidth: hovered ? 2.3 : 1
              }, hovered)
            },
            {
              type: "text",
              style: {
                x: textX,
                y: textY,
                text: value.toFixed(1),
                fill: "#111111",
                font: "bold 8px sans-serif",
                textAlign: "center",
                textVerticalAlign: "middle"
              }
            }
          ]
        }, hovered, shape.cx, shape.cy);
      }
    },

    {
      id: "ring-disk-labels",
      name: "Disk labels",
      type: "custom",
      coordinateSystem: "cartesian2d",
      data: visibleLabels,
      silent: true,

      renderItem: function(params, api) {
        const point = api.coord([
          api.value(0),
          api.value(1)
        ]);

        const d = visibleLabels[params.dataIndex];

        return {
          type: "text",
          style: {
            x: point[0],
            y: point[1],
            text: d.text,
            fill: "#dddddd",
            font: d.font,
            textAlign: "center",
            textVerticalAlign: "middle"
          }
        };
      }
    },

    ringModuleActionSeries(visibleModules)
  ]
  };
}

const ringInteractions = installDetectorInteractions(
  context.panel.chart,
  cfg,
  buildRingOption
);

return buildRingOption(ringInteractions.refresh);
