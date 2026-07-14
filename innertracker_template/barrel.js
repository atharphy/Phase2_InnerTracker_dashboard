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
      layerSlots[layerNumber].push({
        value: [
          -moduleIndex,
          ladder,
          layer.module_type
        ],
        moduleType: layer.module_type
      });
    }

    for (
      let moduleIndex = 1;
      moduleIndex <= layer.z_plus_modules;
      moduleIndex++
    ) {
      layerSlots[layerNumber].push({
        value: [
          moduleIndex,
          ladder,
          layer.module_type
        ],
        moduleType: layer.module_type
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
    value: [
      chipX,
      chipY,
      row.value
    ],
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

const grids = [];
const xAxes = [];
const yAxes = [];
const series = [];
const graphics = [];

const topStart = 7;
const layerSectionHeight = 23;
const labelBandHeight = 3.0;
const plotHeight = 18.5;

for (let layerNumber = 1; layerNumber <= 4; layerNumber++) {
  const layer = cfg.barrelLayout[String(layerNumber)]
    || cfg.barrelLayout[layerNumber];

    const gridIndex = layerNumber - 1;

    const sectionTop = topStart + gridIndex * layerSectionHeight;

    const labelTop = sectionTop;

    const plotTop = sectionTop + labelBandHeight;

    grids.push({
        left: 90,
        right: 35,
        top: plotTop + "%",
        height: plotHeight + "%",
        containLabel: true
    });

  xAxes.push({
    type: "value",
    gridIndex: gridIndex,
    name: "Module position along z",
    nameLocation: "middle",
    nameGap: 28,
    nameTextStyle: {
    color: "#bbbbbb",
    fontSize: 11
    },
    min: -layer.z_minus_modules - 0.5,
    max: layer.z_plus_modules + 0.5,
    interval: 0.5,
    axisLabel: {
      color: "#dddddd",
      formatter: function(value) {
        const rounded = Math.round(value);

        if (
          Math.abs(value - rounded) < 0.001 &&
          rounded !== 0
        ) {
          return String(rounded);
        }

        return "";
      }
    },
    axisLine: {
      lineStyle: {
        color: "rgba(210,210,210,0.55)"
      }
    },
    axisTick: {
      show: true
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: "rgba(180,180,180,0.12)"
      }
    }
  });

  yAxes.push({
    type: "value",
    gridIndex: gridIndex,
    name: "Signed ladder",
    nameLocation: "middle",
    nameGap: 46,
    nameRotate: 90,
    nameTextStyle: {
    color: "#bbbbbb",
    fontSize: 11
    },
    min: -layer.half_ladders - 0.5,
    max: layer.half_ladders + 0.5,
    interval: 0.5,
    axisLabel: {
      color: "#dddddd",
      formatter: function(value) {
        const rounded = Math.round(value);

        if (
          Math.abs(value - rounded) < 0.001 &&
          rounded !== 0
        ) {
          return String(rounded);
        }

        return "";
      }
    },
    axisLine: {
      lineStyle: {
        color: "rgba(210,210,210,0.55)"
      }
    },
    axisTick: {
      show: true
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: "rgba(180,180,180,0.12)"
      }
    }
  });

    graphics.push({
        type: "text",
        left: 90,
        top: labelTop + "%",
        style: {
            text:
            "Layer " +
            layerNumber +
            "   |   " +
            (
                layer.module_type === "double"
                ? "Double module 1x2"
                : "Quad module 2x2"
            ) +
            "   |   " +
            (2 * layer.half_ladders) +
            " ladders",
            fill: "#eeeeee",
            font: "bold 15px sans-serif",
            textAlign: "left",
            textVerticalAlign: "top"
        },
        z: 100
    });

  series.push({
    name: "Layer " + layerNumber + " slots",
    type: "custom",
    coordinateSystem: "cartesian2d",
    xAxisIndex: gridIndex,
    yAxisIndex: gridIndex,
    data: layerSlots[layerNumber],
    silent: true,

    renderItem: function(params, api) {
      const moduleX = api.value(0);
      const moduleY = api.value(1);
      const moduleType =
        layerSlots[layerNumber][params.dataIndex]
          .moduleType;

      const p0 = api.coord([
        moduleX - 0.5,
        moduleY - 0.5
      ]);

      const p1 = api.coord([
        moduleX + 0.5,
        moduleY + 0.5
      ]);

      const width = p1[0] - p0[0];
      const height = p0[1] - p1[1];

      const children = [];
      const chipRows =
        moduleType === "double" ? 1 : 2;

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
        style: {
          fill: "transparent",
          stroke: "rgba(190,190,190,0.55)",
          lineWidth: 1
        }
      });

      return {
        type: "group",
        children: children
      };
    }
  });

  series.push({
    name: "Layer " + layerNumber + " live",
    type: "custom",
    coordinateSystem: "cartesian2d",
    xAxisIndex: gridIndex,
    yAxisIndex: gridIndex,
    data: layerData[layerNumber],

    renderItem: function(params, api) {
      const x = api.value(0);
      const y = api.value(1);
      const value = api.value(2);

      const d = layerData[layerNumber][
        params.dataIndex
      ];

      const p0 = api.coord([x, y]);

      const p1 = api.coord([
        x + d.chipW,
        y + d.chipH
      ]);

      const width = p1[0] - p0[0];
      const height = p0[1] - p1[1];

      return {
        type: "group",
        children: [
          {
            type: "rect",
            shape: {
              x: p0[0],
              y: p1[1],
              width: width,
              height: height
            },
            style: api.style()
          },
          {
            type: "text",
            style: {
              x: p0[0] + width / 2,
              y: p1[1] + height / 2,
              text: value.toFixed(1),
              fill: "#111111",
              font: "bold 10px sans-serif",
              textAlign: "center",
              textVerticalAlign: "middle"
            }
          }
        ]
      };
    }
  });
}

return {
  backgroundColor: "transparent",

  title: {
    text:
      cfg.register +
      " Barrel detector map [" +
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
        "<b>Barrel Layer " + d.layer + "</b>",
        "Signed ladder: " + d.signedLadder,
        "Side: " + d.zSide,
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
          d.value[2].toFixed(2) +
          " " +
          d.unit,
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