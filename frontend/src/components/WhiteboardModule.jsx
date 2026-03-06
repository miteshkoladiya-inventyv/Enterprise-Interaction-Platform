import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { BACKEND_URL } from "@/config";
import { useAuthContext } from "../context/AuthContextProvider";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import {
  Plus,
  ArrowLeft,
  Copy,
  Users,
  Trash2,
  PenLine,
  Clock,
  Share2,
  Search,
  LogIn,
  Archive,
  Globe,
  Lock,
  User,
  MousePointer2,
  Minus,
  Square,
  Circle,
  Type,
  Eraser,
  Undo2,
  Redo2,
  Download,
  ZoomIn,
  ZoomOut,
  Palette,
  Pen,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   CUSTOM DRAWING CANVAS ENGINE
   ═══════════════════════════════════════════════════════════════ */

const TOOLS = {
  SELECT: "select",
  PEN: "pen",
  LINE: "line",
  RECT: "rect",
  ELLIPSE: "ellipse",
  TEXT: "text",
  ERASER: "eraser",
};

const DEFAULT_COLORS = [
  "#ffffff", "#e2e8f0", "#94a3b8", "#64748b",
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4",
];

let nextId = 1;
function genId() {
  return `el_${Date.now()}_${nextId++}`;
}

// ─── Hit-testing helpers ────────────────────────────────────────
function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function pointNearLine(px, py, x1, y1, x2, y2, threshold = 6) {
  const len = dist(x1, y1, x2, y2);
  if (len === 0) return dist(px, py, x1, y1) < threshold;
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / (len * len);
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return dist(px, py, projX, projY) < threshold;
}

function pointInRect(px, py, el) {
  const x = Math.min(el.x, el.x + el.w);
  const y = Math.min(el.y, el.y + el.h);
  const w = Math.abs(el.w);
  const h = Math.abs(el.h);
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

function pointNearEllipse(px, py, el, threshold = 6) {
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const rx = Math.abs(el.w) / 2;
  const ry = Math.abs(el.h) / 2;
  if (rx === 0 || ry === 0) return false;
  const val = ((px - cx) ** 2) / (rx * rx) + ((py - cy) ** 2) / (ry * ry);
  return val <= (1 + threshold / Math.max(rx, ry)) ** 2;
}

function hitTest(px, py, el) {
  switch (el.tool) {
    case TOOLS.PEN: {
      for (let i = 1; i < el.points.length; i++) {
        if (pointNearLine(px, py, el.points[i - 1][0], el.points[i - 1][1], el.points[i][0], el.points[i][1], el.strokeWidth + 4))
          return true;
      }
      return false;
    }
    case TOOLS.LINE:
      return pointNearLine(px, py, el.x, el.y, el.x + el.w, el.y + el.h, el.strokeWidth + 4);
    case TOOLS.RECT:
      return pointInRect(px, py, el);
    case TOOLS.ELLIPSE:
      return pointNearEllipse(px, py, el);
    case TOOLS.TEXT:
      return pointInRect(px, py, { ...el, w: el.w || 200, h: el.h || 30 });
    default:
      return false;
  }
}

// ─── Render one element to canvas ───────────────────────────────
function drawElement(ctx, el) {
  ctx.save();
  ctx.strokeStyle = el.color || "#ffffff";
  ctx.fillStyle = el.color || "#ffffff";
  ctx.lineWidth = el.strokeWidth || 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = el.opacity ?? 1;

  switch (el.tool) {
    case TOOLS.PEN: {
      if (!el.points || el.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(el.points[0][0], el.points[0][1]);
      for (let i = 1; i < el.points.length; i++) {
        ctx.lineTo(el.points[i][0], el.points[i][1]);
      }
      ctx.stroke();
      break;
    }
    case TOOLS.LINE: {
      ctx.beginPath();
      ctx.moveTo(el.x, el.y);
      ctx.lineTo(el.x + el.w, el.y + el.h);
      ctx.stroke();
      break;
    }
    case TOOLS.RECT: {
      ctx.strokeRect(el.x, el.y, el.w, el.h);
      if (el.fill) {
        ctx.globalAlpha = 0.1;
        ctx.fillRect(el.x, el.y, el.w, el.h);
      }
      break;
    }
    case TOOLS.ELLIPSE: {
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      const rx = Math.abs(el.w) / 2;
      const ry = Math.abs(el.h) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (el.fill) {
        ctx.globalAlpha = 0.1;
        ctx.fill();
      }
      break;
    }
    case TOOLS.TEXT: {
      ctx.font = `${el.fontSize || 16}px Inter, system-ui, sans-serif`;
      ctx.fillText(el.text || "", el.x, el.y + (el.fontSize || 16));
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   DRAWING CANVAS COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function DrawingCanvas({
  elements,
  onElementsChange,
  remoteCursors,
  canvasState,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tool, setTool] = useState(TOOLS.PEN);
  const [color, setColor] = useState("#ffffff");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Viewport / camera
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  // Drawing state refs (avoid re-renders during draw)
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const currentElement = useRef(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  // Undo / redo stacks
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Selection
  const [selectedId, setSelectedId] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Text input
  const [textInput, setTextInput] = useState(null);
  const textInputRef = useRef(null);

  // Space-bar panning
  const spaceDown = useRef(false);

  // ─── Screen ↔ World coords ──────────────────────────────────
  const screenToWorld = useCallback(
    (sx, sy) => {
      const c = cameraRef.current;
      return [(sx - c.x) / c.zoom, (sy - c.y) / c.zoom];
    },
    []
  );

  // ─── Render loop ────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const c = cameraRef.current;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = canvasState?.backgroundColor || "#121218";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.zoom, c.zoom);

    // Grid
    const gridSize = 40;
    const startX = Math.floor(-c.x / c.zoom / gridSize) * gridSize;
    const startY = Math.floor(-c.y / c.zoom / gridSize) * gridSize;
    const endX = startX + width / c.zoom + gridSize * 2;
    const endY = startY + height / c.zoom + gridSize * 2;

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1 / c.zoom;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Draw all elements
    const els = elementsRef.current;
    for (let i = 0; i < els.length; i++) {
      drawElement(ctx, els[i]);
    }

    // Draw element being created
    if (currentElement.current) {
      drawElement(ctx, currentElement.current);
    }

    // Selection highlight
    if (selectedId) {
      const sel = els.find((e) => e.id === selectedId);
      if (sel) {
        ctx.save();
        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = 2 / c.zoom;
        ctx.setLineDash([6 / c.zoom, 4 / c.zoom]);
        if (sel.tool === TOOLS.PEN && sel.points) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          sel.points.forEach(([px, py]) => { minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); });
          ctx.strokeRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
        } else {
          ctx.strokeRect((sel.x || 0) - 4, (sel.y || 0) - 4, (sel.w || 200) + 8, (sel.h || 30) + 8);
        }
        ctx.restore();
      }
    }

    // Remote cursors
    if (remoteCursors) {
      Object.entries(remoteCursors).forEach(([uid, cur]) => {
        if (!cur) return;
        ctx.save();
        ctx.fillStyle = cur.color || "#6366f1";
        ctx.beginPath();
        ctx.moveTo(cur.x, cur.y);
        ctx.lineTo(cur.x, cur.y + 18);
        ctx.lineTo(cur.x + 12, cur.y + 12);
        ctx.closePath();
        ctx.fill();
        ctx.font = `${11 / c.zoom}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = "rgba(99,102,241,0.9)";
        const labelW = ctx.measureText(cur.name || "?").width + 8;
        ctx.fillRect(cur.x + 14, cur.y + 10, labelW, 16 / c.zoom);
        ctx.fillStyle = "#fff";
        ctx.fillText(cur.name || "?", cur.x + 18, cur.y + 10 + 12 / c.zoom);
        ctx.restore();
      });
    }

    ctx.restore();
  }, [canvasState, selectedId, remoteCursors]);

  // Resize canvas to container
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      render();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [render]);

  // Re-render when elements change
  useEffect(() => {
    render();
  }, [elements, render, remoteCursors, selectedId]);

  // ─── Push undo snapshot ─────────────────────────────────────
  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-50), JSON.parse(JSON.stringify(elementsRef.current))]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const snapshot = newStack.pop();
      setRedoStack((r) => [...r, JSON.parse(JSON.stringify(elementsRef.current))]);
      onElementsChange(snapshot);
      return newStack;
    });
  }, [onElementsChange]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const snapshot = newStack.pop();
      setUndoStack((u) => [...u, JSON.parse(JSON.stringify(elementsRef.current))]);
      onElementsChange(snapshot);
      return newStack;
    });
  }, [onElementsChange]);

  // ─── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (textInput) return; // Don't intercept when typing text
      if (e.code === "Space") { spaceDown.current = true; e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); handleRedo(); }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId && !textInput) {
          e.preventDefault();
          pushUndo();
          onElementsChange(elementsRef.current.filter((el) => el.id !== selectedId));
          setSelectedId(null);
        }
      }
      // Tool shortcuts
      if (e.key === "v" || e.key === "1") setTool(TOOLS.SELECT);
      if (e.key === "p" || e.key === "2") setTool(TOOLS.PEN);
      if (e.key === "l" || e.key === "3") setTool(TOOLS.LINE);
      if (e.key === "r" || e.key === "4") setTool(TOOLS.RECT);
      if (e.key === "o" || e.key === "5") setTool(TOOLS.ELLIPSE);
      if (e.key === "t" || e.key === "6") setTool(TOOLS.TEXT);
      if (e.key === "e" || e.key === "7") setTool(TOOLS.ERASER);
    };
    const handleKeyUp = (e) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); };
  }, [handleUndo, handleRedo, selectedId, textInput, pushUndo, onElementsChange]);

  // ─── Mouse handlers ────────────────────────────────────────
  const getMousePos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }, []);

  const handleMouseDown = useCallback(
    (e) => {
      const [sx, sy] = getMousePos(e);
      const [wx, wy] = screenToWorld(sx, sy);

      // Middle-mouse or space+left: pan
      if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
        isPanning.current = true;
        panStart.current = { x: sx - cameraRef.current.x, y: sy - cameraRef.current.y };
        e.preventDefault();
        return;
      }

      if (e.button !== 0) return;

      if (tool === TOOLS.SELECT) {
        // Check hit on elements in reverse order (top-most first)
        const els = elementsRef.current;
        let found = null;
        for (let i = els.length - 1; i >= 0; i--) {
          if (hitTest(wx, wy, els[i])) { found = els[i]; break; }
        }
        if (found) {
          setSelectedId(found.id);
          dragOffset.current = { x: wx - (found.x || found.points?.[0]?.[0] || 0), y: wy - (found.y || found.points?.[0]?.[1] || 0) };
          isDrawing.current = true;
        } else {
          setSelectedId(null);
        }
        return;
      }

      if (tool === TOOLS.TEXT) {
        setTextInput({ x: wx, y: wy });
        return;
      }

      if (tool === TOOLS.ERASER) {
        const els = elementsRef.current;
        for (let i = els.length - 1; i >= 0; i--) {
          if (hitTest(wx, wy, els[i])) {
            pushUndo();
            onElementsChange(els.filter((_, idx) => idx !== i));
            return;
          }
        }
        return;
      }

      pushUndo();
      isDrawing.current = true;

      if (tool === TOOLS.PEN) {
        currentElement.current = {
          id: genId(), tool: TOOLS.PEN, points: [[wx, wy]], color, strokeWidth, opacity: 1,
        };
      } else if (tool === TOOLS.LINE) {
        currentElement.current = {
          id: genId(), tool: TOOLS.LINE, x: wx, y: wy, w: 0, h: 0, color, strokeWidth, opacity: 1,
        };
      } else if (tool === TOOLS.RECT) {
        currentElement.current = {
          id: genId(), tool: TOOLS.RECT, x: wx, y: wy, w: 0, h: 0, color, strokeWidth, fill: true, opacity: 1,
        };
      } else if (tool === TOOLS.ELLIPSE) {
        currentElement.current = {
          id: genId(), tool: TOOLS.ELLIPSE, x: wx, y: wy, w: 0, h: 0, color, strokeWidth, fill: true, opacity: 1,
        };
      }
    },
    [tool, color, strokeWidth, screenToWorld, getMousePos, pushUndo, onElementsChange]
  );

  const handleMouseMove = useCallback(
    (e) => {
      const [sx, sy] = getMousePos(e);
      const [wx, wy] = screenToWorld(sx, sy);

      // Panning
      if (isPanning.current) {
        setCamera({ ...cameraRef.current, x: sx - panStart.current.x, y: sy - panStart.current.y });
        return;
      }

      if (!isDrawing.current) {
        // Eraser hover: check for hits
        if (tool === TOOLS.ERASER) {
          const canvas = canvasRef.current;
          if (canvas) canvas.style.cursor = "crosshair";
        }
        return;
      }

      // Select tool: drag selected element
      if (tool === TOOLS.SELECT && selectedId) {
        const newX = wx - dragOffset.current.x;
        const newY = wy - dragOffset.current.y;
        const updated = elementsRef.current.map((el) => {
          if (el.id !== selectedId) return el;
          if (el.tool === TOOLS.PEN) {
            const dx = newX - (el.points[0]?.[0] || 0);
            const dy = newY - (el.points[0]?.[1] || 0);
            return { ...el, points: el.points.map(([px, py]) => [px + dx, py + dy]) };
          }
          return { ...el, x: newX, y: newY };
        });
        onElementsChange(updated);
        return;
      }

      const cur = currentElement.current;
      if (!cur) return;

      if (cur.tool === TOOLS.PEN) {
        cur.points.push([wx, wy]);
      } else {
        cur.w = wx - cur.x;
        cur.h = wy - cur.y;
      }
      render();
    },
    [tool, screenToWorld, getMousePos, render, selectedId, onElementsChange]
  );

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;

    if (tool === TOOLS.SELECT && isDrawing.current && selectedId) {
      isDrawing.current = false;
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (currentElement.current) {
      const newEl = { ...currentElement.current };
      currentElement.current = null;
      // Don't add tiny accidental elements
      if (newEl.tool === TOOLS.PEN && newEl.points.length < 2) return;
      if ((newEl.tool === TOOLS.LINE || newEl.tool === TOOLS.RECT || newEl.tool === TOOLS.ELLIPSE) && Math.abs(newEl.w || 0) < 2 && Math.abs(newEl.h || 0) < 2) return;
      onElementsChange([...elementsRef.current, newEl]);
    }
  }, [tool, selectedId, onElementsChange]);

  // ─── Mouse wheel: zoom ────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const c = cameraRef.current;
    const [sx, sy] = getMousePos(e);
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(5, Math.max(0.1, c.zoom * factor));
    const wx = (sx - c.x) / c.zoom;
    const wy = (sy - c.y) / c.zoom;
    setCamera({
      zoom: newZoom,
      x: sx - wx * newZoom,
      y: sy - wy * newZoom,
    });
  }, [getMousePos]);

  // ─── Commit text ──────────────────────────────────────────
  const commitText = useCallback(
    (text) => {
      if (text && text.trim()) {
        pushUndo();
        const newEl = {
          id: genId(),
          tool: TOOLS.TEXT,
          x: textInput.x,
          y: textInput.y,
          w: text.length * 10,
          h: 24,
          text: text.trim(),
          color,
          fontSize: 16,
          opacity: 1,
        };
        onElementsChange([...elementsRef.current, newEl]);
      }
      setTextInput(null);
    },
    [textInput, color, pushUndo, onElementsChange]
  );

  // Focus text input when it appears
  useEffect(() => {
    if (textInput && textInputRef.current) textInputRef.current.focus();
  }, [textInput]);

  // Export as PNG
  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "whiteboard.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  // ─── Cursor style ─────────────────────────────────────────
  const cursorStyle = useMemo(() => {
    if (spaceDown.current) return "grab";
    switch (tool) {
      case TOOLS.SELECT: return "default";
      case TOOLS.PEN: return "crosshair";
      case TOOLS.LINE: return "crosshair";
      case TOOLS.RECT: return "crosshair";
      case TOOLS.ELLIPSE: return "crosshair";
      case TOOLS.TEXT: return "text";
      case TOOLS.ERASER: return "crosshair";
      default: return "default";
    }
  }, [tool]);

  const toolButtons = [
    { id: TOOLS.SELECT, icon: MousePointer2, label: "Select (V)", shortcut: "V" },
    { id: TOOLS.PEN, icon: Pen, label: "Pen (P)", shortcut: "P" },
    { id: TOOLS.LINE, icon: Minus, label: "Line (L)", shortcut: "L" },
    { id: TOOLS.RECT, icon: Square, label: "Rectangle (R)", shortcut: "R" },
    { id: TOOLS.ELLIPSE, icon: Circle, label: "Ellipse (O)", shortcut: "O" },
    { id: TOOLS.TEXT, icon: Type, label: "Text (T)", shortcut: "T" },
    { id: TOOLS.ERASER, icon: Eraser, label: "Eraser (E)", shortcut: "E" },
  ];

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 bg-[#121218] overflow-hidden">
      {/* ─── Toolbar ──────────────────────────────────────── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-zinc-900/95 backdrop-blur border border-zinc-700/60 rounded-xl px-2 py-1.5 shadow-2xl">
        {toolButtons.map((tb) => (
          <button
            key={tb.id}
            onClick={() => { setTool(tb.id); setSelectedId(null); }}
            title={tb.label}
            className={cn(
              "p-2 rounded-lg transition-all",
              tool === tb.id
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            )}
          >
            <tb.icon className="h-4 w-4" />
          </button>
        ))}
        <div className="w-px h-6 bg-zinc-700 mx-1" />

        {/* Color */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all"
            title="Color"
          >
            <div className="h-4 w-4 rounded-full border-2 border-zinc-500" style={{ backgroundColor: color }} />
          </button>
          {showColorPicker && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-2xl z-30 min-w-[180px]">
              <div className="grid grid-cols-6 gap-1.5">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setColor(c); setShowColorPicker(false); }}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                      color === c ? "border-indigo-400 scale-110" : "border-zinc-600"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-7 w-7 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-[10px] text-zinc-500 font-mono">{color}</span>
              </div>
            </div>
          )}
        </div>

        {/* Stroke width */}
        <div className="flex items-center gap-1 px-2">
          <input
            type="range"
            min={1}
            max={20}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-16 h-1 accent-indigo-500"
            title={`Stroke: ${strokeWidth}px`}
          />
          <span className="text-[10px] text-zinc-500 w-4 text-right">{strokeWidth}</span>
        </div>

        <div className="w-px h-6 bg-zinc-700 mx-1" />

        {/* Undo/Redo */}
        <button onClick={handleUndo} title="Undo (Ctrl+Z)" className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all disabled:opacity-30" disabled={undoStack.length === 0}>
          <Undo2 className="h-4 w-4" />
        </button>
        <button onClick={handleRedo} title="Redo (Ctrl+Y)" className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all disabled:opacity-30" disabled={redoStack.length === 0}>
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-zinc-700 mx-1" />

        {/* Zoom controls */}
        <button onClick={() => setCamera((c) => ({ ...c, zoom: Math.min(5, c.zoom * 1.2) }))} title="Zoom In" className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white">
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="text-[10px] text-zinc-500 w-8 text-center">{Math.round(camera.zoom * 100)}%</span>
        <button onClick={() => setCamera((c) => ({ ...c, zoom: Math.max(0.1, c.zoom / 1.2) }))} title="Zoom Out" className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white">
          <ZoomOut className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-zinc-700 mx-1" />
        <button onClick={handleExport} title="Export PNG" className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white">
          <Download className="h-4 w-4" />
        </button>
      </div>

      {/* Text input overlay */}
      {textInput && (
        <input
          ref={textInputRef}
          type="text"
          className="absolute z-30 bg-transparent border border-indigo-500 text-white outline-none px-1 text-sm"
          style={{
            left: textInput.x * cameraRef.current.zoom + cameraRef.current.x,
            top: textInput.y * cameraRef.current.zoom + cameraRef.current.y,
            fontSize: 16 * cameraRef.current.zoom,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitText(e.target.value);
            if (e.key === "Escape") setTextInput(null);
          }}
          onBlur={(e) => commitText(e.target.value)}
          placeholder="Type here..."
        />
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WHITEBOARD MODULE (LIST + EDITOR + SOCKET)
   ═══════════════════════════════════════════════════════════════ */

export default function WhiteboardModule({ isVisible = true }) {
  const { user, socket } = useAuthContext();
  const token = localStorage.getItem("token");

  const [view, setView] = useState("list");
  const [whiteboards, setWhiteboards] = useState([]);
  const [activeWhiteboard, setActiveWhiteboard] = useState(null);
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [liveCollaborators, setLiveCollaborators] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [remoteCursors, setRemoteCursors] = useState({});

  const saveTimerRef = useRef(null);
  const isRemoteRef = useRef(false);

  const api = useMemo(
    () =>
      axios.create({
        baseURL: `${BACKEND_URL}/whiteboards`,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  // ─── Fetch list ──────────────────────────────────────────
  const fetchWhiteboards = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await api.get("/");
      setWhiteboards(data);
    } catch (err) {
      console.error("Failed to load whiteboards:", err);
    } finally {
      setLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    if (isVisible && view === "list") fetchWhiteboards();
  }, [isVisible, view, fetchWhiteboards]);

  // ─── Create ─────────────────────────────────────────────
  const handleCreate = async () => {
    try {
      const { data } = await api.post("/", { title: newTitle || "Untitled Whiteboard", is_public: newIsPublic });
      setShowCreateModal(false);
      setNewTitle("");
      setNewIsPublic(true);
      toast.success("Whiteboard created!");
      openWhiteboard(data);
    } catch (err) {
      toast.error("Failed to create whiteboard");
    }
  };

  // ─── Join by code ──────────────────────────────────────
  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;
    try {
      const { data } = await api.get(`/join/${joinCode.trim()}`);
      setShowJoinInput(false);
      setJoinCode("");
      toast.success(`Joined: ${data.title}`);
      openWhiteboard(data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to join");
    }
  };

  // ─── Open whiteboard ──────────────────────────────────
  const openWhiteboard = useCallback(
    async (wb) => {
      try {
        const { data } = await api.get(`/${wb._id}`);
        setActiveWhiteboard(data);
        setElements(data.elements || []);
        setView("editor");
        if (socket) {
          socket.emit("whiteboard-join", { whiteboardId: data._id, userName: user?.name || "Unknown" });
        }
      } catch (err) {
        toast.error("Failed to open whiteboard");
      }
    },
    [api, socket, user]
  );

  // ─── Leave editor ─────────────────────────────────────
  const leaveEditor = useCallback(() => {
    if (activeWhiteboard && socket) {
      socket.emit("whiteboard-leave", { whiteboardId: activeWhiteboard._id });
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setActiveWhiteboard(null);
    setElements([]);
    setLiveCollaborators([]);
    setRemoteCursors({});
    setView("list");
  }, [activeWhiteboard, socket]);

  // ─── Save to DB (debounced) ───────────────────────────
  const saveContent = useCallback(
    async (els) => {
      if (!activeWhiteboard) return;
      try {
        await api.put(`/${activeWhiteboard._id}/content`, { elements: els });
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    },
    [activeWhiteboard, api]
  );

  // ─── Handle element changes (from canvas) ─────────────
  const handleElementsChange = useCallback(
    (newElements) => {
      setElements(newElements);

      if (isRemoteRef.current) {
        isRemoteRef.current = false;
        return;
      }

      // Broadcast to other collaborators
      if (socket && activeWhiteboard) {
        socket.emit("whiteboard-update", { whiteboardId: activeWhiteboard._id, elements: newElements });
      }

      // Debounced save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveContent(newElements), 2000);
    },
    [socket, activeWhiteboard, saveContent]
  );

  // ─── Socket listeners ─────────────────────────────────
  useEffect(() => {
    if (!socket || !activeWhiteboard) return;

    const handleRemoteUpdate = ({ whiteboardId, elements: remoteEls, senderId }) => {
      if (whiteboardId !== activeWhiteboard._id) return;
      if (senderId === user?._id) return;
      isRemoteRef.current = true;
      setElements(remoteEls);
    };

    const handleCollaborators = ({ whiteboardId, collaborators }) => {
      if (whiteboardId !== activeWhiteboard._id) return;
      setLiveCollaborators(collaborators.filter((c) => c.userId !== user?._id));
    };

    const handleCursor = ({ whiteboardId, userId, userName, cursor }) => {
      if (whiteboardId !== activeWhiteboard._id) return;
      if (userId === user?._id) return;
      setRemoteCursors((prev) => ({ ...prev, [userId]: { ...cursor, name: userName, color: `hsl(${(userId?.charCodeAt(0) || 0) * 40 % 360}, 70%, 60%)` } }));
    };

    socket.on("whiteboard-update", handleRemoteUpdate);
    socket.on("whiteboard-collaborators", handleCollaborators);
    socket.on("whiteboard-cursor", handleCursor);

    return () => {
      socket.off("whiteboard-update", handleRemoteUpdate);
      socket.off("whiteboard-collaborators", handleCollaborators);
      socket.off("whiteboard-cursor", handleCursor);
    };
  }, [socket, activeWhiteboard, user]);

  // ─── Send cursor position ─────────────────────────────
  useEffect(() => {
    if (!socket || !activeWhiteboard) return;
    const handleMouse = (e) => {
      socket.emit("whiteboard-cursor", {
        whiteboardId: activeWhiteboard._id,
        cursor: { x: e.clientX, y: e.clientY },
        userName: user?.name || "Unknown",
      });
    };
    // Throttle to ~20fps
    let last = 0;
    const throttled = (e) => {
      const now = Date.now();
      if (now - last < 50) return;
      last = now;
      handleMouse(e);
    };
    window.addEventListener("mousemove", throttled);
    return () => window.removeEventListener("mousemove", throttled);
  }, [socket, activeWhiteboard, user]);

  // ─── Helpers ──────────────────────────────────────────
  const handleArchive = async (id, e) => {
    e?.stopPropagation();
    try {
      await api.patch(`/${id}/archive`);
      toast.success("Whiteboard archived");
      fetchWhiteboards();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to archive");
    }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    if (!confirm("Delete this whiteboard permanently?")) return;
    try {
      await api.delete(`/${id}`);
      toast.success("Whiteboard deleted");
      fetchWhiteboards();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete");
    }
  };

  const copyCode = (code, e) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(code);
    toast.success("Session code copied!");
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return whiteboards;
    const q = searchQuery.toLowerCase();
    return whiteboards.filter(
      (wb) => wb.title.toLowerCase().includes(q) || wb.session_code.toLowerCase().includes(q)
    );
  }, [whiteboards, searchQuery]);

  const timeAgo = (date) => {
    if (!date) return "";
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // ════════════════════════════════════════════════════════
  // ─── RENDER ────────────────────────────────────────────
  // ════════════════════════════════════════════════════════

  return (
    <div className={cn("flex-1 flex flex-col min-h-0", !isVisible && "hidden")}>
      {view === "list" ? (
        /* ─── LIST VIEW ──────────────────────────────────── */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <PenLine className="h-5 w-5 text-indigo-400" />
                  Whiteboards
                </h1>
                <p className="text-sm text-zinc-400 mt-0.5">
                  Create & collaborate on drawings in real-time
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  onClick={() => setShowJoinInput(!showJoinInput)}
                >
                  <LogIn className="h-4 w-4 mr-1" />
                  Join
                </Button>
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New Board
                </Button>
              </div>
            </div>

            {showJoinInput && (
              <div className="flex items-center gap-2 mb-3 p-3 rounded-lg bg-zinc-900 border border-zinc-700">
                <input
                  type="text"
                  placeholder="Enter session code (e.g. WB-A1B2C3D4)"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                />
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={handleJoinByCode}
                >
                  Join
                </Button>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search whiteboards..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-indigo-500 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Create Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-lg font-semibold text-white mb-4">Create New Whiteboard</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-zinc-400 block mb-1">Title</label>
                    <input
                      type="text"
                      placeholder="My Whiteboard"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-indigo-500"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 block mb-1">Visibility</label>
                    <div className="flex gap-2">
                      <button
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                          newIsPublic ? "bg-indigo-600/20 border-indigo-500 text-indigo-300" : "bg-zinc-800 border-zinc-600 text-zinc-400 hover:bg-zinc-700"
                        )}
                        onClick={() => setNewIsPublic(true)}
                      >
                        <Globe className="h-4 w-4" /> Public
                      </button>
                      <button
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                          !newIsPublic ? "bg-indigo-600/20 border-indigo-500 text-indigo-300" : "bg-zinc-800 border-zinc-600 text-zinc-400 hover:bg-zinc-700"
                        )}
                        onClick={() => setNewIsPublic(false)}
                      >
                        <Lock className="h-4 w-4" /> Private
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {newIsPublic ? "Anyone with the session code can join" : "Only invited collaborators can access"}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="ghost" size="sm" onClick={() => { setShowCreateModal(false); setNewTitle(""); }} className="text-zinc-400">Cancel</Button>
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleCreate}>Create</Button>
                </div>
              </div>
            </div>
          )}

          {/* Board List */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 text-zinc-500">
                <PenLine className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">{searchQuery ? "No whiteboards match your search" : "No whiteboards yet — create one to get started!"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((wb) => (
                  <div
                    key={wb._id}
                    onClick={() => openWhiteboard(wb)}
                    className="group relative bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:border-indigo-500/50 hover:bg-zinc-900 transition-all duration-200"
                  >
                    <div className="aspect-video rounded-lg bg-zinc-800 mb-3 flex items-center justify-center overflow-hidden">
                      <PenLine className="h-8 w-8 text-zinc-600" />
                    </div>
                    <h3 className="text-sm font-medium text-white truncate">{wb.title}</h3>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-500">
                      <Clock className="h-3 w-3" />
                      <span>{timeAgo(wb.updatedAt)}</span>
                      <span className="text-zinc-700">·</span>
                      {wb.is_public ? <Globe className="h-3 w-3 text-emerald-500" /> : <Lock className="h-3 w-3 text-amber-500" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-500">
                      <User className="h-3 w-3" />
                      <span className="truncate">{wb.owner_id?._id === user?._id ? "You" : wb.owner_id?.name || "Unknown"}</span>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => copyCode(wb.session_code, e)} className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors" title="Copy session code">
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
                      {wb.owner_id?._id === user?._id && (
                        <>
                          <button onClick={(e) => handleArchive(wb._id, e)} className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-amber-400 transition-colors" title="Archive">
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={(e) => handleDelete(wb._id, e)} className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400 tracking-wide">{wb.session_code}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── EDITOR VIEW ──────────────────────────────── */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Editor Header */}
          <div className="flex-shrink-0 h-12 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur flex items-center justify-between px-4 z-10">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={leaveEditor} className="text-zinc-400 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <div className="h-5 w-px bg-zinc-700" />
              <h2 className="text-sm font-medium text-white truncate max-w-[200px]">{activeWhiteboard?.title}</h2>
              <button
                onClick={(e) => copyCode(activeWhiteboard?.session_code, e)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-400 hover:text-white transition-colors"
                title="Copy session code to share"
              >
                <Copy className="h-3 w-3" />
                <span className="font-mono">{activeWhiteboard?.session_code}</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              {liveCollaborators.length > 0 && (
                <div className="flex items-center gap-1.5 mr-2">
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  <div className="flex -space-x-1.5">
                    {liveCollaborators.slice(0, 5).map((c) => (
                      <div key={c.userId} className="h-6 w-6 rounded-full bg-indigo-600 border-2 border-zinc-950 flex items-center justify-center text-[10px] font-bold text-white" title={c.name}>
                        {c.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    ))}
                  </div>
                  {liveCollaborators.length > 5 && <span className="text-xs text-zinc-400">+{liveCollaborators.length - 5}</span>}
                  <span className="text-xs text-emerald-400 ml-1">{liveCollaborators.length} online</span>
                </div>
              )}
            </div>
          </div>

          {/* Custom Drawing Canvas */}
          <DrawingCanvas
            elements={elements}
            onElementsChange={handleElementsChange}
            remoteCursors={remoteCursors}
            canvasState={activeWhiteboard?.canvas_state}
          />
        </div>
      )}
    </div>
  );
}
