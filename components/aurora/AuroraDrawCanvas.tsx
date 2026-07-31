"use client";

import {
  forwardRef,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export type DrawTool = "pencil" | "marker" | "neon" | "eraser";

export type AuroraDrawCanvasHandle = {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  getDataUrl: () => string | null;
};

type AuroraDrawCanvasProps = {
  active: boolean;
  tool: DrawTool;
  color: string;
  size: number;
  onChange: (dataUrl: string | null) => void;
};

type Point = {
  x: number;
  y: number;
};

const MAX_HISTORY = 30;

const AuroraDrawCanvas = forwardRef<
  AuroraDrawCanvasHandle,
  AuroraDrawCanvasProps
>(function AuroraDrawCanvas(
  { active, tool, color, size, onChange },
  forwardedRef
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const initializedRef = useRef(false);

  function getCanvas() {
    return canvasRef.current;
  }

  function getContext() {
    return getCanvas()?.getContext("2d") || null;
  }

  function isCanvasEmpty() {
    const canvas = getCanvas();
    const context = getContext();
    if (!canvas || !context) return true;

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] !== 0) return false;
    }
    return true;
  }

  function emitChange() {
    const canvas = getCanvas();
    if (!canvas || isCanvasEmpty()) {
      onChange(null);
      return;
    }
    onChange(canvas.toDataURL("image/png"));
  }

  function saveSnapshot() {
    const canvas = getCanvas();
    if (!canvas) return;

    const snapshot = canvas.toDataURL("image/png");
    const stack = undoStackRef.current;

    if (stack[stack.length - 1] !== snapshot) {
      stack.push(snapshot);
      if (stack.length > MAX_HISTORY) stack.shift();
    }

    redoStackRef.current = [];
  }

  function restoreSnapshot(snapshot: string | null) {
    const canvas = getCanvas();
    const context = getContext();
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!snapshot) {
      emitChange();
      return;
    }

    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      emitChange();
    };
    image.src = snapshot;
  }

  function clear() {
    const canvas = getCanvas();
    const context = getContext();
    if (!canvas || !context) return;

    saveSnapshot();
    context.clearRect(0, 0, canvas.width, canvas.height);
    emitChange();
  }

  function undo() {
    const canvas = getCanvas();
    if (!canvas) return;

    const stack = undoStackRef.current;
    if (stack.length <= 1) return;

    const current = stack.pop();
    if (current) redoStackRef.current.push(current);

    restoreSnapshot(stack[stack.length - 1] || null);
  }

  function redo() {
    const canvas = getCanvas();
    if (!canvas) return;

    const next = redoStackRef.current.pop();
    if (!next) return;

    undoStackRef.current.push(next);
    restoreSnapshot(next);
  }

  useImperativeHandle(
    forwardedRef,
    () => ({
      undo,
      redo,
      clear,
      getDataUrl: () => {
        const canvas = getCanvas();
        if (!canvas || isCanvasEmpty()) return null;
        return canvas.toDataURL("image/png");
      },
    }),
    []
  );

  useEffect(() => {
    const canvas = getCanvas();
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    function resizeCanvas() {
      const rect = parent.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const oldSnapshot =
        initializedRef.current && !isCanvasEmpty()
          ? canvas.toDataURL("image/png")
          : null;

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const context = canvas.getContext("2d");
      if (context) {
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.lineCap = "round";
        context.lineJoin = "round";
      }

      initializedRef.current = true;

      if (oldSnapshot) {
        const image = new Image();
        image.onload = () => {
          const nextContext = canvas.getContext("2d");
          if (!nextContext) return;
          nextContext.save();
          nextContext.setTransform(1, 0, 0, 1, 0, 0);
          nextContext.drawImage(image, 0, 0, canvas.width, canvas.height);
          nextContext.restore();
          emitChange();
        };
        image.src = oldSnapshot;
      } else if (undoStackRef.current.length === 0) {
        undoStackRef.current = [canvas.toDataURL("image/png")];
      }
    }

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(parent);

    return () => observer.disconnect();
  }, []);

  function getPoint(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function configureBrush(context: CanvasRenderingContext2D) {
    context.globalAlpha = 1;
    context.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = color;
    context.lineWidth =
      tool === "marker" ? size * 2.2 : tool === "eraser" ? size * 2.4 : size;
    context.shadowBlur = 0;
    context.shadowColor = "transparent";

    if (tool === "marker") {
      context.globalAlpha = 0.35;
    } else if (tool === "neon") {
      context.shadowColor = color;
      context.shadowBlur = Math.max(10, size * 2.2);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPoint(event);

    const context = getContext();
    const point = lastPointRef.current;
    if (!context || !point) return;

    context.save();
    configureBrush(context);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.01, point.y + 0.01);
    context.stroke();
    context.restore();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || !drawingRef.current || !lastPointRef.current) return;

    event.preventDefault();
    const context = getContext();
    if (!context) return;

    const nextPoint = getPoint(event);

    context.save();
    configureBrush(context);
    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(nextPoint.x, nextPoint.y);
    context.stroke();
    context.restore();

    lastPointRef.current = nextPoint;
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    drawingRef.current = false;
    lastPointRef.current = null;
    saveSnapshot();
    emitChange();
  }

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 z-[2] touch-none ${
        active ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
      }`}
      aria-label="Suprafață de desen pentru poveste"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
      onPointerLeave={(event) => {
        if (drawingRef.current && event.buttons === 0) finishStroke(event);
      }}
    />
  );
});

export default AuroraDrawCanvas;
