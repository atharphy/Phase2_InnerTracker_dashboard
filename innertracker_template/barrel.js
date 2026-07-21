const cfg = __CONFIG__;

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

function chipColumns(moduleType) {
  return 2;
}

function chipRows(moduleType) {
  return moduleType === "double" ? 1 : 2;
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

const barrelHardwareByModule = {};

for (const [key, geom] of Object.entries(cfg.geometry)) {
  const moduleKey = [
    geom.layer,
    geom.signed_ladder,
    geom.z_side,
    geom.module_index
  ].join(":");
  barrelHardwareByModule[moduleKey] = key;
}

const layerSlots = {
  1: [],
  2: [],
  3: [],
  4: []
};

const layerData = {
  1: [],
  2: [],
  3: [],
  4: []
};

for (const [layerKey, layer] of Object.entries(
  cfg.barrelLayout
)) {
  const layerNumber = Number(layerKey);

  for (
    let ladder = -layer.half_ladders;
    ladder <= layer.half_ladders;
    ladder++
  ) {
    if (ladder === 0) {
      continue;
    }

    for (
      let moduleIndex = 1;
      moduleIndex <= layer.z_minus_modules;
      moduleIndex++
    ) {
      const moduleHardwareKey = barrelHardwareByModule[[
        layerNumber,
        ladder,
        "z-",
        moduleIndex
      ].join(":")];
      layerSlots[layerNumber].push({
        id: ["module", layerNumber, ladder, "z-", moduleIndex].join("-"),
        value: [
          -moduleIndex,
          ladder,
          layer.module_type
        ],
        objectType: "module",
        moduleType: layer.module_type,
        layer: layerNumber,
        signedLadder: ladder,
        zSide: "z-",
        moduleIndex: moduleIndex,
        ...hardwareMetadata(moduleHardwareKey)
      });
    }

    for (
      let moduleIndex = 1;
      moduleIndex <= layer.z_plus_modules;
      moduleIndex++
    ) {
      const moduleHardwareKey = barrelHardwareByModule[[
        layerNumber,
        ladder,
        "z+",
        moduleIndex
      ].join(":")];
      layerSlots[layerNumber].push({
        id: ["module", layerNumber, ladder, "z+", moduleIndex].join("-"),
        value: [
          moduleIndex,
          ladder,
          layer.module_type
        ],
        objectType: "module",
        moduleType: layer.module_type,
        layer: layerNumber,
        signedLadder: ladder,
        zSide: "z+",
        moduleIndex: moduleIndex,
        ...hardwareMetadata(moduleHardwareKey)
      });
    }
  }
}

for (const row of rows) {
  const geom = cfg.geometry[row.hardwareKey];

  if (!geom) {
    console.warn(
      "No Barrel geometry for",
      row.hardwareKey
    );
    continue;
  }

  const layerNumber = Number(geom.layer);
  const layer = cfg.barrelLayout[String(layerNumber)]
    || cfg.barrelLayout[layerNumber];

  if (!layer) {
    continue;
  }

  const signedLadder = Number(geom.signed_ladder);
  const moduleIndex = Number(geom.module_index);

  const moduleX =
    geom.z_side === "z+"
      ? moduleIndex
      : -moduleIndex;

  const moduleY = signedLadder;

  const layout = chipLayout(layer.module_type);
  const xy = layout[row.chip];

  if (!xy) {
    console.warn(
      "Chip",
      row.chip,
      "does not fit",
      layer.module_type,
      "module",
      row.hardwareKey
    );
    continue;
  }

  const columns = chipColumns(layer.module_type);
  const rowsInModule = chipRows(layer.module_type);

  const chipW = 1 / columns;
  const chipH = 1 / rowsInModule;

  const chipX =
    moduleX - 0.5 + xy[0] * chipW;

  const chipY =
    moduleY + 0.5 -
    (xy[1] + 1) * chipH;

  layerData[layerNumber].push({
    id: ["chip", layerNumber, row.hardwareKey, row.chip].join("-"),
    value: [
      chipX,
      chipY,
      row.value
    ],
    objectType: "chip",
    chipW: chipW,
    chipH: chipH,
    moduleType: layer.module_type,
    layer: layerNumber,
    signedLadder: signedLadder,
    zSide: geom.z_side,
    moduleIndex: moduleIndex,
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

const barrelRuntime = detectorViewerRuntime(context.panel.chart);

if (
  cfg.initialLayer &&
  barrelRuntime.view.mode === DETECTOR_VIEW_MODES.OVERVIEW
) {
  barrelRuntime.view = {
    mode: DETECTOR_VIEW_MODES.LAYER,
    selection: { layer: Number(cfg.initialLayer) }
  };
  barrelRuntime.history = [];
}

function barrelMatches(data, view) {
  const selection = view.selection || {};
  if (selection.layer !== undefined && data.layer !== selection.layer) {
    return false;
  }
  if (
    view.mode === DETECTOR_VIEW_MODES.QUADRANT &&
    (data.zSide !== selection.zSide ||
      (data.signedLadder > 0 ? "positive" : "negative") !==
        selection.ladderSign)
  ) {
    return false;
  }
  if (
    (view.mode === DETECTOR_VIEW_MODES.LADDER ||
      view.mode === DETECTOR_VIEW_MODES.MODULE) &&
    data.signedLadder !== selection.signedLadder
  ) {
    return false;
  }
  if (
    view.mode === DETECTOR_VIEW_MODES.MODULE &&
    (data.zSide !== selection.zSide ||
      data.moduleIndex !== selection.moduleIndex)
  ) {
    return false;
  }
  return true;
}

function barrelModuleX(data) {
  return data.zSide === "z+" ? data.moduleIndex : -data.moduleIndex;
}

function barrelAxes(layerNumber, active, axisView) {
  const layer = cfg.barrelLayout[String(layerNumber)]
    || cfg.barrelLayout[layerNumber];
  const view = axisView || barrelRuntime.view;
  const selection = view.selection || {};
  let xMin = -layer.z_minus_modules - 0.5;
  let xMax = layer.z_plus_modules + 0.5;
  let yMin = -layer.half_ladders - 0.5;
  let yMax = layer.half_ladders + 0.5;

  if (active && view.mode === DETECTOR_VIEW_MODES.LADDER) {
    yMin = selection.signedLadder - 2.5;
    yMax = selection.signedLadder + 2.5;
  }
  if (active && view.mode === DETECTOR_VIEW_MODES.QUADRANT) {
    if (selection.zSide === "z+") {
      xMin = 0.5;
    } else {
      xMax = -0.5;
    }
    if (selection.ladderSign === "positive") {
      yMin = 0.5;
    } else {
      yMax = -0.5;
    }

  }
  if (active && view.mode === DETECTOR_VIEW_MODES.MODULE) {
    const moduleX = barrelModuleX(selection);
    xMin = moduleX - 2.0;
    xMax = moduleX + 2.0;
    yMin = selection.signedLadder - 2.2;
    yMax = selection.signedLadder + 2.2;
  }

  const common = {
    type: "value",
    gridIndex: layerNumber - 1,
    show: active,
    interval: 0.5,
    axisLabel: {
      show: true,
      inside: false,
      color: "#f0f0f0",
      fontSize: 11,
      formatter: function(value) {
        const rounded = Math.round(value);
        return Math.abs(value - rounded) < 0.001 && rounded !== 0
          ? String(rounded)
          : "";
      }
    },
    axisLine: {
      show: true,
      lineStyle: { color: "rgba(230,230,230,0.85)", width: 1.2 }
    },
    axisTick: {
      show: true,
      lineStyle: { color: "rgba(230,230,230,0.85)" }
    },
    splitLine: {
      show: true,
      lineStyle: { color: "rgba(180,180,180,0.12)" }
    }
  };

  return {
    x: {
      ...common,
      min: xMin,
      max: xMax,
      name: "Module position along z",
      nameLocation: "middle",
      nameGap: 28,
      nameTextStyle: { color: "#eeeeee", fontSize: 12, fontWeight: "bold" }
    },
    y: {
      ...common,
      min: yMin,
      max: yMax,
      name: "Signed ladder",
      nameLocation: "middle",
      nameGap: 46,
      nameRotate: 90,
      nameTextStyle: { color: "#eeeeee", fontSize: 12, fontWeight: "bold" }
    }
  };
}

function barrelSlotSeries(layerNumber, data) {
  return {
    id: "barrel-slots-" + layerNumber,
    name: "Layer " + layerNumber + " modules",
    type: "custom",
    coordinateSystem: "cartesian2d",
    xAxisIndex: layerNumber - 1,
    yAxisIndex: layerNumber - 1,
    data: data,
    z: 2,
    renderItem: function(params, api) {
      const datum = data[params.dataIndex];
      const moduleX = api.value(0);
      const moduleY = api.value(1);
      const p0 = api.coord([moduleX - 0.5, moduleY - 0.5]);
      const p1 = api.coord([moduleX + 0.5, moduleY + 0.5]);
      const width = p1[0] - p0[0];
      const height = p0[1] - p1[1];
      const hovered = isDetectorHovered(barrelRuntime, datum);
      const children = [];
      const chipRows = datum.moduleType === "double" ? 1 : 2;

      for (let row = 0; row < chipRows; row++) {
        for (let column = 0; column < 2; column++) {
          children.push({
            type: "rect",
            shape: {
              x: p0[0] + column * width / 2,
              y: p1[1] + row * height / chipRows,
              width: width / 2,
              height: height / chipRows
            },
            style: {
              fill: "#1d2126",
              stroke: "rgba(180,180,180,0.25)",
              lineWidth: 1
            }
          });
        }
      }

      children.push({
        type: "rect",
        shape: {
          x: p0[0],
          y: p1[1],
          width: width,
          height: height
        },
        style: detectorHighlightStyle({
          fill: "transparent",
          stroke: hovered ? "#b9ddff" : "rgba(190,190,190,0.55)",
          lineWidth: hovered ? 2.2 : 1
        }, hovered)
      });

      const group = {
        type: "group",
        cursor: "pointer",
        children: children
      };
      return detectorTransition(
        group,
        hovered,
        p0[0] + width / 2,
        p1[1] + height / 2
      );
    }
  };
}

function barrelChipSeries(layerNumber, data) {
  return {
    id: "barrel-chips-" + layerNumber,
    name: "Layer " + layerNumber + " live chips",
    type: "custom",
    coordinateSystem: "cartesian2d",
    xAxisIndex: layerNumber - 1,
    yAxisIndex: layerNumber - 1,
    data: data,
    z: 4,
    renderItem: function(params, api) {
      const datum = data[params.dataIndex];
      const p0 = api.coord([api.value(0), api.value(1)]);
      const p1 = api.coord([
        api.value(0) + datum.chipW,
        api.value(1) + datum.chipH
      ]);
      const width = p1[0] - p0[0];
      const height = p0[1] - p1[1];
      const hovered = isDetectorHovered(barrelRuntime, datum);
      const rect = {
        type: "rect",
        shape: { x: p0[0], y: p1[1], width: width, height: height },
        style: detectorHighlightStyle({
          fill: datum.itemStyle.color,
          stroke: hovered ? "#ffffff" : "#111111",
          lineWidth: hovered ? 2.3 : 1
        }, hovered)
      };
      return detectorTransition({
        type: "group",
        cursor: "pointer",
        children: [
          rect,
          {
            type: "text",
            silent: true,
            style: {
              x: p0[0] + width / 2,
              y: p1[1] + height / 2,
              text: api.value(2).toFixed(1),
              fill: "#111111",
              font: "bold 10px sans-serif",
              textAlign: "center",
              textVerticalAlign: "middle"
            }
          }
        ]
      }, hovered, p0[0] + width / 2, p1[1] + height / 2);
    }
  };
}

function barrelModuleActionSeries(layerNumber, data) {
  return {
    id: "barrel-module-actions-" + layerNumber,
    name: "Layer " + layerNumber + " module boundaries",
    type: "custom",
    coordinateSystem: "cartesian2d",
    xAxisIndex: layerNumber - 1,
    yAxisIndex: layerNumber - 1,
    data: data,
    z: 6,
    renderItem: function(params, api) {
      const datum = data[params.dataIndex];
      const p0 = api.coord([api.value(0) - 0.5, api.value(1) - 0.5]);
      const p1 = api.coord([api.value(0) + 0.5, api.value(1) + 0.5]);
      const shape = {
        x: p0[0],
        y: p1[1],
        width: p1[0] - p0[0],
        height: p0[1] - p1[1]
      };
      const hovered = isDetectorHovered(barrelRuntime, datum);
      return {
        type: "group",
        cursor: datum.hardwareKey ? "pointer" : "default",
        children: [
          {
            type: "rect",
            shape: shape,
            style: {
              fill: null,
              stroke: "rgba(255,255,255,0.001)",
              lineWidth: 10
            }
          },
          {
            type: "rect",
            silent: true,
            shape: shape,
            style: {
              fill: null,
              stroke: hovered ? "#b9ddff" : "rgba(190,190,190,0.55)",
              lineWidth: hovered ? 2.2 : 1
            }
          }
        ]
      };
    }
  };
}

function barrelQuadrantSeries(layerNumber, layer, enabled) {
  const data = [];

  if (enabled) {
    for (const quadrant of [
      [0.22, 0.22, "z+", "positive", "z+ / ladder +"],
      [0.22, -0.22, "z+", "negative", "z+ / ladder −"],
      [-0.22, 0.22, "z-", "positive", "z- / ladder +"],
      [-0.22, -0.22, "z-", "negative", "z- / ladder −"]
    ]) {
      data.push({
        id: ["quadrant", layerNumber, quadrant[2], quadrant[3]].join("-"),
        value: [quadrant[0], quadrant[1]],
        objectType: "quadrant",
        layer: layerNumber,
        zSide: quadrant[2],
        ladderSign: quadrant[3],
        quadrant: quadrant[4]
      });
    }
  }

  return {
    id: "barrel-quadrant-targets-" + layerNumber,
    name: "Layer " + layerNumber + " quadrant zoom",
    type: "custom",
    coordinateSystem: "cartesian2d",
    xAxisIndex: layerNumber - 1,
    yAxisIndex: layerNumber - 1,
    data: data,
    z: 20,
    renderItem: function(params, api) {
      const datum = data[params.dataIndex];
      const hovered = isDetectorHovered(barrelRuntime, datum);
      const corner0 = api.coord([
        datum.zSide === "z+" ? 0.5 : -layer.z_minus_modules - 0.5,
        datum.ladderSign === "positive" ? 0.5 : -layer.half_ladders - 0.5
      ]);
      const corner1 = api.coord([
        datum.zSide === "z+" ? layer.z_plus_modules + 0.5 : -0.5,
        datum.ladderSign === "positive" ? layer.half_ladders + 0.5 : -0.5
      ]);
      const verticalGap0 = api.coord([
        datum.zSide === "z+" ? 0 : -0.5,
        datum.ladderSign === "positive" ? 0.5 : -layer.half_ladders - 0.5
      ]);
      const verticalGap1 = api.coord([
        datum.zSide === "z+" ? 0.5 : 0,
        datum.ladderSign === "positive" ? layer.half_ladders + 0.5 : -0.5
      ]);
      const horizontalGap0 = api.coord([
        datum.zSide === "z+" ? 0.5 : -layer.z_minus_modules - 0.5,
        datum.ladderSign === "positive" ? 0 : -0.5
      ]);
      const horizontalGap1 = api.coord([
        datum.zSide === "z+" ? layer.z_plus_modules + 0.5 : -0.5,
        datum.ladderSign === "positive" ? 0.5 : 0
      ]);
      const gapStyle = {
        fill: hovered ? "rgba(90,175,255,0.22)" : "rgba(0,0,0,0.001)",
        stroke: hovered ? "rgba(145,210,255,0.75)" : "transparent",
        lineWidth: hovered ? 1.2 : 0
      };
      return {
        type: "group",
        cursor: "pointer",
        children: [
          {
            type: "rect",
            silent: true,
            shape: {
              x: Math.min(corner0[0], corner1[0]),
              y: Math.min(corner0[1], corner1[1]),
              width: Math.abs(corner1[0] - corner0[0]),
              height: Math.abs(corner1[1] - corner0[1])
            },
            style: {
              fill: hovered ? "rgba(90,175,255,0.12)" : "transparent",
              stroke: hovered ? "rgba(145,210,255,0.8)" : "transparent",
              lineWidth: hovered ? 1.5 : 0
            }
          },
          {
            type: "rect",
            shape: {
              x: Math.min(verticalGap0[0], verticalGap1[0]),
              y: Math.min(verticalGap0[1], verticalGap1[1]),
              width: Math.abs(verticalGap1[0] - verticalGap0[0]),
              height: Math.abs(verticalGap1[1] - verticalGap0[1])
            },
            style: gapStyle
          },
          {
            type: "rect",
            shape: {
              x: Math.min(horizontalGap0[0], horizontalGap1[0]),
              y: Math.min(horizontalGap0[1], horizontalGap1[1]),
              width: Math.abs(horizontalGap1[0] - horizontalGap0[0]),
              height: Math.abs(horizontalGap1[1] - horizontalGap0[1])
            },
            style: gapStyle
          }
        ]
      };
    }
  };
}

function barrelLayerActionSeries(layerNumber, enabled) {
  const data = enabled
    ? [{
        id: "layer-target-" + layerNumber,
        value: [0, 0],
        objectType: "layer",
        layer: layerNumber
      }]
    : [];

  return {
    id: "barrel-layer-targets-" + layerNumber,
    name: "Open Layer " + layerNumber,
    type: "custom",
    coordinateSystem: "cartesian2d",
    xAxisIndex: layerNumber - 1,
    yAxisIndex: layerNumber - 1,
    data: data,
    z: 21,
    renderItem: function(params, api) {
      const datum = data[params.dataIndex];
      const point = api.coord([api.value(0), api.value(1)]);
      const hovered = isDetectorHovered(barrelRuntime, datum);
      return detectorTransition({
        type: "group",
        cursor: "pointer",
        children: [
          {
            type: "rect",
            shape: { x: point[0] - 52, y: point[1] - 13, width: 104, height: 26, r: 5 },
            style: detectorHighlightStyle({
              fill: hovered
                ? "rgba(60,105,150,0.96)"
                : "rgba(35,45,58,0.92)",
              stroke: hovered ? "#b9ddff" : "rgba(180,195,220,0.85)",
              lineWidth: hovered ? 2 : 1,
              shadowBlur: 8,
              shadowColor: "rgba(0,0,0,0.5)"
            }, hovered)
          },
          {
            type: "text",
            silent: true,
            style: {
              x: point[0],
              y: point[1],
              text: "Open Layer " + layerNumber,
              fill: "#f1f3f6",
              font: "bold 11px sans-serif",
              textAlign: "center",
              textVerticalAlign: "middle"
            }
          }
        ]
      }, hovered, point[0], point[1]);
    }
  };
}

function barrelQuadrantGraphic(
  layerNumber,
  zSide,
  ladderSign,
  right,
  runtime,
  refresh
) {
  const signLabel = ladderSign === "positive" ? "+" : "−";
  const quadrant = zSide + " / ladder " + signLabel;
  return {
    id: ["barrel-quadrant", layerNumber, zSide, ladderSign].join("-"),
    type: "group",
    right: right,
    top: 45,
    cursor: "pointer",
    z: 1000,
    onclick: function() {
      navigateToDetectorObject(runtime, {
        objectType: "quadrant",
        layer: layerNumber,
        zSide: zSide,
        ladderSign: ladderSign,
        quadrant: quadrant
      });
      refresh();
    },
    children: [
      {
        type: "rect",
        shape: { x: 0, y: 0, width: 132, height: 26, r: 5 },
        style: {
          fill: "rgba(45,52,64,0.94)",
          stroke: "rgba(180,195,220,0.75)",
          lineWidth: 1
        }
      },
      {
        type: "text",
        style: {
          x: 66,
          y: 13,
          text: quadrant,
          fill: "#f1f3f6",
          font: "bold 11px sans-serif",
          textAlign: "center",
          textVerticalAlign: "middle"
        }
      }
    ]
  };
}

function buildBarrelOption(refresh) {
  const view = barrelRuntime.view;
  const selectedLayer = view.selection && view.selection.layer;
  const grids = [];
  const xAxes = [];
  const yAxes = [];
  const series = [];
  const graphics = navigationGraphics(barrelRuntime, refresh, "Barrel");

  let detailTop = 9;

  for (let layerNumber = 1; layerNumber <= 4; layerNumber++) {
    const layer = cfg.barrelLayout[String(layerNumber)]
      || cfg.barrelLayout[layerNumber];
    const selected = view.mode !== DETECTOR_VIEW_MODES.OVERVIEW
      && layerNumber === selectedLayer;
    const active = !cfg.isolatedGeometry || selected;
    const sectionHeight = cfg.isolatedGeometry
      ? selected ? 88 : 0
      : view.mode === DETECTOR_VIEW_MODES.OVERVIEW
      ? 22.5
      : selected ? 34 : 17;
    const labelTop = cfg.isolatedGeometry
      ? 9
      : view.mode === DETECTOR_VIEW_MODES.OVERVIEW
      ? 7 + (layerNumber - 1) * 22.5
      : detailTop;
    const top = labelTop + 3;
    const height = sectionHeight - 4;
    const layerView = selected
      ? view
      : {
          mode: DETECTOR_VIEW_MODES.OVERVIEW,
          selection: null
        };
    const axes = barrelAxes(layerNumber, active, layerView);
    const slots = active ? layerSlots[layerNumber].filter(function(data) {
      return barrelMatches(data, layerView);
    }) : [];
    const chips = active ? layerData[layerNumber].filter(function(data) {
      return barrelMatches(data, layerView);
    }) : [];

    grids.push({
      id: "barrel-grid-" + layerNumber,
      left: 90,
      right: 35,
      top: top + "%",
      height: active ? height + "%" : 0,
      containLabel: true
    });
    xAxes.push(axes.x);
    yAxes.push(axes.y);
    series.push(barrelSlotSeries(layerNumber, slots));
    series.push(barrelChipSeries(layerNumber, chips));
    series.push(barrelModuleActionSeries(layerNumber, slots));
    series.push(barrelQuadrantSeries(
      layerNumber,
      layer,
      active && (
        view.mode === DETECTOR_VIEW_MODES.OVERVIEW ||
        view.mode === DETECTOR_VIEW_MODES.LAYER ||
        !selected
      )
    ));

    if (active) {
      graphics.push({
        id: "barrel-layer-label-" + layerNumber,
        type: "text",
        left: 90,
        top: labelTop + "%",
        silent: true,
        style: {
          text: "Layer " + layerNumber + "   |   " +
            (layer.module_type === "double" ? "Double module 1x2" : "Quad module 2x2") +
            "   |   " + (2 * layer.half_ladders) + " ladders",
          fill: "#eeeeee",
          font: "bold 15px sans-serif"
        },
        z: 100
      });
    }

    if (
      !cfg.isolatedGeometry &&
      view.mode !== DETECTOR_VIEW_MODES.OVERVIEW
    ) {
      detailTop += sectionHeight;
    }
  }

  return {
    backgroundColor: "transparent",
    animation: true,
    animationDurationUpdate: DETECTOR_MOTION.duration,
    animationEasingUpdate: DETECTOR_MOTION.easing,
    title: {
      text: cfg.register + " Barrel detector map [" + (cfg.unit || "") + "]",
      left: "center",
      top: 4,
      textStyle: { color: "#eeeeee", fontSize: 18 }
    },
    tooltip: {
      formatter: function(params) {
        const d = params.data;
        if (!d) {
          return "";
        }
        if (d.objectType === "quadrant") {
          return [
            "<b>Barrel Layer " + d.layer + "</b>",
            d.quadrant,
            "Click to open this quadrant"
          ].join("<br>");
        }
        if (d.objectType !== "chip") {
          return [
            "<b>Barrel Layer " + d.layer + "</b>",
            "Signed ladder: " + d.signedLadder,
            "Side: " + d.zSide,
            "Module index: " + d.moduleIndex,
            "",
            d.hardwareKey
              ? "Click to open all module chips"
              : "No hardware mapping for this module"
          ].join("<br>");
        }
        return [
          "<b>Barrel Layer " + d.layer + "</b>",
          "Signed ladder: " + d.signedLadder,
          "Side: " + d.zSide,
          "Module index: " + d.moduleIndex,
          "Module type: " + (d.moduleType === "double" ? "Double 1x2" : "Quad 2x2"),
          "Hardware: " + d.hardwareKey,
          "Chip: " + d.chip,
          "Register: " + d.register,
          "Value: " + d.value[2].toFixed(2) + " " + d.unit,
          "",
          "Click to open chip details"
        ].join("<br>");
      }
    },
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    graphic: graphics,
    series: series
  };
}

const barrelInteractions = installDetectorInteractions(
  context.panel.chart,
  cfg,
  buildBarrelOption
);

return buildBarrelOption(barrelInteractions.refresh);
