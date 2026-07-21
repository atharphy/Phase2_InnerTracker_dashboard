const cfg = __CONFIG__;
const chart = context.panel.chart;
const MODULE_GAP_FACTOR = 0.82;
const DISK_ROTATION = Math.PI / 2;
const DISK_SURFACE_COLORS = {
  inner: { fill: "rgba(63, 132, 214, 0.09)", line: "rgba(100, 170, 255, 0.58)" },
  outer: { fill: "rgba(224, 145, 63, 0.08)", line: "rgba(255, 180, 95, 0.55)" }
};
const runtime = chart.__cmsitPartsViewer || {
  selection: { subdetector: "TBPX", element: "1", part: "ladder+z+" },
  views: [],
  open: null,
  nextId: 1
};
chart.__cmsitPartsViewer = runtime;

function fieldValue(field, index) {
  return Number(field.values.get ? field.values.get(index) : field.values[index]);
}

function hardwareKey(labels) {
  return [labels.board || "", labels.optical_group || "", labels.hybrid || ""].join("/");
}

const valuesByHardware = {};
for (const frame of context.panel.data.series) {
  for (const field of frame.fields) {
    if (field.type !== "number") continue;
    const labels = field.labels || {};
    const key = hardwareKey(labels);
    const chip = String(labels.chip || "0");
    for (let index = 0; index < field.values.length; index++) {
      const value = fieldValue(field, index);
      if (!Number.isFinite(value)) continue;
      if (!valuesByHardware[key]) valuesByHardware[key] = {};
      valuesByHardware[key][chip] = {
        value: value,
        board: String(labels.board || ""),
        optical_group: String(labels.optical_group || ""),
        hybrid: String(labels.hybrid || ""),
        chip: chip
      };
    }
  }
}

function colorFor(value) {
  if (!Number.isFinite(value)) return "#1d2126";
  if (cfg.min !== null && cfg.min !== undefined && value < cfg.min) return "#d84a4a";
  if (cfg.max !== null && cfg.max !== undefined && value > cfg.max) return "#d84a4a";
  return "#329b62";
}

function detailUrl(meta, chip) {
  return "/d/" + cfg.detailsUid + "/" + cfg.detailsSlug + "?" +
    "var-board=" + encodeURIComponent(meta.board || "") +
    "&var-optical_group=" + encodeURIComponent(meta.optical_group || "") +
    "&var-hybrid=" + encodeURIComponent(meta.hybrid || "") +
    "&var-chip=" + encodeURIComponent(chip) +
    "&var-return_url=" + encodeURIComponent(window.location.href) +
    "&from=now-15m&to=now";
}

function openDetail(meta, chip) {
  if (!meta || !meta.board) return;
  window.location.href = detailUrl(meta, chip);
}

function text(x, y, value, size, weight, align) {
  return {
    type: "text",
    silent: true,
    style: {
      x: x,
      y: y,
      text: value,
      fill: "#dfe4eb",
      font: (weight || "normal") + " " + (size || 12) + "px sans-serif",
      textAlign: align || "left",
      textVerticalAlign: "middle"
    }
  };
}

function rect(x, y, width, height, fill, stroke, lineWidth, radius) {
  return {
    type: "rect",
    shape: { x: x, y: y, width: width, height: height, r: radius || 0 },
    style: { fill: fill, stroke: stroke, lineWidth: lineWidth || 1 }
  };
}

function elementOptions() {
  const count = runtime.selection.subdetector === "TBPX"
    ? 4
    : runtime.selection.subdetector === "TFPX" ? 8 : 4;
  const prefix = runtime.selection.subdetector === "TBPX" ? "Layer " : "Disk ";
  return Array.from({ length: count }, function(_, index) {
    return { value: String(index + 1), label: prefix + (index + 1) };
  });
}

