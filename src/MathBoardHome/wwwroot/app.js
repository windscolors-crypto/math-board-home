/* Home screen logic. Talks to the native window through window.chrome.webview. */
(() => {
  "use strict";

  // ---------------------------------------------------------------- icons (Lucide, ISC licence)
  const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONS = {
    presentation: P('<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>'),
    usb: P('<circle cx="10" cy="7" r="1"/><circle cx="4" cy="20" r="1"/><path d="M4.7 19.3 19 5"/><path d="m21 3-3 1 2 2Z"/><path d="M9.26 7.68 5 12l2 5"/><path d="m10 14 5 2 3.5-3.5"/><path d="m18 12 1-1 1 1-1 1Z"/>'),
    download: P('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6"/><path d="m15 13-3 3-3-3"/>'),
    globe: P('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'),
    users: P('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>'),
    games: P('<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>'),
    keyboard: P('<path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>'),
    target: P('<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>'),
    search: P('<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>'),
    x: P('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    back: P('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
    hand: P('<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>'),
  };
  const paintIcons = (root = document) =>
    root.querySelectorAll("[data-icon]").forEach((el) => {
      if (!el.firstChild) el.innerHTML = ICONS[el.dataset.icon] || ICONS.globe;
    });

  // The board icon: a compass construction of an equilateral triangle, drawn in chalk.
  const HERO_GLYPH = `
    <svg class="hero-glyph" viewBox="0 0 100 100" aria-hidden="true">
      <path class="chalk faint" d="M22 80 H78"/>
      <path class="chalk draw" style="--len:140" d="M30 70 L70 70 L50 35.4 Z"/>
      <circle cx="30" cy="70" r="3.4"/><circle cx="70" cy="70" r="3.4"/><circle cx="50" cy="35.4" r="3.4"/>
    </svg>`;

  // ---------------------------------------------------------------- bridge to the native window
  const host = window.chrome && window.chrome.webview;
  const send = (msg) => host && host.postMessage(msg);

  // ---------------------------------------------------------------- state
  const $ = (id) => document.getElementById(id);
  let config = { apps: [] };
  let locale = "ar-SA";
  let drives = [];

  // ---------------------------------------------------------------- clock
  function tickClock() {
    const now = new Date();
    const nu = config.digits === "latn" ? "latn" : "arab";
    const parts = new Intl.DateTimeFormat(`${locale}-u-nu-${nu}`, { hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(now);
    const time = parts.filter((p) => p.type === "hour" || p.type === "minute" || p.type === "literal").map((p) => p.value).join("").trim();
    const period = (parts.find((p) => p.type === "dayPeriod") || {}).value || "";
    $("clockTime").textContent = time;
    $("clockPeriod").textContent = period;
    $("dateGreg").textContent = new Intl.DateTimeFormat(`${locale}-u-ca-gregory-nu-${nu}`, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
    $("dateHijri").textContent = new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura-nu-${nu}`, { day: "numeric", month: "long", year: "numeric" }).format(now);
  }

  // ---------------------------------------------------------------- tiles
  function tile(app, { inGroup = false, parent = null } = {}) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "app";
    b.dataset.id = app.id;
    b.dataset.search = `${app.name || ""} ${app.hint || ""} ${(app.keywords || []).join(" ")}`.toLowerCase();
    const hero = app.hero && !inGroup;
    if (hero) b.classList.add("hero");

    const icon = document.createElement("span");
    icon.className = "icon";
    const color = app.color || (parent && parent.color);
    if (color) icon.style.setProperty("--c", color);
    if (app.ink) icon.style.setProperty("--ink", app.ink);
    if (app.image) {
      const img = document.createElement("img");
      img.src = app.image;
      img.alt = "";
      icon.appendChild(img);
    } else if (hero) {
      icon.innerHTML = HERO_GLYPH;
    } else {
      const ic = document.createElement("span");
      ic.className = "glyph";
      ic.dataset.icon = app.icon || (inGroup ? "globe" : "hand");
      icon.appendChild(ic);
    }

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = app.name || "";
    b.append(icon, label);
    if (hero && app.hint) {
      const hint = document.createElement("span");
      hint.className = "hint";
      hint.textContent = app.hint;
      b.appendChild(hint);
    }

    b.addEventListener("click", () => activate(app));
    return b;
  }

  function renderGrid() {
    const grid = $("grid");
    grid.textContent = "";
    (config.apps || []).forEach((app) => grid.appendChild(tile(app)));
    paintIcons(grid);
    $("roomTitle").textContent = config.title || "";
    if (config.wallpaper) document.body.style.setProperty("--wall", `url("${String(config.wallpaper).replace(/"/g, "")}")`);
    applyFilter();
  }

  const pending = new Map(); // id -> app, waiting for a native result
  function activate(app) {
    resetIdle();
    if (app.type === "group") return openGroup(app);
    if (!host) return toast(`(معاينة) فتح «${app.name}»`);
    pending.set(app.id, app);
    if (app.type !== "keyboard") toast(`جارٍ فتح «${app.name}»`);
    send({ cmd: "launch", id: app.id });
  }

  function onResult(msg) {
    const app = pending.get(msg.id) || {};
    pending.delete(msg.id);
    switch (msg.result) {
      case "ok": break;
      case "nousb": toast("لا توجد فلاشة موصولة، فتحتُ ملفات الجهاز. أدخلي الفلاشة وستُفتح وحدها."); break;
      case "notfound": toast(app.missing || `لم يُعثر على «${app.name || "البرنامج"}» في هذا الجهاز. أبلغي مشرفة الغرفة.`, "warn", 6000); break;
      default: toast(`تعذّر فتح «${app.name || "البرنامج"}». جرّبي مرة أخرى.`, "warn", 5000);
    }
  }

  // ---------------------------------------------------------------- groups (educational games)
  function openGroup(app) {
    $("groupTitle").textContent = app.name || "";
    const g = $("groupGrid");
    g.textContent = "";
    (app.items || []).forEach((it) => g.appendChild(tile(it, { inGroup: true, parent: app })));
    paintIcons(g);
    show("groupLayer");
  }

  // ---------------------------------------------------------------- search
  const input = $("searchInput");
  function applyFilter() {
    const q = input.value.trim().toLowerCase();
    const tiles = [...$("grid").children];
    let shown = 0;
    tiles.forEach((t) => {
      const hit = !q || t.dataset.search.includes(q);
      t.hidden = !hit;
      if (hit) shown++;
    });
    $("grid").classList.toggle("filtered", !!q);
    $("empty").hidden = !q || shown > 0;
    $("searchClear").hidden = !q;
    $("searchWeb").hidden = !q;
  }
  input.addEventListener("input", () => { applyFilter(); resetIdle(); });
  $("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    const tiles = [...$("grid").children].filter((t) => !t.hidden);
    if (tiles.length === 1) { tiles[0].click(); return; }
    if (!host) return toast(`(معاينة) بحث في الإنترنت عن «${q}»`);
    toast(`جارٍ البحث عن «${q}»`);
    send({ cmd: "search", q });
  });
  $("searchClear").addEventListener("click", () => { input.value = ""; applyFilter(); input.focus(); });
  $("searchKbd").addEventListener("click", () => { input.focus(); send({ cmd: "keyboard" }); });

  // ---------------------------------------------------------------- USB
  function renderUsb(added) {
    const bar = $("usbBar");
    if (!drives.length) { bar.hidden = true; return; }
    const d = drives[drives.length - 1];
    const label = d.label ? `«${d.label}»` : "";
    $("usbText").textContent = drives.length > 1
      ? `${drives.length} فلاشات موصولة`
      : `فلاشة ${label} موصولة \u2066(${d.root.replace(/\\$/, "")})\u2069`.replace(/\s+/g, " ");
    bar.hidden = false;
    if (added) { bar.classList.remove("arrived"); void bar.offsetWidth; bar.classList.add("arrived"); }
  }
  $("usbOpen").addEventListener("click", () => {
    const usb = (config.apps || []).find((a) => a.type === "usb");
    if (usb) activate(usb); else send({ cmd: "launch", id: "usb" });
  });

  // ---------------------------------------------------------------- supervisor (hold the clock 3 s)
  const clock = $("clock");
  let holdTimer = null;
  const endHold = () => { clearTimeout(holdTimer); holdTimer = null; clock.classList.remove("holding"); };
  clock.addEventListener("pointerdown", (e) => {
    clock.setPointerCapture(e.pointerId);
    clock.classList.add("holding");
    holdTimer = setTimeout(() => { endHold(); openPin(); }, 3000);
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => clock.addEventListener(ev, endHold));
  clock.addEventListener("contextmenu", (e) => e.preventDefault());

  let pin = "";
  const PIN_MAX = 8;
  function drawPin() {
    const dots = $("pinDots");
    dots.innerHTML = "";
    const n = Math.max(4, pin.length);
    for (let i = 0; i < n; i++) {
      const dot = document.createElement("i");
      if (i < pin.length) dot.className = "on";
      dots.appendChild(dot);
    }
  }
  function buildKeypad() {
    const kp = $("keypad");
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "cancel", "0", "ok"];
    keys.forEach((k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "key";
      if (k === "cancel") { b.textContent = "إلغاء"; b.classList.add("small"); }
      else if (k === "ok") { b.textContent = "دخول"; b.classList.add("small", "go"); }
      else b.textContent = k;
      b.addEventListener("click", () => {
        resetIdle();
        if (k === "cancel") return hide("pinLayer");
        if (k === "ok") return submitPin();
        if (pin.length < PIN_MAX) { pin += k; $("pinMsg").textContent = ""; drawPin(); }
      });
      kp.appendChild(b);
    });
  }
  function openPin() { pin = ""; $("pinMsg").textContent = ""; drawPin(); show("pinLayer"); }
  function submitPin() {
    if (!pin) return;
    if (!host) { hide("pinLayer"); show("adminLayer"); return; }
    send({ cmd: "unlock", pin });
  }
  function onUnlock(ok) {
    if (ok) { hide("pinLayer"); show("adminLayer"); return; }
    pin = "";
    drawPin();
    $("pinMsg").textContent = "الرمز غير صحيح";
    const dots = $("pinDots");
    dots.classList.remove("wrong"); void dots.offsetWidth; dots.classList.add("wrong");
  }
  document.querySelectorAll("[data-admin]").forEach((b) =>
    b.addEventListener("click", () => {
      const action = b.dataset.admin;
      send({ cmd: "admin", action });
      if (action === "reload") toast("أُعيد تحميل الإعدادات");
      if (action !== "edit" && action !== "folder") hide("adminLayer");
    }));

  // ---------------------------------------------------------------- layers, toast, idle reset
  function show(id) { $(id).hidden = false; const f = $(id).querySelector("button"); f && f.focus({ preventScroll: true }); }
  function hide(id) {
    $(id).hidden = true;
    if (id === "adminLayer") send({ cmd: "lock" });
  }
  document.querySelectorAll(".layer").forEach((layer) => {
    layer.addEventListener("click", (e) => {
      if (e.target === layer || e.target.closest("[data-close]")) hide(layer.id);
    });
  });

  let toastTimer = null;
  function toast(text, kind = "", ms = 2600) {
    const t = $("toast");
    t.textContent = text;
    t.className = "toast" + (kind ? " " + kind : "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), ms);
  }

  // After 90 s without a touch, put the screen back the way the next teacher expects it.
  let idleTimer = null;
  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      document.querySelectorAll(".layer").forEach((l) => { if (!l.hidden) hide(l.id); });
      if (input.value) { input.value = ""; applyFilter(); }
    }, 90000);
  }
  ["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, resetIdle, { passive: true }));

  // Keep the page from scrolling, zooming or being dragged around by palms on the board.
  document.addEventListener("dragstart", (e) => e.preventDefault());
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

  // ---------------------------------------------------------------- messages from the native window
  function onMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    switch (msg.type) {
      case "config":
        config = msg.config || { apps: [] };
        drives = msg.drives || [];
        renderGrid();
        renderUsb(false);
        tickClock();
        if (msg.error) toast("ملف الإعدادات فيه خطأ، أبلغي مشرفة الغرفة.", "warn", 8000);
        break;
      case "drives":
        drives = msg.drives || [];
        renderUsb((msg.added || []).length > 0);
        if ((msg.added || []).length && msg.opened) toast("وُصلت فلاشة، فتحتُ ملفاتها لك");
        break;
      case "result": onResult(msg); break;
      case "unlock": onUnlock(!!msg.ok); break;
      case "locked": hide("adminLayer"); break;
    }
  }

  // ---------------------------------------------------------------- start
  paintIcons();
  buildKeypad();
  tickClock();
  setInterval(tickClock, 1000);
  resetIdle();

  if (host) {
    host.addEventListener("message", (e) => onMessage(e.data));
    send({ cmd: "ready" });
  } else if (window.__previewConfig) {
    // design preview outside Windows
    onMessage({ type: "config", config: window.__previewConfig, drives: window.__previewDrives || [] });
  }
})();
