const cfg = __CONFIG__;

const MODULE_GAP_FACTOR = 0.82;

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

  // Canvas angles increase clockwise.
  //
  // upper: pi ... 2pi
  // lower: 0 ... pi
  const halfStart =
    half === "upper" ? Math.PI : 0;

  const pitch = Math.PI / n;
  const centre =
    halfStart +
    (moduleIndex + 0.5) * pitch;

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

const ringBands = [];
const moduleSlots = [];
const liveChips = [];
const halfAxes = [];
const labels = [];

for (
  let diskNumber = 1;
  diskNumber <= cfg.ringLayout.n_disks;
  diskNumber++
) {
  const centre = diskCentre(diskNumber);

  labels.push({
    value: [
      centre.x,
      centre.y + cfg.outerRadius + 0.28
    ],
    text: "Disk " + diskNumber,
    font: "bold 13px sans-serif"
  });

  halfAxes.push({
    value: [
      centre.x - cfg.outerRadius - 0.08,
      centre.y,
      centre.x + cfg.outerRadius + 0.08,
      centre.y
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
    value: [
        centre.x,
        centre.y,
        ring.inner_radius,
        ring.outer_radius
    ],
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

        moduleSlots.push({
          value: [
            centre.x,
            centre.y,
            ring.inner_radius,
            ring.outer_radius,
            angles.start,
            angles.end
          ],
          disk: diskNumber,
          ring: ringNumber,
          diskSurface: ring.disk_surface,
          detectorSide: cfg.detectorSide,
          half: half,
          moduleIndex: moduleIndex,
          moduleType: ring.module_type
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
    value: [
      centre.x,
      centre.y,
      sector.innerRadius,
      sector.outerRadius,
      sector.startAngle,
      sector.endAngle,
      row.value
    ],
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

context.panel.chart.off("click");

context.panel.chart.on("click", function(params) {
  const d = params.data;

  if (!d || d.chip === undefined) {
    return;
  }

  const url =
    "/d/" +
    cfg.detailsUid +
    "/" +
    cfg.detailsSlug +
    "?" +
    "var-board=" +
    encodeURIComponent(d.board) +
    "&var-optical_group=" +
    encodeURIComponent(d.optical_group) +
    "&var-hybrid=" +
    encodeURIComponent(d.hybrid) +
    "&var-chip=" +
    encodeURIComponent(d.chip) +
    "&from=now-15m&to=now";

  window.location.href = url;
});

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

return {
  backgroundColor: "transparent",

  title: {
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

      if (!d || d.chip === undefined) {
        return "";
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
    top: 55,
    bottom: 20
  },

  xAxis: {
    type: "value",
    min: -X_MAX,
    max: X_MAX,
    show: false
  },

  yAxis: {
    type: "value",
    min: -Y_MAX,
    max: Y_MAX,
    show: false
  },

  graphic: [
    {
      type: "group",
      right: 15,
      top: 15,
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
  ],

  series: [
    {
      name: "Ring backgrounds",
      type: "custom",
      coordinateSystem: "cartesian2d",
      data: ringBands,
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
      name: "Half-disk axes",
      type: "custom",
      coordinateSystem: "cartesian2d",
      data: halfAxes,
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
      name: "Module slots",
      type: "custom",
      coordinateSystem: "cartesian2d",
      data: moduleSlots,
      silent: true,

      renderItem: function(params, api) {
        const d = moduleSlots[params.dataIndex];
        const shape = sectorPixelShape(api);

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
          style: {
            fill: "transparent",
            stroke: "rgba(205,205,205,0.55)",
            lineWidth: 1
          }
        });

        return {
          type: "group",
          children: children
        };
      }
    },

    {
      name: "Live chips",
      type: "custom",
      coordinateSystem: "cartesian2d",
      data: liveChips,

      renderItem: function(params, api) {
        const value = api.value(6);
        const shape = sectorPixelShape(api);

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

        return {
          type: "group",
          children: [
            {
              type: "sector",
              shape: shape,
              style: api.style()
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
        };
      }
    },

    {
      name: "Disk labels",
      type: "custom",
      coordinateSystem: "cartesian2d",
      data: labels,
      silent: true,

      renderItem: function(params, api) {
        const point = api.coord([
          api.value(0),
          api.value(1)
        ]);

        const d = labels[params.dataIndex];

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
    }
  ]
};