function partOptions() {
  if (runtime.selection.subdetector === "TBPX") {
    return [
      { value: "ladder+z+", label: "Ladder (+) Z (+)" },
      { value: "ladder+z-", label: "Ladder (+) Z (-)" },
      { value: "ladder-z+", label: "Ladder (-) Z (+)" },
      { value: "ladder-z-", label: "Ladder (-) Z (-)" }
    ];
  }
  return [
    { value: "left+z", label: "Left (+Z side)" },
    { value: "right+z", label: "Right (+Z side)" },
    { value: "left-z", label: "Left (-Z side)" },
    { value: "right-z", label: "Right (-Z side)" }
  ];
}

function optionLabel(options, value) {
  const item = options.find(function(candidate) { return candidate.value === value; });
  return item ? item.label : value;
}

function refresh() {
  chart.setOption(buildOption(), { notMerge: true, lazyUpdate: false });
}

function dropdown(id, x, label, options, selected, change) {
  const width = 210;
  const children = [
    text(0, 0, label, 11, "bold"),
    {
      type: "group",
      y: 14,
      cursor: "pointer",
      onclick: function() {
        runtime.open = runtime.open === id ? null : id;
        refresh();
      },
      children: [
        rect(0, 0, width, 32, "#252b36", "#8490a3", 1, 5),
        text(12, 16, optionLabel(options, selected), 12, "normal"),
        text(width - 14, 16, runtime.open === id ? "▲" : "▼", 10, "normal", "center")
      ]
    }
  ];
  if (runtime.open === id) {
    options.forEach(function(option, index) {
      children.push({
        type: "group",
        y: 48 + index * 30,
        cursor: "pointer",
        z: 1000,
        onclick: function() {
          change(option.value);
          runtime.open = null;
          refresh();
        },
        children: [
          rect(0, 0, width, 30, option.value === selected ? "#35658d" : "#202630", "#667386", 1, 0),
          text(12, 15, option.label, 12, option.value === selected ? "bold" : "normal")
        ]
      });
    });
  }
  return { type: "group", x: x, y: 18, z: 1000, children: children };
}

function moduleMeta(key) {
  const chips = valuesByHardware[key] || {};
  const first = Object.keys(chips)[0];
  if (first !== undefined) return chips[first];
  const parts = String(key || "").split("/");
  return { board: parts[0] || "", optical_group: parts[1] || "", hybrid: parts[2] || "" };
}

