const DETECTOR_MOTION = Object.freeze({
  duration: 250,
  easing: "cubicOut",
  scale: 1.025
});

function isDetectorHovered(runtime, data) {
  return runtime.hoverKey === detectorObjectKey(data);
}

function detectorHighlightStyle(baseStyle, hovered) {
  if (!hovered) {
    return baseStyle;
  }

  return {
    ...baseStyle,
    opacity: 1,
    lineWidth: Math.max(2.2, Number(baseStyle.lineWidth || 0) + 1.5),
    shadowBlur: 14,
    shadowColor: "rgba(110, 190, 255, 0.75)"
  };
}

function detectorTransition(element, hovered, originX, originY) {
  return {
    ...element,
    originX: originX,
    originY: originY,
    scaleX: hovered ? DETECTOR_MOTION.scale : 1,
    scaleY: hovered ? DETECTOR_MOTION.scale : 1,
    transition: ["shape", "style", "scaleX", "scaleY"],
    enterFrom: { opacity: 0 }
  };
}


