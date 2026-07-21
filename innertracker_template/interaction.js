const DETECTOR_VIEW_MODES = Object.freeze({
  OVERVIEW: "overview",
  LAYER: "layer",
  DISK: "disk",
  HALF: "half",
  QUADRANT: "quadrant",
  LADDER: "ladder",
  MODULE: "module"
});

function detectorViewerRuntime(chart) {
  if (!chart.__cmsitDetectorViewer) {
    chart.__cmsitDetectorViewer = {
      view: {
        mode: DETECTOR_VIEW_MODES.OVERVIEW,
        selection: null
      },
      history: [],
      hoverKey: null,
      handlers: {}
    };
  }

  return chart.__cmsitDetectorViewer;
}

function detectorObjectKey(data) {
  if (!data || !data.objectType) {
    return null;
  }

  return [
    data.objectType,
    data.detectorSide,
    data.disk,
    data.ring,
    data.half,
    data.layer,
    data.signedLadder,
    data.zSide,
    data.moduleIndex,
    data.chip
  ].map(function(value) {
    return value === undefined ? "" : String(value);
  }).join(":");
}

function chipDetailsUrl(cfg, data) {
  return (
    "/d/" + cfg.detailsUid + "/" + cfg.detailsSlug + "?" +
    "var-board=" + encodeURIComponent(data.board) +
    "&var-optical_group=" + encodeURIComponent(data.optical_group) +
    "&var-hybrid=" + encodeURIComponent(data.hybrid) +
    "&var-chip=" + encodeURIComponent(data.chip) +
    "&var-return_url=" + encodeURIComponent(window.location.href) +
    "&from=now-15m&to=now"
  );
}

function moduleDetailsUrl(cfg, data) {
  return (
    "/d/" + cfg.detailsUid + "/" + cfg.detailsSlug + "?" +
    "var-board=" + encodeURIComponent(data.board) +
    "&var-optical_group=" + encodeURIComponent(data.optical_group) +
    "&var-hybrid=" + encodeURIComponent(data.hybrid) +
    "&var-chip=All" +
    "&var-return_url=" + encodeURIComponent(window.location.href) +
    "&from=now-15m&to=now"
  );
}

function hardwareMetadata(hardwareKey) {
  const parts = String(hardwareKey || "").split("/");
  return {
    hardwareKey: hardwareKey,
    board: parts[0] || "",
    optical_group: parts[1] || "",
    hybrid: parts[2] || ""
  };
}

function replaceChartHandler(chart, runtime, eventName, handler) {
  if (runtime.handlers[eventName]) {
    chart.off(eventName, runtime.handlers[eventName]);
  } else {
    chart.off(eventName);
  }

  runtime.handlers[eventName] = handler;
  chart.on(eventName, handler);
}

function installDetectorInteractions(chart, cfg, buildOption) {
  const runtime = detectorViewerRuntime(chart);
  const refresh = function() {
    chart.setOption(buildOption(refresh), {
      notMerge: false,
      replaceMerge: ["graphic", "grid", "xAxis", "yAxis", "series"],
      lazyUpdate: false
    });
  };

  replaceChartHandler(chart, runtime, "click", function(params) {
    const data = params.data;

    if (!data || !data.objectType) {
      return;
    }

    if (data.objectType === "chip") {
      window.location.href = chipDetailsUrl(cfg, data);
      return;
    }

    if (data.objectType === "module") {
      if (data.hardwareKey) {
        window.location.href = moduleDetailsUrl(cfg, data);
      }
      return;
    }

    navigateToDetectorObject(runtime, data);
    refresh();
  });

  replaceChartHandler(chart, runtime, "mouseover", function(params) {
    const key = detectorObjectKey(params.data);

    if (key && key !== runtime.hoverKey) {
      runtime.hoverKey = key;
      refresh();
    }
  });

  replaceChartHandler(chart, runtime, "mouseout", function() {
    if (runtime.hoverKey !== null) {
      runtime.hoverKey = null;
      refresh();
    }
  });

  return {
    runtime: runtime,
    refresh: refresh
  };
}