function barrelCard(view, width, height) {
  const children = [];
  const layer = cfg.barrelLayout[view.element];
  const ladderPositive = view.part.indexOf("ladder+") === 0;
  const zPositive = view.part.endsWith("z+");
  const ladderCount = layer.half_ladders;
  const moduleCount = zPositive ? layer.z_plus_modules : layer.z_minus_modules;
  const left = 58;
  const top = 58;
  const plotWidth = width - 86;
  const plotHeight = height - 105;
  const moduleWidth = plotWidth / moduleCount;
  const moduleHeight = plotHeight / ladderCount;
  const map = {};
  Object.entries(cfg.barrelGeometry).forEach(function(entry) {
    const key = entry[0];
    const item = entry[1];
    map[[item.layer, item.signed_ladder, item.z_side, item.module_index].join(":")] = key;
  });
  children.push(text(16, 24, "TBPX  Layer " + view.element + "  |  " + optionLabel(partOptionsFor("TBPX"), view.part), 15, "bold"));
  children.push(text(left + plotWidth / 2, height - 20, "Module position along Z", 12, "bold", "center"));
  children.push({ type: "text", rotation: -Math.PI / 2, x: 17, y: top + plotHeight / 2, silent: true, style: { text: "Signed ladder", fill: "#dfe4eb", font: "bold 12px sans-serif", textAlign: "center" } });
  for (let ladderIndex = 0; ladderIndex < ladderCount; ladderIndex++) {
    const signedLadder = ladderPositive ? ladderIndex + 1 : -(ladderIndex + 1);
    const drawRow = ladderPositive ? ladderCount - ladderIndex - 1 : ladderIndex;
    children.push(text(left - 10, top + (drawRow + 0.5) * moduleHeight, String(signedLadder), 10, "normal", "right"));
    for (let moduleIndex = 1; moduleIndex <= moduleCount; moduleIndex++) {
      const drawColumn = zPositive ? moduleIndex - 1 : moduleCount - moduleIndex;
      const x = left + drawColumn * moduleWidth;
      const y = top + drawRow * moduleHeight;
      const key = map[[view.element, signedLadder, zPositive ? "z+" : "z-", moduleIndex].join(":")];
      const chipRows = layer.module_type === "double" ? 1 : 2;
      const chipWidth = moduleWidth / 2;
      const chipHeight = moduleHeight / chipRows;
      const layout = layer.module_type === "double" ? cfg.doubleChipLayout : cfg.quadChipLayout;
      Object.keys(layout).forEach(function(chip) {
        const position = layout[chip];
        const chipData = (valuesByHardware[key] || {})[chip];
        children.push({
          type: "rect",
          cursor: chipData ? "pointer" : "default",
          shape: { x: x + position[0] * chipWidth, y: y + position[1] * chipHeight, width: chipWidth, height: chipHeight },
          style: {
            fill: colorFor(chipData && chipData.value),
            stroke: chipData ? "#111111" : "rgba(180,180,180,0.25)",
            lineWidth: 1
          },
          onclick: function() { if (chipData) openDetail(chipData, chip); }
        });
      });
      const meta = moduleMeta(key);
      children.push({
        type: "group",
        cursor: meta.board ? "pointer" : "default",
        onclick: function() { openDetail(meta, "All"); },
        children: [
          {
            type: "rect",
            shape: { x: x, y: y, width: moduleWidth, height: moduleHeight },
            style: { fill: null, stroke: "rgba(255,255,255,0.001)", lineWidth: 9 }
          },
          {
            type: "rect",
            silent: true,
            shape: { x: x, y: y, width: moduleWidth, height: moduleHeight },
            style: { fill: null, stroke: "rgba(190,190,190,0.55)", lineWidth: 1 }
          }
        ]
      });
    }
  }
  for (let moduleIndex = 1; moduleIndex <= moduleCount; moduleIndex++) {
    const drawColumn = zPositive ? moduleIndex - 1 : moduleCount - moduleIndex;
    children.push(text(left + (drawColumn + 0.5) * moduleWidth, top + plotHeight + 12, String(zPositive ? moduleIndex : -moduleIndex), 10, "normal", "center"));
  }
  return children;
}

function partOptionsFor(subdetector) {
  if (subdetector === "TBPX") return [
    { value: "ladder+z+", label: "Ladder (+) Z (+)" }, { value: "ladder+z-", label: "Ladder (+) Z (-)" },
    { value: "ladder-z+", label: "Ladder (-) Z (+)" }, { value: "ladder-z-", label: "Ladder (-) Z (-)" }
  ];
  return [
    { value: "left+z", label: "Left (+Z side)" }, { value: "right+z", label: "Right (+Z side)" },
    { value: "left-z", label: "Left (-Z side)" }, { value: "right-z", label: "Right (-Z side)" }
  ];
}

