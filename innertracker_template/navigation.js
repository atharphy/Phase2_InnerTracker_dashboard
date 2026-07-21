function detectorSelection(data) {
  return {
    detectorSide: data.detectorSide,
    disk: data.disk,
    ring: data.ring,
    half: data.half,
    layer: data.layer,
    signedLadder: data.signedLadder,
    zSide: data.zSide,
    moduleIndex: data.moduleIndex,
    moduleType: data.moduleType,
    ladderSign: data.ladderSign,
    quadrant: data.quadrant
  };
}

function navigateToDetectorObject(runtime, data) {
  let mode = data.objectType;

  if (!Object.values(DETECTOR_VIEW_MODES).includes(mode)) {
    return;
  }

  runtime.history.push({
    mode: runtime.view.mode,
    selection: runtime.view.selection
      ? { ...runtime.view.selection }
      : null
  });
  runtime.view = {
    mode: mode,
    selection: detectorSelection(data)
  };
  runtime.hoverKey = null;
}

function detectorBack(runtime) {
  runtime.view = runtime.history.pop() || {
    mode: DETECTOR_VIEW_MODES.OVERVIEW,
    selection: null
  };
  runtime.hoverKey = null;
}

function detectorHome(runtime) {
  runtime.view = {
    mode: DETECTOR_VIEW_MODES.OVERVIEW,
    selection: null
  };
  runtime.history = [];
  runtime.hoverKey = null;
}

function detectorBreadcrumb(runtime, regionName) {
  const view = runtime.view;
  const selection = view.selection || {};
  const parts = [regionName, "Overview"];

  if (selection.disk !== undefined) {
    parts.push("Disk " + selection.disk);
  }
  if (
    selection.half !== undefined &&
    (view.mode === DETECTOR_VIEW_MODES.HALF ||
      view.mode === DETECTOR_VIEW_MODES.MODULE)
  ) {
    parts.push(selection.half === "upper" ? "Right Half" : "Left Half");
  }
  if (selection.layer !== undefined) {
    parts.push("Layer " + selection.layer);
  }
  if (view.mode === DETECTOR_VIEW_MODES.QUADRANT) {
    parts.push(selection.quadrant);
  }
  if (
    selection.signedLadder !== undefined &&
    (view.mode === DETECTOR_VIEW_MODES.LADDER ||
      view.mode === DETECTOR_VIEW_MODES.MODULE)
  ) {
    parts.push("Ladder " + selection.signedLadder);
  }
  if (view.mode === DETECTOR_VIEW_MODES.MODULE) {
    const side = selection.zSide ? selection.zSide + " " : "";
    parts.push(side + "Module " + selection.moduleIndex);
  }

  return parts.join("  ›  ");
}

function navigationGraphics(runtime, refresh, regionName) {
  const graphics = [
    {
      id: "detector-breadcrumb",
      type: "text",
      left: 18,
      top: 14,
      silent: true,
      style: {
        text: detectorBreadcrumb(runtime, regionName),
        fill: "#d8dce3",
        font: "12px sans-serif"
      }
    }
  ];

  if (runtime.view.mode === DETECTOR_VIEW_MODES.OVERVIEW) {
    return graphics;
  }

  function button(id, text, right, action) {
    return {
      id: id,
      type: "group",
      right: right,
      top: 12,
      cursor: "pointer",
      onclick: function() {
        action(runtime);
        refresh();
      },
      children: [
        {
          type: "rect",
          shape: { x: 0, y: 0, width: 64, height: 26, r: 5 },
          style: {
            fill: "rgba(45, 52, 64, 0.94)",
            stroke: "rgba(180, 195, 220, 0.75)",
            lineWidth: 1
          }
        },
        {
          type: "text",
          style: {
            x: 32,
            y: 13,
            text: text,
            fill: "#f1f3f6",
            font: "bold 11px sans-serif",
            textAlign: "center",
            textVerticalAlign: "middle"
          }
        }
      ]
    };
  }

  graphics.push(button("detector-back", "Back", 84, detectorBack));
  graphics.push(button("detector-home", "Home", 14, detectorHome));
  return graphics;
}

function detectorSelectionGraphics(
  id,
  items,
  activeValue,
  select,
  top
) {
  const buttonWidth = 42;
  const gap = 5;
  const children = [];

  items.forEach(function(item, index) {
    const active = item.value === activeValue;
    const x = index * (buttonWidth + gap);
    children.push({
      type: "group",
      x: x,
      cursor: "pointer",
      onclick: function() {
        select(item.value);
      },
      children: [
        {
          type: "rect",
          shape: { x: 0, y: 0, width: buttonWidth, height: 25, r: 4 },
          style: {
            fill: active ? "rgba(65,115,160,0.96)" : "rgba(45,52,64,0.92)",
            stroke: active ? "#c9e7ff" : "rgba(180,195,220,0.72)",
            lineWidth: active ? 1.8 : 1
          }
        },
        {
          type: "text",
          silent: true,
          style: {
            x: buttonWidth / 2,
            y: 12.5,
            text: item.text,
            fill: "#f1f3f6",
            font: "bold 11px sans-serif",
            textAlign: "center",
            textVerticalAlign: "middle"
          }
        }
      ]
    });
  });

  return {
    id: id,
    type: "group",
    left: "center",
    top: top,
    z: 1100,
    children: children
  };
}

