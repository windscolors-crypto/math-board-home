/* Built-in whiteboard for the math room.
   Tool order and behaviour follow the Whiteboard app on the new KALBOARD screen so that what a
   teacher learns on one board works on the other. Objects are immutable: every change builds a
   new objects array, which makes undo/redo a matter of keeping the previous arrays. */
(() => {
  "use strict";

  // ================================================================ bridge to the native window
  const host = window.chrome && window.chrome.webview;
  const send = (m) => host && host.postMessage(m);
  let reqSeq = 0;
  const waiting = new Map();
  function rpc(op, args = {}) {
    if (!host) return Promise.resolve(previewRpc(op));
    return new Promise((resolve) => {
      const reqId = String(++reqSeq);
      waiting.set(reqId, resolve);
      send(Object.assign({ cmd: "board", op, reqId }, args));
      setTimeout(() => { if (waiting.has(reqId)) { waiting.delete(reqId); resolve({ ok: false, error: "timeout" }); } }, 30000);
    });
  }
  if (host) {
    host.addEventListener("message", (e) => {
      const m = e.data;
      if (m && m.type === "reply" && waiting.has(m.reqId)) {
        waiting.get(m.reqId)(m.result || {});
        waiting.delete(m.reqId);
      }
    });
  }
  function previewRpc(op) {
    if (op === "list" || op === "images") return { ok: true, items: [] };
    if (op === "restore") return { ok: false };
    return { ok: true };
  }

  // ================================================================ icons
  const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONS = {
    menu: P('<path d="M4 6h16M4 12h16M4 18h10"/>'),
    chevL: P('<path d="m15 18-6-6 6-6"/>'),
    chevR: P('<path d="m9 18 6-6-6-6"/>'),
    plus: P('<path d="M12 5v14M5 12h14"/>'),
    split: P('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>'),
    split3: P('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>'),
    pen: P('<path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>'),
    eraser: P('<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>'),
    select: P('<path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/>'),
    shape: P('<circle cx="8" cy="8" r="5"/><rect x="11" y="11" width="10" height="10" rx="1"/>'),
    toolbox: P('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>'),
    undo: P('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    redo: P('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
    keyboard: P('<path d="M10 8h.01M12 12h.01M14 8h.01M16 12h.01M18 8h.01M6 8h.01M7 16h10M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>'),
    home: P('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>'),
    image: P('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>'),
    ruler: P('<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>'),
    set45: P('<path d="M4 20V4l16 16Z"/><path d="M8 16v-4l4 4Z"/>'),
    set30: P('<path d="M4 20V7l13 13Z"/><path d="M7.5 16.5v-3l3 3Z"/>'),
    protractor: P('<path d="M3 18a9 9 0 0 1 18 0Z"/><path d="M12 18 16.5 11"/>'),
    compass: P('<circle cx="12" cy="5" r="2"/><path d="m11 7-5 14M13 7l5 14M8.5 15h7"/>'),
    file: P('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>'),
    open: P('<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>'),
    save: P('<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7"/>'),
    grid: P('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
  };
  const paintIcons = (root = document) =>
    root.querySelectorAll("[data-i]").forEach((el) => { if (!el.firstChild) el.innerHTML = ICONS[el.dataset.i] || ""; });

  // ================================================================ helpers
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const arabicDigits = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  const PX_PER_CM = 38; // nominal centimetre on screen (96 dpi)

  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function projectOnLine(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = ((px - ax) * dx + (py - ay) * dy) / len2;
    return [ax + t * dx, ay + t * dy];
  }

  let toastTimer = null;
  function toast(text, ms = 2400) {
    const t = $("toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), ms);
  }

  // ================================================================ document model
  const COLORS = ["#111111", "#FFFFFF", "#7A8793", "#1F5FD6", "#16A3B8", "#2E9E4F",
                  "#8BC34A", "#F2C230", "#F08A24", "#E03131", "#C2185B", "#7B3FD1"];
  const BG_COLORS = ["#FFFFFF", "#FBF6E9", "#E8F3EA", "#1F4D3A", "#17324A", "#141414"];
  const GRIDS = [
    { id: "none", name: "بدون" },
    { id: "small", name: "مربعات صغيرة" },
    { id: "big", name: "مربعات كبيرة" },
    { id: "lines", name: "سطور" },
    { id: "dots", name: "نقاط" },
    { id: "axes", name: "محاور إحداثية" },
  ];

  const state = {
    tool: "pen",
    penKind: "pen", penSize: 4, penColor: "#1F5FD6",
    eraserSize: 40,
    shapeKind: "rect", shapeSize: 4, shapeColor: "#1F5FD6", shapeFill: false,
  };
  const newPage = () => ({ bg: "#FFFFFF", grid: "none", objects: [] });
  let doc = { version: 1, pages: [newPage()] };
  let current = 0;
  let docName = "";
  const page = () => doc.pages[current];

  const histories = new WeakMap();
  const hist = () => {
    let h = histories.get(page());
    if (!h) { h = { undo: [], redo: [] }; histories.set(page(), h); }
    return h;
  };
  function commit(before) {
    const h = hist();
    h.undo.push(before);
    if (h.undo.length > 80) h.undo.shift();
    h.redo = [];
    changed();
  }
  function undo() {
    const h = hist();
    if (!h.undo.length) return;
    h.redo.push(page().objects);
    page().objects = h.undo.pop();
    clearSelection();
    renderInk();
    changed();
  }
  function redo() {
    const h = hist();
    if (!h.redo.length) return;
    h.undo.push(page().objects);
    page().objects = h.redo.pop();
    clearSelection();
    renderInk();
    changed();
  }
  function addObjects(objs) {
    const before = page().objects;
    page().objects = before.concat(objs);
    commit(before);
    renderInk();
  }

  let autosaveTimer = null;
  let dirty = false;
  function changed() {
    dirty = true;
    updateUndoButtons();
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(autosave, 3000);
  }
  const serialize = () => JSON.stringify({ version: 1, name: docName, pages: doc.pages.map((p) => ({ bg: p.bg, grid: p.grid, objects: p.objects })) });
  function hasContent() { return doc.pages.some((p) => p.objects.length); }
  async function autosave() {
    clearTimeout(autosaveTimer);
    if (!dirty) return;
    dirty = false;
    await rpc("autosave", { data: serialize() });
  }
  function loadDoc(json, name) {
    const d = typeof json === "string" ? JSON.parse(json) : json;
    if (!d || !Array.isArray(d.pages) || !d.pages.length) throw new Error("bad file");
    doc = { version: 1, pages: d.pages.map((p) => ({ bg: p.bg || "#FFFFFF", grid: p.grid || "none", objects: Array.isArray(p.objects) ? p.objects : [] })) };
    docName = name || d.name || "";
    current = 0;
    clearSelection();
    renderAll();
  }

  // ================================================================ canvases
  const stage = $("stage");
  const cvBg = $("bg"), cvInk = $("ink"), cvLive = $("live");
  const ctxBg = cvBg.getContext("2d"), ctxInk = cvInk.getContext("2d"), ctxLive = cvLive.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.round(r.width);
    H = Math.round(r.height);
    DPR = window.devicePixelRatio || 1;
    for (const c of [cvBg, cvInk, cvLive]) {
      c.width = Math.round(W * DPR);
      c.height = Math.round(H * DPR);
    }
    for (const x of [ctxBg, ctxInk, ctxLive]) x.setTransform(DPR, 0, 0, DPR, 0, 0);
    renderAll();
  }
  function renderAll() {
    renderBg();
    renderInk();
    updatePages();
    updateUndoButtons();
    positionSelection();
  }

  const isDark = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 128;
  };

  function paintGrid(ctx, w, h, bg, grid, scale = 1) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const dark = isDark(bg);
    const line = dark ? "rgba(255,255,255,.17)" : "rgba(23,50,74,.13)";
    const strong = dark ? "rgba(255,255,255,.55)" : "rgba(23,50,74,.6)";
    ctx.save();
    ctx.direction = "ltr"; // keep "-3" from turning into "3-" in the right-to-left page
    ctx.strokeStyle = line;
    ctx.fillStyle = line;
    ctx.lineWidth = 1;
    const lines = (step, horizontalOnly) => {
      ctx.beginPath();
      for (let y = step; y < h; y += step) { ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); }
      if (!horizontalOnly) for (let x = step; x < w; x += step) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); }
      ctx.stroke();
    };
    if (grid === "small") lines(20 * scale);
    if (grid === "big") lines(40 * scale);
    if (grid === "lines") lines(44 * scale, true);
    if (grid === "dots") {
      const s = 30 * scale;
      for (let y = s; y < h; y += s) for (let x = s; x < w; x += s) { ctx.beginPath(); ctx.arc(x, y, 1.6 * Math.max(scale, .6), 0, Math.PI * 2); ctx.fill(); }
    }
    if (grid === "axes") {
      const s = 40 * scale;
      const cx = Math.round(w / 2 / s) * s, cy = Math.round(h / 2 / s) * s;
      lines(s);
      ctx.strokeStyle = strong;
      ctx.fillStyle = strong;
      ctx.lineWidth = 2 * Math.max(scale, .5);
      ctx.beginPath();
      ctx.moveTo(0, cy); ctx.lineTo(w, cy);
      ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
      ctx.stroke();
      if (scale >= .9) {
        ctx.font = "500 13px Readex Pro, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (let x = cx + s, n = 1; x < w; x += s, n++) ctx.fillText(String(n), x, cy + 5);
        for (let x = cx - s, n = -1; x > 0; x -= s, n--) ctx.fillText(String(n), x, cy + 5);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (let y = cy - s, n = 1; y > 0; y -= s, n++) ctx.fillText(String(n), cx - 6, y);
        for (let y = cy + s, n = -1; y < h; y += s, n--) ctx.fillText(String(n), cx - 6, y);
        ctx.fillText("0", cx - 6, cy + 12);
      }
    }
    ctx.restore();
  }
  function renderBg() { paintGrid(ctxBg, W, H, page().bg, page().grid); }

  // ---------------------------------------------------------------- drawing objects
  const imageCache = new Map();
  function getImage(src) {
    let img = imageCache.get(src);
    if (!img) {
      img = new Image();
      img.onload = () => renderInk();
      img.src = src;
      imageCache.set(src, img);
    }
    return img;
  }

  function strokeWidth(kind, size) { return kind === "marker" ? size * 2.2 : kind === "highlighter" ? size * 4 : size; }

  function drawStroke(ctx, o) {
    const pts = o.p;
    if (!pts || !pts.length) return;
    ctx.save();
    ctx.globalAlpha = o.k === "highlighter" ? .35 : 1;
    ctx.strokeStyle = o.c;
    ctx.fillStyle = o.c;
    ctx.lineWidth = o.w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], o.w / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  const SHAPES = [
    ["line", "خط"], ["arrow", "سهم"], ["dashed", "خط متقطع"], ["rect", "مستطيل"], ["square", "مربع"],
    ["circle", "دائرة"], ["ellipse", "قطع ناقص"], ["triangle", "مثلث"], ["right", "مثلث قائم"],
    ["para", "متوازي أضلاع"], ["trap", "شبه منحرف"], ["penta", "خماسي"], ["hexa", "سداسي"], ["star", "نجمة"],
    ["cube", "مكعب"], ["cylinder", "أسطوانة"], ["cone", "مخروط"], ["sphere", "كرة"], ["pyramid", "هرم"],
  ];
  const LINE_SHAPES = new Set(["line", "arrow", "dashed"]);
  const SOLID_SHAPES = new Set(["cube", "cylinder", "cone", "sphere", "pyramid"]);

  function shapeBox(o) {
    return { x: Math.min(o.x1, o.x2), y: Math.min(o.y1, o.y2), w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) };
  }
  function polygon(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  }
  function regular(n, b, rot = -Math.PI / 2) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    return Array.from({ length: n }, (_, i) => [cx + (b.w / 2) * Math.cos(rot + (i * 2 * Math.PI) / n), cy + (b.h / 2) * Math.sin(rot + (i * 2 * Math.PI) / n)]);
  }
  function seg(ctx, a, b, dashed) {
    ctx.save();
    if (dashed) ctx.setLineDash([ctx.lineWidth * 2.5, ctx.lineWidth * 2]);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();
  }
  function halfEllipse(ctx, cx, cy, rx, ry, front, dashed) {
    ctx.save();
    if (dashed) ctx.setLineDash([ctx.lineWidth * 2.5, ctx.lineWidth * 2]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(rx, .1), Math.max(ry, .1), 0, front ? 0 : Math.PI, front ? Math.PI : 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawShape(ctx, o) {
    ctx.save();
    ctx.strokeStyle = o.c;
    ctx.fillStyle = o.c;
    ctx.lineWidth = o.w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const b = shapeBox(o);
    const close = () => { if (o.f) ctx.fill(); ctx.stroke(); };
    switch (o.k) {
      case "line": seg(ctx, [o.x1, o.y1], [o.x2, o.y2]); break;
      case "dashed": seg(ctx, [o.x1, o.y1], [o.x2, o.y2], true); break;
      case "arrow": {
        seg(ctx, [o.x1, o.y1], [o.x2, o.y2]);
        const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1), L = Math.max(14, o.w * 4);
        polygon(ctx, [[o.x2, o.y2], [o.x2 - L * Math.cos(a - .45), o.y2 - L * Math.sin(a - .45)], [o.x2 - L * Math.cos(a + .45), o.y2 - L * Math.sin(a + .45)]]);
        ctx.fill(); ctx.stroke();
        break;
      }
      case "rect": case "square": ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); close(); break;
      case "circle": case "ellipse": ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w / 2, .1), Math.max(b.h / 2, .1), 0, 0, Math.PI * 2); close(); break;
      case "triangle": polygon(ctx, [[b.x + b.w / 2, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]); close(); break;
      case "right": polygon(ctx, [[b.x, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]); close();
        if (b.w > 30 && b.h > 30) { const s = Math.min(18, b.w / 4, b.h / 4); ctx.save(); ctx.lineWidth = Math.max(1, o.w / 2); ctx.strokeRect(b.x, b.y + b.h - s, s, s); ctx.restore(); }
        break;
      case "para": { const d = b.w * .25; polygon(ctx, [[b.x + d, b.y], [b.x + b.w, b.y], [b.x + b.w - d, b.y + b.h], [b.x, b.y + b.h]]); close(); break; }
      case "trap": { const d = b.w * .22; polygon(ctx, [[b.x + d, b.y], [b.x + b.w - d, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]); close(); break; }
      case "penta": polygon(ctx, regular(5, b)); close(); break;
      case "hexa": polygon(ctx, regular(6, b, 0)); close(); break;
      case "star": {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2, pts = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? .42 : 1, a = -Math.PI / 2 + (i * Math.PI) / 5;
          pts.push([cx + (b.w / 2) * r * Math.cos(a), cy + (b.h / 2) * r * Math.sin(a)]);
        }
        polygon(ctx, pts); close(); break;
      }
      case "cube": {
        const d = Math.min(b.w, b.h) * .3;
        const F = [[b.x, b.y + d], [b.x + b.w - d, b.y + d], [b.x + b.w - d, b.y + b.h], [b.x, b.y + b.h]];
        const B = F.map(([x, y]) => [x + d, y - d]);
        polygon(ctx, F); ctx.stroke();
        seg(ctx, B[0], B[1]); seg(ctx, B[1], B[2]);
        seg(ctx, F[0], B[0]); seg(ctx, F[1], B[1]); seg(ctx, F[2], B[2]);
        seg(ctx, B[2], B[3], true); seg(ctx, B[3], B[0], true); seg(ctx, F[3], B[3], true);
        break;
      }
      case "cylinder": {
        const rx = b.w / 2, ry = Math.min(b.h * .15, b.w * .25), cx = b.x + rx;
        ctx.beginPath(); ctx.ellipse(cx, b.y + ry, Math.max(rx, .1), Math.max(ry, .1), 0, 0, Math.PI * 2); ctx.stroke();
        halfEllipse(ctx, cx, b.y + b.h - ry, rx, ry, true, false);
        halfEllipse(ctx, cx, b.y + b.h - ry, rx, ry, false, true);
        seg(ctx, [b.x, b.y + ry], [b.x, b.y + b.h - ry]); seg(ctx, [b.x + b.w, b.y + ry], [b.x + b.w, b.y + b.h - ry]);
        break;
      }
      case "cone": {
        const rx = b.w / 2, ry = Math.min(b.h * .15, b.w * .25), cx = b.x + rx, by = b.y + b.h - ry;
        halfEllipse(ctx, cx, by, rx, ry, true, false);
        halfEllipse(ctx, cx, by, rx, ry, false, true);
        seg(ctx, [cx, b.y], [b.x, by]); seg(ctx, [cx, b.y], [b.x + b.w, by]);
        seg(ctx, [cx, b.y], [cx, by], true); seg(ctx, [cx, by], [b.x + b.w, by], true);
        break;
      }
      case "sphere": {
        const r = Math.min(b.w, b.h) / 2, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(r, .1), 0, Math.PI * 2); ctx.stroke();
        halfEllipse(ctx, cx, cy, r, r * .3, true, false);
        halfEllipse(ctx, cx, cy, r, r * .3, false, true);
        break;
      }
      case "pyramid": {
        const A = [b.x, b.y + b.h], B = [b.x + b.w * .72, b.y + b.h], C = [b.x + b.w, b.y + b.h * .78], D = [b.x + b.w * .28, b.y + b.h * .78], E = [b.x + b.w * .5, b.y];
        seg(ctx, A, B); seg(ctx, B, C); seg(ctx, E, A); seg(ctx, E, B); seg(ctx, E, C);
        seg(ctx, A, D, true); seg(ctx, D, C, true); seg(ctx, E, D, true);
        break;
      }
    }
    ctx.restore();
  }

  function drawObj(ctx, o) {
    if (o.t === "stroke") drawStroke(ctx, o);
    else if (o.t === "shape") drawShape(ctx, o);
    else if (o.t === "image") {
      const img = getImage(o.src);
      if (img.complete && img.naturalWidth) ctx.drawImage(img, o.x, o.y, o.w, o.h);
    }
  }
  function renderInk() {
    ctxInk.clearRect(0, 0, W, H);
    for (const o of page().objects) drawObj(ctxInk, o);
  }
  const clearLive = () => ctxLive.clearRect(0, 0, W, H);

  // ---------------------------------------------------------------- geometry of objects
  function bbox(o) {
    if (o.t === "stroke") {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const [x, y] of o.p) { if (x < x1) x1 = x; if (y < y1) y1 = y; if (x > x2) x2 = x; if (y > y2) y2 = y; }
      const m = o.w / 2;
      return { x: x1 - m, y: y1 - m, w: x2 - x1 + o.w, h: y2 - y1 + o.w };
    }
    if (o.t === "shape") { const b = shapeBox(o), m = o.w / 2; return { x: b.x - m, y: b.y - m, w: b.w + o.w, h: b.h + o.w }; }
    return { x: o.x, y: o.y, w: o.w, h: o.h };
  }
  function hit(o, x, y, tol) {
    if (o.t === "stroke") {
      const r = o.w / 2 + tol, p = o.p;
      if (p.length === 1) return Math.hypot(p[0][0] - x, p[0][1] - y) <= r;
      for (let i = 1; i < p.length; i++) if (distToSeg(x, y, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]) <= r) return true;
      return false;
    }
    if (o.t === "shape" && LINE_SHAPES.has(o.k)) return distToSeg(x, y, o.x1, o.y1, o.x2, o.y2) <= o.w / 2 + tol;
    const b = bbox(o);
    return x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol;
  }
  /** Moves and/or scales an object: point -> (origin + (point - origin) * s) + (dx, dy). */
  function transformObj(o, dx, dy, s = 1, ox = 0, oy = 0) {
    const f = (x, y) => [ox + (x - ox) * s + dx, oy + (y - oy) * s + dy];
    if (o.t === "stroke") return Object.assign({}, o, { p: o.p.map(([x, y]) => f(x, y)), w: o.w * s });
    if (o.t === "shape") {
      const [x1, y1] = f(o.x1, o.y1), [x2, y2] = f(o.x2, o.y2);
      return Object.assign({}, o, { x1, y1, x2, y2 });
    }
    const [x, y] = f(o.x, o.y);
    return Object.assign({}, o, { x, y, w: o.w * s, h: o.h * s });
  }

  // ================================================================ toolbar and popovers
  const toolButtons = [...document.querySelectorAll(".tb[data-tool]")];
  let openPop = null;

  function setTool(tool) {
    state.tool = tool;
    toolButtons.forEach((b) => b.classList.toggle("on", b.dataset.tool === tool));
    if (tool !== "select") clearSelection();
    cvLive.style.cursor = tool === "select" ? "default" : "crosshair";
    clearLive();
  }
  function closePop() {
    if (openPop) $("pop-" + openPop).hidden = true;
    openPop = null;
  }
  function togglePop(name, anchor) {
    if (openPop === name) return closePop();
    closePop();
    const pop = $("pop-" + name);
    pop.hidden = false;
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth;
    pop.style.left = clamp(r.left + r.width / 2 - pw / 2, 8, window.innerWidth - pw - 8) + "px";
    openPop = name;
    if (name === "pen") drawPenPreview();
  }
  document.querySelectorAll(".tb[data-pop], .tb[data-tool]").forEach((b) => {
    b.addEventListener("click", () => {
      const tool = b.dataset.tool, pop = b.dataset.pop;
      // one tap picks the tool and opens its settings; a second tap closes them
      if (tool && state.tool !== tool) { setTool(tool); closePop(); if (pop) togglePop(pop, b); return; }
      if (pop) togglePop(pop, b);
    });
  });

  function swatches(container, colors, get, set) {
    container.textContent = "";
    colors.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.style.setProperty("--c", c);
      b.setAttribute("aria-label", c);
      b.classList.toggle("on", c.toLowerCase() === get().toLowerCase());
      b.addEventListener("click", () => {
        set(c);
        container.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      });
      container.appendChild(b);
    });
  }

  // pen settings
  function drawPenPreview() {
    const c = $("penPreview"), x = c.getContext("2d");
    x.clearRect(0, 0, c.width, c.height);
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push([16 + i * 6.7, 22 + Math.sin(i / 6) * 10]);
    drawStroke(x, { t: "stroke", k: state.penKind, c: state.penColor, w: Math.min(strokeWidth(state.penKind, state.penSize), 30), p: pts });
  }
  document.querySelectorAll("#penKinds button").forEach((b) => {
    b.classList.toggle("on", b.dataset.kind === state.penKind);
    b.addEventListener("click", () => {
      state.penKind = b.dataset.kind;
      document.querySelectorAll("#penKinds button").forEach((x) => x.classList.toggle("on", x === b));
      if (state.penKind === "highlighter" && state.penColor === "#111111") {
        state.penColor = "#F2C230";
        swatches($("penColors"), COLORS, () => state.penColor, (c) => { state.penColor = c; drawPenPreview(); });
      }
      drawPenPreview();
    });
  });
  $("penSize").addEventListener("input", (e) => { state.penSize = +e.target.value; drawPenPreview(); });
  swatches($("penColors"), COLORS, () => state.penColor, (c) => { state.penColor = c; drawPenPreview(); });

  // eraser settings
  $("eraserSize").addEventListener("input", (e) => { state.eraserSize = +e.target.value; });
  $("clearPage").addEventListener("click", async () => {
    closePop();
    if (!page().objects.length) return;
    if (await ask("مسح كل ما في هذه الصفحة؟", "مسح الصفحة")) {
      const before = page().objects;
      page().objects = [];
      commit(before);
      clearSelection();
      renderInk();
      toast("مُسحت الصفحة. «تراجع» يعيدها.");
    }
  });

  // shape settings
  function buildShapeGrid() {
    const g = $("shapeGrid");
    g.textContent = "";
    SHAPES.forEach(([k, name]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.title = name;
      b.setAttribute("aria-label", name);
      b.classList.toggle("on", k === state.shapeKind);
      const c = document.createElement("canvas");
      c.width = 72; c.height = 72;
      c.style.width = "100%"; c.style.height = "100%";
      const x = c.getContext("2d");
      const on = k === state.shapeKind;
      const o = LINE_SHAPES.has(k)
        ? { t: "shape", k, x1: 12, y1: 60, x2: 60, y2: 12, c: on ? "#fff" : "#17324A", w: 4 }
        : { t: "shape", k, x1: 12, y1: 12, x2: 60, y2: 60, c: on ? "#fff" : "#17324A", w: 4 };
      drawShape(x, o);
      b.appendChild(c);
      b.addEventListener("click", () => { state.shapeKind = k; buildShapeGrid(); setTool("shape"); });
      g.appendChild(b);
    });
  }
  $("shapeSize").addEventListener("input", (e) => { state.shapeSize = +e.target.value; });
  $("shapeFill").addEventListener("change", (e) => { state.shapeFill = e.target.checked; });
  swatches($("shapeColors"), COLORS, () => state.shapeColor, (c) => { state.shapeColor = c; });

  // toolbox
  document.querySelectorAll("[data-box]").forEach((b) => b.addEventListener("click", () => {
    closePop();
    const kind = b.dataset.box;
    if (kind === "image") openImages();
    else addTool(kind);
  }));

  // menu
  document.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", async () => {
    closePop();
    const m = b.dataset.menu;
    if (m === "new") {
      if (hasContent() && !(await ask("بدء لوح جديد؟ ما لم تحفظيه من اللوح الحالي سيُفقد.", "لوح جديد"))) return;
      doc = { version: 1, pages: [newPage()] };
      current = 0;
      docName = "";
      clearSelection();
      removeAllTools();
      renderAll();
      changed();
    }
    if (m === "open") openList();
    if (m === "save") openSave();
    if (m === "background") openBackground();
    if (m === "exit") goHome();
  }));

  // split menu
  document.querySelectorAll("[data-split]").forEach((b) => b.addEventListener("click", () => { closePop(); startSplit(+b.dataset.split); }));

  $("undo").addEventListener("click", undo);
  $("redo").addEventListener("click", redo);
  function updateUndoButtons() {
    $("undo").disabled = !hist().undo.length;
    $("redo").disabled = !hist().redo.length;
  }
  $("kbd").addEventListener("click", () => send({ cmd: "keyboard" }));
  $("home").addEventListener("click", goHome);
  async function goHome() {
    dirty = true;
    await autosave();
    location.href = "index.html";
  }

  // pages
  function updatePages() {
    $("pgNum").textContent = `${current + 1} / ${doc.pages.length}`;
    $("pgPrev").disabled = current === 0;
    $("pgNext").disabled = current === doc.pages.length - 1;
  }
  function goPage(i) {
    current = clamp(i, 0, doc.pages.length - 1);
    clearSelection();
    renderAll();
  }
  $("pgPrev").addEventListener("click", () => goPage(current - 1));
  $("pgNext").addEventListener("click", () => goPage(current + 1));
  $("pgAdd").addEventListener("click", () => {
    const p = newPage();
    p.bg = page().bg;
    p.grid = page().grid;
    doc.pages.splice(current + 1, 0, p);
    goPage(current + 1);
    changed();
  });

  // ================================================================ dialogs
  function showLayer(id) { $(id).hidden = false; }
  function hideLayer(id) { $(id).hidden = true; }
  document.querySelectorAll(".layer").forEach((layer) => {
    layer.addEventListener("click", (e) => {
      if (e.target === layer || e.target.closest("[data-close]")) {
        hideLayer(layer.id);
        if (layer.id === "dlgConfirm" && confirmResolve) { confirmResolve(false); confirmResolve = null; }
      }
    });
  });
  document.querySelectorAll("[data-kbd]").forEach((b) => b.addEventListener("click", () => {
    const input = b.closest(".field-row").querySelector("input");
    input.focus();
    send({ cmd: "keyboard" });
  }));

  let confirmResolve = null;
  function ask(text, yes) {
    $("confirmText").textContent = text;
    $("confirmYes").textContent = yes;
    showLayer("dlgConfirm");
    return new Promise((resolve) => { confirmResolve = resolve; });
  }
  $("confirmYes").addEventListener("click", () => {
    hideLayer("dlgConfirm");
    if (confirmResolve) { confirmResolve(true); confirmResolve = null; }
  });

  // save
  let saveWhere = "local";
  document.querySelectorAll("#saveWhere button").forEach((b) => b.addEventListener("click", () => {
    saveWhere = b.dataset.where;
    document.querySelectorAll("#saveWhere button").forEach((x) => x.classList.toggle("on", x === b));
  }));
  function openSave() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    $("saveName").value = docName || `لوح ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}`;
    showLayer("dlgSave");
  }
  $("saveGo").addEventListener("click", async () => {
    const name = $("saveName").value.trim();
    hideLayer("dlgSave");
    const r = await rpc("save", { name, data: serialize(), where: saveWhere });
    if (r.ok) { docName = r.name || name; toast(saveWhere === "usb" ? `حُفظ على الفلاشة: ${docName}` : `حُفظ في المستندات ← السبورة: ${docName}`, 3500); }
    else if (r.error === "nousb") toast("لا توجد فلاشة موصولة. أدخليها ثم احفظي مرة أخرى.", 4000);
    else toast("تعذّر الحفظ. جرّبي مرة أخرى.", 3500);
  });

  // open
  async function openList() {
    const list = $("openList");
    list.innerHTML = '<p class="empty">جارٍ البحث عن الألواح المحفوظة…</p>';
    showLayer("dlgOpen");
    const r = await rpc("list");
    list.textContent = "";
    if (!r.ok || !r.items || !r.items.length) {
      list.innerHTML = '<p class="empty">لا توجد ألواح محفوظة بعد. احفظي اللوح من القائمة ← حفظ.</p>';
      return;
    }
    r.items.forEach((it) => {
      const b = document.createElement("button");
      b.type = "button";
      const name = document.createElement("span");
      name.textContent = it.name;
      const meta = document.createElement("small");
      meta.textContent = `${it.where === "usb" ? "الفلاشة" : "الجهاز"} · ${it.date}`;
      b.append(name, meta);
      b.addEventListener("click", async () => {
        hideLayer("dlgOpen");
        const f = await rpc("load", { path: it.path });
        if (!f.ok) return toast("تعذّر فتح هذا اللوح.");
        try { loadDoc(f.data, f.name); toast(`فُتح: ${f.name}`); changed(); }
        catch { toast("هذا الملف لا يمكن قراءته."); }
      });
      list.appendChild(b);
    });
  }

  // background
  function openBackground() {
    swatches($("bgColors"), BG_COLORS, () => page().bg, (c) => { page().bg = c; renderBg(); drawGridChoices(); changed(); });
    drawGridChoices();
    showLayer("dlgBg");
  }
  function drawGridChoices() {
    const g = $("bgGrids");
    g.textContent = "";
    GRIDS.forEach((gr) => {
      const b = document.createElement("button");
      b.type = "button";
      b.classList.toggle("on", page().grid === gr.id);
      const c = document.createElement("canvas");
      c.width = 180; c.height = 90;
      paintGrid(c.getContext("2d"), 180, 90, page().bg, gr.id, .5);
      const s = document.createElement("span");
      s.textContent = gr.name;
      b.append(c, s);
      b.addEventListener("click", () => { page().grid = gr.id; renderBg(); drawGridChoices(); changed(); });
      g.appendChild(b);
    });
  }

  // images
  async function openImages() {
    const list = $("imgList");
    list.innerHTML = '<p class="hint">جارٍ البحث عن الصور…</p>';
    showLayer("dlgImages");
    const r = await rpc("images");
    list.textContent = "";
    if (!r.ok || !r.items || !r.items.length) {
      list.innerHTML = '<p class="hint">لم أجد صوراً. أدخلي فلاشة فيها صور، أو احفظي الصورة في مجلد «الصور» أو «التنزيلات».</p>';
      return;
    }
    r.items.forEach((it) => {
      const b = document.createElement("button");
      b.type = "button";
      const img = document.createElement("img");
      img.src = it.thumb;
      img.alt = "";
      const s = document.createElement("span");
      s.textContent = (it.where === "usb" ? "الفلاشة · " : "") + it.name;
      b.append(img, s);
      b.addEventListener("click", async () => {
        hideLayer("dlgImages");
        toast("جارٍ إدراج الصورة…");
        const f = await rpc("image", { path: it.path });
        if (!f.ok) return toast("تعذّر فتح هذه الصورة.");
        insertImage(f.data);
      });
      list.appendChild(b);
    });
  }
  function insertImage(src) {
    const img = getImage(src);
    const place = () => {
      const k = Math.min(1, (W * .6) / img.naturalWidth, (H * .6) / img.naturalHeight);
      const w = img.naturalWidth * k, h = img.naturalHeight * k;
      const o = { t: "image", id: uid(), src, x: (W - w) / 2, y: (H - h) / 2, w, h };
      addObjects([o]);
      setTool("select");
      select([o.id]);
      toast("اسحبي الصورة لتحريكها، والدائرة في زاويتها لتكبيرها.", 3500);
    };
    if (img.complete && img.naturalWidth) place(); else img.addEventListener("load", place, { once: true });
  }

  // ================================================================ drawing on the stage
  let active = null; // the gesture in progress

  function pos(e) {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  cvLive.addEventListener("pointerdown", (e) => {
    closePop();
    if (active) return; // one finger at a time: old boards report a single touch point
    cvLive.setPointerCapture(e.pointerId);
    const [x, y] = pos(e);
    const tool = state.tool;
    if (tool === "pen") startPen(e, x, y);
    else if (tool === "eraser") startEraser(e, x, y);
    else if (tool === "shape") startShape(e, x, y);
    else if (tool === "select") startSelect(e, x, y);
  });
  cvLive.addEventListener("pointermove", (e) => {
    if (!active || e.pointerId !== active.id) {
      if (!active && state.tool === "eraser" && e.pointerType === "mouse") { const [x, y] = pos(e); drawEraserRing(x, y); }
      return;
    }
    const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ce of coalesced.length ? coalesced : [e]) { const [x, y] = pos(ce); active.move(x, y); }
  });
  const endGesture = (e) => {
    if (!active || e.pointerId !== active.id) return;
    const g = active;
    active = null;
    g.end();
  };
  cvLive.addEventListener("pointerup", endGesture);
  cvLive.addEventListener("pointercancel", endGesture);

  // ---------------------------------------------------------------- pen (snaps to a ruler or set-square edge)
  function startPen(e, x, y) {
    const w = strokeWidth(state.penKind, state.penSize);
    const edge = nearestEdge(x, y, 34 + w / 2);
    const o = { t: "stroke", id: uid(), k: state.penKind, c: state.penColor, w, p: [] };
    if (edge) {
      const a = projectOnLine(x, y, ...edge);
      o.p = [a, a];
      active = {
        id: e.pointerId,
        move(mx, my) { o.p = [a, projectOnLine(mx, my, ...edge)]; clearLive(); drawStroke(ctxLive, o); },
        end() { clearLive(); if (Math.hypot(o.p[1][0] - a[0], o.p[1][1] - a[1]) > 2) addObjects([o]); },
      };
    } else {
      o.p = [[x, y]];
      let lx = x, ly = y;
      active = {
        id: e.pointerId,
        move(mx, my) {
          if (Math.hypot(mx - lx, my - ly) < 1.5) return;
          o.p.push([mx, my]);
          lx = mx; ly = my;
          clearLive();
          drawStroke(ctxLive, o);
        },
        end() { clearLive(); addObjects([o]); },
      };
    }
    clearLive();
    drawStroke(ctxLive, o);
  }

  // ---------------------------------------------------------------- eraser (splits strokes, removes shapes it touches)
  function drawEraserRing(x, y) {
    clearLive();
    ctxLive.save();
    ctxLive.strokeStyle = "rgba(23,50,74,.6)";
    ctxLive.fillStyle = "rgba(255,255,255,.35)";
    ctxLive.lineWidth = 2;
    ctxLive.beginPath();
    ctxLive.arc(x, y, state.eraserSize / 2, 0, Math.PI * 2);
    ctxLive.fill();
    ctxLive.stroke();
    ctxLive.restore();
  }
  function densify(pts, step) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const n = Math.floor(Math.hypot(bx - ax, by - ay) / step);
      for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / (n + 1), ay + ((by - ay) * k) / (n + 1)]);
      out.push(pts[i]);
    }
    return out;
  }
  function eraseAt(objects, x, y, r) {
    let changedAny = false;
    const out = [];
    for (const o of objects) {
      if (o.t === "image") { out.push(o); continue; }
      if (o.t === "shape") {
        if (hit(o, x, y, r * .5)) { changedAny = true; continue; }
        out.push(o);
        continue;
      }
      const b = bbox(o);
      if (x + r < b.x || x - r > b.x + b.w || y + r < b.y || y - r > b.y + b.h) { out.push(o); continue; }
      const rr = r + o.w / 2;
      const pts = densify(o.p, 3);
      if (!pts.some(([px, py]) => Math.hypot(px - x, py - y) <= rr)) { out.push(o); continue; }
      changedAny = true;
      let run = [];
      const flush = () => { if (run.length > 1) out.push(Object.assign({}, o, { id: uid(), p: run })); run = []; };
      for (const p of pts) { if (Math.hypot(p[0] - x, p[1] - y) <= rr) flush(); else run.push(p); }
      flush();
    }
    return changedAny ? out : objects;
  }
  function startEraser(e, x, y) {
    const before = page().objects;
    const r = state.eraserSize / 2;
    let lx = x, ly = y;
    const step = (mx, my) => {
      // erase along the path so fast strokes don't skip
      const n = Math.max(1, Math.ceil(Math.hypot(mx - lx, my - ly) / (r * .6)));
      let objs = page().objects;
      for (let i = 1; i <= n; i++) objs = eraseAt(objs, lx + ((mx - lx) * i) / n, ly + ((my - ly) * i) / n, r);
      if (objs !== page().objects) { page().objects = objs; renderInk(); }
      lx = mx; ly = my;
      drawEraserRing(mx, my);
    };
    page().objects = eraseAt(page().objects, x, y, r);
    renderInk();
    drawEraserRing(x, y);
    active = {
      id: e.pointerId,
      move: step,
      end() { clearLive(); if (page().objects !== before) commit(before); },
    };
  }

  // ---------------------------------------------------------------- shapes
  function startShape(e, x, y) {
    const k = state.shapeKind;
    const o = { t: "shape", id: uid(), k, x1: x, y1: y, x2: x, y2: y, c: state.shapeColor, w: state.shapeSize, f: state.shapeFill && !LINE_SHAPES.has(k) && !SOLID_SHAPES.has(k) };
    active = {
      id: e.pointerId,
      move(mx, my) {
        o.x2 = mx; o.y2 = my;
        if (k === "square" || k === "circle" || k === "sphere" || k === "cube") {
          const s = Math.max(Math.abs(mx - x), Math.abs(my - y));
          o.x2 = x + Math.sign(mx - x || 1) * s;
          o.y2 = y + Math.sign(my - y || 1) * s;
        }
        clearLive();
        drawShape(ctxLive, o);
      },
      end() {
        clearLive();
        if (Math.hypot(o.x2 - o.x1, o.y2 - o.y1) < 8) return;
        addObjects([o]);
      },
    };
  }

  // ---------------------------------------------------------------- select, move, resize
  let selected = new Set();
  const selectedObjects = () => page().objects.filter((o) => selected.has(o.id));
  function select(ids) { selected = new Set(ids); positionSelection(); }
  function clearSelection() { selected = new Set(); positionSelection(); }
  function unionBox(objs) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const o of objs) { const b = bbox(o); x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h); }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  function positionSelection() {
    const objs = selectedObjects();
    const el = $("selection");
    if (!objs.length) { el.hidden = true; return; }
    el.hidden = false;
    const b = unionBox(objs), pad = 8;
    const box = $("selBox");
    Object.assign(box.style, { left: b.x - pad + "px", top: b.y - pad + "px", width: b.w + pad * 2 + "px", height: b.h + pad * 2 + "px" });
    const bar = $("selActions");
    const top = b.y - pad - 64 > 8 ? b.y - pad - 64 : b.y + b.h + pad + 14;
    bar.style.top = Math.min(top, H - 60) + "px";
    bar.style.left = clamp(b.x + b.w / 2 - bar.offsetWidth / 2, 8, W - bar.offsetWidth - 8) + "px";
  }

  function startSelect(e, x, y) {
    const objs = page().objects;
    for (let i = objs.length - 1; i >= 0; i--) {
      if (hit(objs[i], x, y, 10)) {
        if (!selected.has(objs[i].id)) select([objs[i].id]);
        startMove(e, x, y);
        return;
      }
    }
    clearSelection();
    // rubber band
    let x2 = x, y2 = y;
    active = {
      id: e.pointerId,
      move(mx, my) {
        x2 = mx; y2 = my;
        clearLive();
        ctxLive.save();
        ctxLive.setLineDash([8, 6]);
        ctxLive.strokeStyle = "#2E7D57";
        ctxLive.fillStyle = "rgba(46,125,87,.08)";
        ctxLive.lineWidth = 2;
        ctxLive.fillRect(Math.min(x, x2), Math.min(y, y2), Math.abs(x2 - x), Math.abs(y2 - y));
        ctxLive.strokeRect(Math.min(x, x2), Math.min(y, y2), Math.abs(x2 - x), Math.abs(y2 - y));
        ctxLive.restore();
      },
      end() {
        clearLive();
        const r = { x: Math.min(x, x2), y: Math.min(y, y2), w: Math.abs(x2 - x), h: Math.abs(y2 - y) };
        if (r.w < 6 && r.h < 6) return;
        const ids = page().objects.filter((o) => {
          const b = bbox(o);
          return b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y;
        }).map((o) => o.id);
        select(ids);
      },
    };
  }

  function startTransform(e, x, y, scaleMode) {
    const before = page().objects;
    const origin = unionBox(selectedObjects());
    active = {
      id: e.pointerId,
      move(mx, my) {
        let dx = mx - x, dy = my - y, s = 1;
        if (scaleMode) {
          const w0 = Math.max(origin.w, 10), h0 = Math.max(origin.h, 10);
          s = clamp(Math.max((w0 + dx) / w0, (h0 + dy) / h0), .1, 20);
          dx = 0; dy = 0;
        }
        page().objects = before.map((o) => (selected.has(o.id) ? transformObj(o, dx, dy, s, origin.x, origin.y) : o));
        renderInk();
        positionSelection();
      },
      end() { if (page().objects !== before) commit(before); },
    };
  }
  const startMove = (e, x, y) => startTransform(e, x, y, false);

  const selBox = $("selBox");
  selBox.addEventListener("pointerdown", (e) => {
    if (active) return;
    e.stopPropagation();
    selBox.setPointerCapture(e.pointerId);
    const [x, y] = pos(e);
    startTransform(e, x, y, e.target.id === "selHandle");
  });
  selBox.addEventListener("pointermove", (e) => { if (active && e.pointerId === active.id) { const [x, y] = pos(e); active.move(x, y); } });
  selBox.addEventListener("pointerup", endGesture);
  selBox.addEventListener("pointercancel", endGesture);

  document.querySelectorAll("[data-sel]").forEach((b) => b.addEventListener("click", () => {
    const before = page().objects;
    const act = b.dataset.sel;
    if (act === "delete") page().objects = before.filter((o) => !selected.has(o.id));
    if (act === "front") page().objects = before.filter((o) => !selected.has(o.id)).concat(before.filter((o) => selected.has(o.id)));
    if (act === "back") page().objects = before.filter((o) => selected.has(o.id)).concat(before.filter((o) => !selected.has(o.id)));
    if (act === "copy") {
      const copies = before.filter((o) => selected.has(o.id)).map((o) => Object.assign(transformObj(o, 30, 30), { id: uid() }));
      page().objects = before.concat(copies);
      select(copies.map((o) => o.id));
    }
    commit(before);
    if (act === "delete") clearSelection();
    renderInk();
    positionSelection();
  }));

  // ================================================================ math tools
  const toolsLayer = $("toolsLayer");
  const tools = [];
  const SVGNS = "http://www.w3.org/2000/svg";
  const S = 1600; // half-size of each tool's drawing area

  function svgEl(name, attrs, parent) {
    const el = document.createElementNS(SVGNS, name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function toWorld(t, lx, ly) {
    const c = Math.cos(rad(t.rot)), s = Math.sin(rad(t.rot));
    return [t.x + lx * c - ly * s, t.y + lx * s + ly * c];
  }
  function toLocal(t, wx, wy) {
    const c = Math.cos(rad(-t.rot)), s = Math.sin(rad(-t.rot));
    const dx = wx - t.x, dy = wy - t.y;
    return [dx * c - dy * s, dx * s + dy * c];
  }

  /** Straight edges a pen stroke can snap to: [ax, ay, bx, by] in board coordinates. */
  function nearestEdge(x, y, maxDist) {
    let best = null, bestD = maxDist;
    for (const t of tools) {
      for (const [a, b] of t.edges()) {
        const A = toWorld(t, a[0], a[1]), B = toWorld(t, b[0], b[1]);
        const d = distToSeg(x, y, A[0], A[1], B[0], B[1]);
        if (d < bestD) { bestD = d; best = [A[0], A[1], B[0], B[1]]; }
      }
    }
    return best;
  }

  function placeTool(t) { t.el.style.transform = `translate(${t.x}px, ${t.y}px) rotate(${t.rot}deg)`; }
  function removeTool(t) { t.el.remove(); tools.splice(tools.indexOf(t), 1); }
  function removeAllTools() { while (tools.length) removeTool(tools[0]); }

  /** Generic drag helper for an SVG part of a tool. */
  function drag(part, handlers) {
    part.addEventListener("pointerdown", (e) => {
      if (active) return;
      e.stopPropagation();
      e.preventDefault();
      closePop();
      part.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      const g = handlers.start(x, y) || {};
      active = { id: e.pointerId, move: g.move || (() => {}), end: g.end || (() => {}) };
    });
    part.addEventListener("pointermove", (e) => { if (active && e.pointerId === active.id) { const [x, y] = pos(e); active.move(x, y); } });
    part.addEventListener("pointerup", endGesture);
    part.addEventListener("pointercancel", endGesture);
  }
  const moveHandler = (t) => ({
    start(x, y) {
      const ox = t.x - x, oy = t.y - y;
      return { move(mx, my) { t.x = mx + ox; t.y = my + oy; placeTool(t); } };
    },
  });
  /** Rotation around the tool's origin, snapping to every 15° when close. */
  const rotateHandler = (t, onChange) => ({
    start(x, y) {
      const a0 = deg(Math.atan2(y - t.y, x - t.x)) - t.rot;
      return {
        move(mx, my) {
          let r = deg(Math.atan2(my - t.y, mx - t.x)) - a0;
          const snap = Math.round(r / 15) * 15;
          if (Math.abs(r - snap) < 3) r = snap;
          t.rot = ((r % 360) + 360) % 360;
          placeTool(t);
          onChange && onChange();
        },
      };
    },
  });

  function makeToolShell(t) {
    const el = document.createElement("div");
    el.className = "mtool";
    const svg = svgEl("svg", { width: 2 * S, height: 2 * S, viewBox: `${-S} ${-S} ${2 * S} ${2 * S}` });
    svg.style.position = "absolute";
    svg.style.left = -S + "px";
    svg.style.top = -S + "px";
    svg.style.pointerEvents = "none";
    el.appendChild(svg);
    toolsLayer.appendChild(el);
    t.el = el;
    t.svg = svg;
    return svg;
  }
  function knob(svg, x, y, icon, cls = "knob") {
    const g = svgEl("g", {}, svg);
    const c = svgEl("circle", { cx: x, cy: y, r: 20, class: cls }, g);
    c.style.pointerEvents = "auto";
    if (icon === "rotate") svgEl("path", { d: `M${x - 8} ${y - 2} a8 8 0 1 1 3 7 M${x - 9} ${y - 9} v7 h7`, class: "knob-ico" }, g);
    if (icon === "close") svgEl("path", { d: `M${x - 7} ${y - 7} L${x + 7} ${y + 7} M${x + 7} ${y - 7} L${x - 7} ${y + 7}`, class: "close-x" }, g);
    if (icon === "resize") svgEl("path", { d: `M${x - 9} ${y} h18 M${x - 9} ${y} l5 -5 M${x - 9} ${y} l5 5 M${x + 9} ${y} l-5 -5 M${x + 9} ${y} l-5 5`, class: "knob-ico" }, g);
    return c;
  }
  const bodyPart = (el) => { el.style.pointerEvents = "auto"; return el; };

  function addTool(kind) {
    const t = { kind, x: W / 2, y: H / 2, rot: 0 };
    if (kind === "ruler") buildRuler(t);
    if (kind === "set45") buildSetSquare(t, 45);
    if (kind === "set30") buildSetSquare(t, 30);
    if (kind === "protractor") buildProtractor(t);
    if (kind === "compass") buildCompass(t);
    tools.push(t);
    placeTool(t);
    setTool("pen");
    if (kind === "compass") toast("اسحبي الطرف الأصفر لترسمي دائرة أو قوساً، والسهم لتغيير نصف القطر.", 4500);
    else if (kind === "protractor") toast("حرّكي المقبض الأخضر إلى الزاوية التي تريدينها، ثم «ارسمي الزاوية».", 4500);
    else toast("ارسمي بالقلم بجانب الحافة فيخرج الخط مستقيماً.", 3500);
  }

  // ---------------------------------------------------------------- ruler (20 cm)
  function buildRuler(t) {
    const L = 20 * PX_PER_CM + 40, Hh = 86;
    const svg = makeToolShell(t);
    drag(bodyPart(svgEl("rect", { x: -L / 2, y: -Hh / 2, width: L, height: Hh, rx: 8, class: "body" }, svg)), moveHandler(t));
    const x0 = -10 * PX_PER_CM;
    for (let mm = 0; mm <= 200; mm++) {
      const x = x0 + (mm * PX_PER_CM) / 10;
      const len = mm % 10 === 0 ? 22 : mm % 5 === 0 ? 15 : 9;
      svgEl("line", { x1: x, y1: -Hh / 2, x2: x, y2: -Hh / 2 + len, class: "tick" }, svg);
      if (mm % 10 === 0) { const n = svgEl("text", { x, y: -Hh / 2 + 38, class: "num" }, svg); n.textContent = arabicDigits(mm / 10); }
    }
    drag(knob(svg, L / 2 - 30, Hh / 2 - 24, "rotate"), rotateHandler(t));
    const close = knob(svg, -L / 2 + 30, Hh / 2 - 24, "close", "close-k");
    close.addEventListener("click", () => removeTool(t));
    t.edges = () => [[[-L / 2, -Hh / 2], [L / 2, -Hh / 2]], [[-L / 2, Hh / 2], [L / 2, Hh / 2]]];
  }

  // ---------------------------------------------------------------- set squares (45° and 30°/60°)
  function buildSetSquare(t, angle) {
    const a = angle === 45 ? 380 : 440;          // horizontal leg
    const b = angle === 45 ? 380 : a * Math.tan(rad(30)); // vertical leg
    const cx = a / 3, cy = -b / 3;                 // centroid, used as the origin
    const A = [-cx, -cy], B = [a - cx, -cy], C = [-cx, -b - cy]; // right angle at A
    const inner = [A, B, C].map(([x, y]) => [x * .45, y * .45]);
    const svg = makeToolShell(t);
    const d = `M${A} L${B} L${C} Z M${inner[0]} L${inner[2]} L${inner[1]} Z`;
    drag(bodyPart(svgEl("path", { d, class: "body", "fill-rule": "evenodd" }, svg)), moveHandler(t));
    const cmA = Math.floor(a / PX_PER_CM), cmB = Math.floor(b / PX_PER_CM);
    for (let i = 0; i <= cmA * 2; i++) {
      const x = A[0] + (i * PX_PER_CM) / 2;
      svgEl("line", { x1: x, y1: A[1], x2: x, y2: A[1] - (i % 2 ? 8 : 15), class: "tick" }, svg);
      if (i % 2 === 0 && i > 0 && i < cmA * 2) { const n = svgEl("text", { x, y: A[1] - 22, class: "num" }, svg); n.textContent = arabicDigits(i / 2); }
    }
    for (let i = 0; i <= cmB * 2; i++) {
      const y = A[1] - (i * PX_PER_CM) / 2;
      svgEl("line", { x1: A[0], y1: y, x2: A[0] + (i % 2 ? 8 : 15), y2: y, class: "tick" }, svg);
    }
    const label = svgEl("text", { x: B[0] - 70, y: A[1] - 50, class: "num" }, svg);
    label.textContent = angle === 45 ? "٤٥°" : "٣٠°";
    drag(knob(svg, B[0] - 40, A[1] - 22 - 20, "rotate"), rotateHandler(t));
    const close = knob(svg, A[0] + 34, C[1] + 80, "close", "close-k");
    close.addEventListener("click", () => removeTool(t));
    t.edges = () => [[A, B], [A, C], [B, C]];
  }

  // ---------------------------------------------------------------- protractor with an angle arm
  function buildProtractor(t) {
    const R = 270, strip = 44;
    t.angle = 60;
    const svg = makeToolShell(t);
    const d = `M${-R} ${strip} L${-R} 0 A${R} ${R} 0 0 1 ${R} 0 L${R} ${strip} Z`;
    drag(bodyPart(svgEl("path", { d, class: "body" }, svg)), moveHandler(t));
    for (let a = 0; a <= 180; a++) {
      const len = a % 10 === 0 ? 24 : a % 5 === 0 ? 16 : 9;
      const c = Math.cos(rad(a)), s = -Math.sin(rad(a));
      svgEl("line", { x1: R * c, y1: R * s, x2: (R - len) * c, y2: (R - len) * s, class: "tick" }, svg);
      if (a % 10 === 0) {
        const n = svgEl("text", { x: (R - 42) * c, y: (R - 42) * s + 5, class: "num" }, svg);
        n.textContent = arabicDigits(a);
      }
    }
    svgEl("line", { x1: -R, y1: 0, x2: R, y2: 0, class: "tick" }, svg);
    svgEl("circle", { cx: 0, cy: 0, r: 4, fill: "#2C5F86" }, svg);
    const arm = svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 0, class: "arm" }, svg);
    const armKnob = svgEl("circle", { r: 18, class: "lead" }, svg);
    armKnob.style.pointerEvents = "auto";
    const bubble = svgEl("circle", { cx: 0, cy: -95, r: 34, class: "bubble" }, svg);
    const bubbleT = svgEl("text", { x: 0, y: -95, class: "bubble-t" }, svg);
    const update = () => {
      const c = Math.cos(rad(t.angle)), s = -Math.sin(rad(t.angle));
      arm.setAttribute("x2", (R + 20) * c);
      arm.setAttribute("y2", (R + 20) * s);
      armKnob.setAttribute("cx", (R + 20) * c);
      armKnob.setAttribute("cy", (R + 20) * s);
      bubbleT.textContent = arabicDigits(Math.round(t.angle)) + "°";
    };
    void bubble;
    update();
    drag(armKnob, {
      start() {
        return {
          move(mx, my) {
            const [lx, ly] = toLocal(t, mx, my);
            t.angle = clamp(deg(Math.atan2(-ly, lx)), 0, 180);
            const snap = Math.round(t.angle);
            t.angle = snap;
            update();
          },
        };
      },
    });
    // "draw the angle" button on the strip
    const btn = bodyPart(svgEl("rect", { x: -70, y: 6, width: 140, height: 32, rx: 16, class: "btn" }, svg));
    const bt = svgEl("text", { x: 0, y: 22, class: "btn-t" }, svg);
    bt.textContent = "ارسمي الزاوية";
    btn.addEventListener("click", () => {
      const len = R + 40;
      const O = toWorld(t, 0, 0);
      const base = toWorld(t, len, 0);
      const c = Math.cos(rad(t.angle)), s = -Math.sin(rad(t.angle));
      const armEnd = toWorld(t, len * c, len * s);
      const arc = [];
      for (let a = 0; a <= t.angle; a += 2) arc.push(toWorld(t, 46 * Math.cos(rad(a)), -46 * Math.sin(rad(a))));
      const style = { t: "stroke", k: "pen", c: state.penColor, w: Math.max(3, state.penSize) };
      addObjects([
        Object.assign({ id: uid(), p: [O, base] }, style),
        Object.assign({ id: uid(), p: [O, armEnd] }, style),
        Object.assign({ id: uid(), p: arc.length > 1 ? arc : [O] }, style, { w: Math.max(2, state.penSize * .7) }),
      ]);
      toast(`رُسمت زاوية ${arabicDigits(Math.round(t.angle))}°`);
    });
    drag(knob(svg, R - 28, strip - 22 + 30, "rotate"), rotateHandler(t));
    const close = knob(svg, -R + 28, strip - 22 + 30, "close", "close-k");
    close.addEventListener("click", () => removeTool(t));
    t.edges = () => [[[-R, 0], [R, 0]], [[-R, strip], [R, strip]]];
  }

  // ---------------------------------------------------------------- compass
  function buildCompass(t) {
    t.r = 5 * PX_PER_CM;
    t.a = 0; // pencil direction in degrees (0 = right, clockwise on screen)
    const svg = makeToolShell(t);
    const radiusLine = svgEl("line", { class: "radius-line" }, svg);
    const radiusT = svgEl("text", { class: "radius-t" }, svg);
    const leg1 = svgEl("line", { class: "leg" }, svg);
    const leg2 = svgEl("line", { class: "leg" }, svg);
    const hinge = bodyPart(svgEl("circle", { r: 16, class: "hinge" }, svg));
    const needle = bodyPart(svgEl("circle", { cx: 0, cy: 0, r: 12, class: "needle" }, svg));
    const lead = bodyPart(svgEl("circle", { r: 18, class: "lead" }, svg));
    const resize = knob(svg, 0, 0, "resize");
    const close = knob(svg, 0, 0, "close", "close-k");
    let hingePos = [0, 0];

    const update = () => {
      const c = Math.cos(rad(t.a)), s = Math.sin(rad(t.a));
      const P = [t.r * c, t.r * s];
      const leg = Math.max(t.r / 2 + 60, 200);
      const h = Math.sqrt(Math.max(leg * leg - (t.r / 2) ** 2, 900));
      const n = [s, -c]; // perpendicular, "above" the radius
      hingePos = [P[0] / 2 + n[0] * h, P[1] / 2 + n[1] * h];
      leg1.setAttribute("x1", 0); leg1.setAttribute("y1", 0); leg1.setAttribute("x2", hingePos[0]); leg1.setAttribute("y2", hingePos[1]);
      leg2.setAttribute("x1", P[0]); leg2.setAttribute("y1", P[1]); leg2.setAttribute("x2", hingePos[0]); leg2.setAttribute("y2", hingePos[1]);
      hinge.setAttribute("cx", hingePos[0]); hinge.setAttribute("cy", hingePos[1]);
      lead.setAttribute("cx", P[0]); lead.setAttribute("cy", P[1]);
      radiusLine.setAttribute("x2", P[0]); radiusLine.setAttribute("y2", P[1]);
      radiusT.setAttribute("x", P[0] / 2 - n[0] * 22); radiusT.setAttribute("y", P[1] / 2 - n[1] * 22 + 5);
      radiusT.textContent = "نق = " + arabicDigits((t.r / PX_PER_CM).toFixed(1)).replace(".", "٫") + " سم";
      const rk = [P[0] + c * 46, P[1] + s * 46];
      resize.setAttribute("cx", rk[0]); resize.setAttribute("cy", rk[1]);
      resize.nextSibling.setAttribute("transform", `translate(${rk[0]} ${rk[1]}) rotate(${t.a})`);
      resize.nextSibling.setAttribute("d", "M-9 0 h18 M-9 0 l5 -5 M-9 0 l5 5 M9 0 l-5 -5 M9 0 l-5 5");
      close.setAttribute("cx", hingePos[0] + n[0] * 44); close.setAttribute("cy", hingePos[1] + n[1] * 44);
      close.nextSibling.setAttribute("transform", `translate(${hingePos[0] + n[0] * 44} ${hingePos[1] + n[1] * 44})`);
      close.nextSibling.setAttribute("d", "M-7 -7 L7 7 M7 -7 L-7 7");
    };
    update();

    drag(needle, moveHandler(t));
    drag(hinge, moveHandler(t));
    close.addEventListener("click", () => removeTool(t));
    drag(resize, {
      start() {
        return {
          move(mx, my) {
            const dx = mx - t.x, dy = my - t.y;
            t.r = clamp(Math.hypot(dx, dy) - 46, 20, 1200);
            t.a = deg(Math.atan2(dy, dx));
            update();
          },
        };
      },
    });
    // drawing: the pencil turns around the needle, radius fixed
    drag(lead, {
      start() {
        const o = { t: "stroke", id: uid(), k: "pen", c: state.penColor, w: Math.max(2, state.penSize), p: [] };
        const pointAt = (a) => [t.x + t.r * Math.cos(rad(a)), t.y + t.r * Math.sin(rad(a))];
        o.p.push(pointAt(t.a));
        let last = t.a;
        return {
          move(mx, my) {
            const target = deg(Math.atan2(my - t.y, mx - t.x));
            let d = target - (((last % 360) + 360) % 360);
            d = ((d + 540) % 360) - 180; // shortest way round
            const steps = Math.ceil(Math.abs(d));
            for (let i = 1; i <= steps; i++) o.p.push(pointAt(last + (d * i) / steps));
            last += d;
            t.a = last;
            update();
            clearLive();
            drawStroke(ctxLive, o);
          },
          end() {
            clearLive();
            t.a = ((t.a % 360) + 360) % 360;
            if (o.p.length > 2) addObjects([o]);
          },
        };
      },
    });
    t.edges = () => [];
  }

  // ================================================================ split screen (each part has its own pen)
  function startSplit(n) {
    const box = $("split");
    box.textContent = "";
    box.hidden = false;
    const parts = [];
    for (let i = 0; i < n; i++) {
      const part = document.createElement("div");
      part.className = "split-part";
      const c = document.createElement("canvas");
      part.appendChild(c);
      const bar = document.createElement("div");
      bar.className = "split-bar";
      part.appendChild(bar);
      box.appendChild(part);
      const p = { el: part, c, ctx: c.getContext("2d"), strokes: [], color: ["#111111", "#E03131", "#1F5FD6"][i % 3], size: 5 };
      parts.push(p);

      const colors = ["#111111", "#E03131", "#1F5FD6", "#2E9E4F"];
      const dots = colors.map((col) => {
        const d = document.createElement("button");
        d.type = "button";
        d.className = "dot";
        d.style.setProperty("--c", col);
        d.classList.toggle("on", col === p.color);
        d.addEventListener("click", () => { p.color = col; dots.forEach((x) => x.classList.toggle("on", x === d)); });
        bar.appendChild(d);
        return d;
      });
      const sizes = [3, 6, 12].map((sz) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sz";
        const dot = document.createElement("i");
        dot.style.width = dot.style.height = sz + 2 + "px";
        b.appendChild(dot);
        b.classList.toggle("on", sz === 6);
        b.addEventListener("click", () => { p.size = sz; sizes.forEach((x) => x.classList.toggle("on", x === b)); });
        bar.appendChild(b);
        return b;
      });
      p.size = 6;
      const clr = document.createElement("button");
      clr.type = "button";
      clr.className = "clr";
      clr.textContent = "مسح";
      clr.addEventListener("click", () => { p.strokes = []; redrawPart(p); });
      bar.appendChild(clr);

      let cur = null;
      c.addEventListener("pointerdown", (e) => {
        if (cur) return;
        c.setPointerCapture(e.pointerId);
        const r = c.getBoundingClientRect();
        cur = { pid: e.pointerId, o: { t: "stroke", k: "pen", c: p.color, w: p.size, p: [[e.clientX - r.left, e.clientY - r.top]] } };
        p.strokes.push(cur.o);
        redrawPart(p);
      });
      c.addEventListener("pointermove", (e) => {
        if (!cur || e.pointerId !== cur.pid) return;
        const r = c.getBoundingClientRect();
        cur.o.p.push([e.clientX - r.left, e.clientY - r.top]);
        redrawPart(p);
      });
      const stop = (e) => { if (cur && e.pointerId === cur.pid) cur = null; };
      c.addEventListener("pointerup", stop);
      c.addEventListener("pointercancel", stop);
    }
    const exit = document.createElement("button");
    exit.type = "button";
    exit.className = "split-exit";
    exit.textContent = "الخروج من التقسيم";
    exit.addEventListener("click", async () => {
      if (parts.some((p) => p.strokes.length) && !(await ask("الخروج من تقسيم اللوح؟ ما كُتب في الأقسام سيُمسح.", "خروج"))) return;
      box.hidden = true;
      box.textContent = "";
    });
    box.appendChild(exit);
    const sizeAll = () => parts.forEach((p) => {
      const r = p.el.getBoundingClientRect();
      p.c.width = Math.round(r.width * DPR);
      p.c.height = Math.round(r.height * DPR);
      p.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      redrawPart(p);
    });
    requestAnimationFrame(sizeAll);
    window.addEventListener("resize", sizeAll);
  }
  function redrawPart(p) {
    p.ctx.clearRect(0, 0, p.c.width, p.c.height);
    p.strokes.forEach((o) => drawStroke(p.ctx, o));
  }

  // ================================================================ keyboard shortcuts (for the supervisor with a keyboard)
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    if (e.key === "Delete" && selected.size) document.querySelector('[data-sel="delete"]').click();
  });
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("dragstart", (e) => e.preventDefault());

  // ================================================================ start
  paintIcons();
  buildShapeGrid();
  setTool("pen");
  window.addEventListener("resize", resize);
  resize();

  (async () => {
    const r = await rpc("restore");
    if (!r.ok || !r.data) return;
    let saved;
    try { saved = JSON.parse(r.data); } catch { return; }
    if (!saved.pages || !saved.pages.some((p) => p.objects && p.objects.length)) return;
    if (await ask(`متابعة آخر لوح (${r.date})؟`, "متابعة")) {
      loadDoc(saved);
      toast("عاد آخر لوح كما تركتِه.");
    }
  })();

  // test hooks for the design preview
  window.__board = { state, get doc() { return doc; }, addTool, loadDoc, setTool, startSplit, select, insertImage };
})();