function ringCard(view, width, height) {
  const children = [];
  const layout = view.subdetector === "TFPX" ? cfg.forwardLayout : cfg.endcapLayout;
  const geometry = view.subdetector === "TFPX" ? cfg.forwardGeometry : cfg.endcapGeometry;
  const side = view.part.endsWith("+z") ? "+z" : "-z";
  const half = view.part.indexOf("right") === 0 ? "upper" : "lower";
  const cx = width / 2;
  const cy = height / 2 + 18;
  const maxRadius = Math.min(width * 0.38, height * 0.44);
  const physicalOuter = Math.max.apply(null, Object.values(layout.rings).map(function(ring) { return ring.outer_radius; }));
  const scale = maxRadius / physicalOuter;
  const map = {};
  Object.entries(geometry).forEach(function(entry) {
    const key = entry[0];
    const item = entry[1];
    map[[item.detector_side, item.disk, item.ring, item.half, item.module_index].join(":")] = key;
  });
  children.push(text(16, 24, view.subdetector + "  Disk " + view.element + "  |  " + optionLabel(partOptionsFor(view.subdetector), view.part), 15, "bold"));
  Object.keys(layout.rings).forEach(function(ringKey) {
    const ring = layout.rings[ringKey];
    const count = ring.modules_per_half;
    const surface = DISK_SURFACE_COLORS[ring.disk_surface];
    const halfStart = (half === "upper" ? Math.PI : 0) + DISK_ROTATION;
    children.push({
      type: "sector",
      silent: true,
      shape: {
        cx: cx,
        cy: cy,
        r0: ring.inner_radius * scale,
        r: ring.outer_radius * scale,
        startAngle: halfStart,
        endAngle: halfStart + Math.PI,
        clockwise: true
      },
      style: { fill: surface.fill, stroke: surface.line, lineWidth: 1 }
    });
    for (let moduleIndex = 0; moduleIndex < count; moduleIndex++) {
      const pitch = Math.PI / count;
      const centre = halfStart + (moduleIndex + 0.5) * pitch;
      const moduleWidth = pitch * MODULE_GAP_FACTOR;
      const start = centre - moduleWidth / 2;
      const end = centre + moduleWidth / 2;
      const key = map[[side, view.element, ringKey, half, moduleIndex].join(":")];
      const chipRows = ring.module_type === "double" ? 1 : 2;
      const chipLayout = ring.module_type === "double" ? cfg.doubleChipLayout : cfg.quadChipLayout;
      Object.keys(chipLayout).forEach(function(chip) {
        const position = chipLayout[chip];
        const chipStart = start + position[0] * (end - start) / 2;
        const chipEnd = chipStart + (end - start) / 2;
        const radialWidth = (ring.outer_radius - ring.inner_radius) / chipRows;
        const outer = ring.outer_radius - position[1] * radialWidth;
        const inner = outer - radialWidth;
        const chipData = (valuesByHardware[key] || {})[chip];
        children.push({
          type: "sector",
          cursor: chipData ? "pointer" : "default",
          shape: { cx: cx, cy: cy, r0: inner * scale, r: outer * scale, startAngle: chipStart, endAngle: chipEnd, clockwise: true },
          style: {
            fill: colorFor(chipData && chipData.value),
            stroke: chipData ? "#111111" : "rgba(190,190,190,0.25)",
            lineWidth: 1
          },
          onclick: function() { if (chipData) openDetail(chipData, chip); }
        });
      });
      const meta = moduleMeta(key);
      children.push({
        type: "group",
        cursor: meta.board ? "pointer" : "default",
        onclick: function() { openDetail(meta, "All"); },
        children: [
          {
            type: "sector",
            shape: { cx: cx, cy: cy, r0: ring.inner_radius * scale, r: ring.outer_radius * scale, startAngle: start, endAngle: end, clockwise: true },
            style: { fill: null, stroke: "rgba(255,255,255,0.001)", lineWidth: 9 }
          },
          {
            type: "sector",
            silent: true,
            shape: { cx: cx, cy: cy, r0: ring.inner_radius * scale, r: ring.outer_radius * scale, startAngle: start, endAngle: end, clockwise: true },
            style: { fill: null, stroke: "rgba(205,205,205,0.55)", lineWidth: 1 }
          }
        ]
      });
    }
  });
  children.push(text(cx, cy, side, 12, "bold", "center"));
  children.push(text(cx, height - 18, half === "upper" ? "Right half" : "Left half", 12, "bold", "center"));
  children.push(rect(width - 210, height - 31, 13, 10, DISK_SURFACE_COLORS.inner.fill, DISK_SURFACE_COLORS.inner.line, 1, 0));
  children.push(text(width - 191, height - 26, "Inner Disk", 10, "normal"));
  children.push(rect(width - 112, height - 31, 13, 10, DISK_SURFACE_COLORS.outer.fill, DISK_SURFACE_COLORS.outer.line, 1, 0));
  children.push(text(width - 93, height - 26, "Outer Disk", 10, "normal"));
  return children;
}

function card(view, x, y, width, height) {
  const body = view.subdetector === "TBPX" ? barrelCard(view, width, height) : ringCard(view, width, height);
  body.unshift(rect(0, 0, width, height, "#181c23", "#566273", 1, 8));
  body.push({
    type: "group",
    x: width - 82,
    y: 10,
    cursor: "pointer",
    onclick: function() {
      runtime.views = runtime.views.filter(function(candidate) { return candidate.id !== view.id; });
      refresh();
    },
    children: [rect(0, 0, 68, 26, "#34262a", "#b36b73", 1, 5), text(34, 13, "Delete", 11, "bold", "center")]
  });
  return { type: "group", x: x, y: y, children: body };
}

function buildOption() {
  const width = chart.getWidth();
  const controls = [];
  const subdetectors = [
    { value: "TBPX", label: "TBPX (Barrel)" },
    { value: "TEPX", label: "TEPX (Endcap)" },
    { value: "TFPX", label: "TFPX (Forward)" }
  ];
  controls.push(dropdown("subdetector", 18, "Subdetector", subdetectors, runtime.selection.subdetector, function(value) {
    runtime.selection.subdetector = value;
    runtime.selection.element = "1";
    runtime.selection.part = value === "TBPX" ? "ladder+z+" : "left+z";
  }));
  controls.push(dropdown("element", 246, runtime.selection.subdetector === "TBPX" ? "Layer" : "Disk", elementOptions(), runtime.selection.element, function(value) {
    runtime.selection.element = value;
  }));
  controls.push(dropdown("part", 474, runtime.selection.subdetector === "TBPX" ? "Quadrant" : "Disk half and side", partOptions(), runtime.selection.part, function(value) {
    runtime.selection.part = value;
  }));
  controls.push({
    type: "group", x: 702, y: 32, cursor: "pointer",
    onclick: function() {
      runtime.views.push({ id: runtime.nextId++, subdetector: runtime.selection.subdetector, element: runtime.selection.element, part: runtime.selection.part });
      runtime.open = null;
      refresh();
    },
    children: [rect(0, 0, 100, 32, "#245f46", "#7fc6a4", 1, 5), text(50, 16, "Add panel", 12, "bold", "center")]
  });
  const openOptionCount = runtime.open === "subdetector"
    ? subdetectors.length
    : runtime.open === "element"
      ? elementOptions().length
      : runtime.open === "part" ? partOptions().length : 0;
  const contentTop = runtime.open ? 90 + openOptionCount * 30 : 105;
  if (runtime.views.length === 0) controls.push(text(18, contentTop + 7, "Choose a detector part and select Add panel.", 14, "normal"));
  const singleRing = runtime.views.length === 1 && runtime.views[0].subdetector !== "TBPX";
  const columns = width >= 1450 && !singleRing ? 2 : 1;
  const gap = 16;
  const cardWidth = (width - 36 - gap * (columns - 1)) / columns;
  const hasRing = runtime.views.some(function(view) { return view.subdetector !== "TBPX"; });
  const cardHeight = hasRing ? 540 : 390;
  runtime.views.forEach(function(view, index) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    controls.push(card(view, 18 + column * (cardWidth + gap), contentTop + row * (cardHeight + gap), cardWidth, cardHeight));
  });
  return { backgroundColor: "transparent", animationDurationUpdate: 250, animationEasingUpdate: "cubicOut", graphic: controls };
}

return buildOption();
