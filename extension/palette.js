// Self-contained: Chrome serializes this function for isolated-world injection.
export function mountPalette(tabs, floating = false, context = {}) {
  const newTab = context.newTab === true;
  const actionPopup = context.actionPopup === true;
  const existing = document.querySelector("[data-arc-command-palette]");
  if (existing) {
    existing.dispatchEvent(
      context.mode === "commands"
        ? new Event("arc-palette-commands")
        : context.mode === "edit"
          ? new CustomEvent("arc-palette-edit", {
              detail: context.sourceUrl || "",
            })
          : new Event("arc-palette-close"),
    );
    return;
  }
  const previousFocus = document.activeElement;
  const host = document.createElement("div");
  host.setAttribute("data-arc-command-palette", "");
  const root = host.attachShadow({ mode: "closed" });
  const shell = document.createElement("dialog");
  shell.setAttribute("aria-label", "Arc command bar");
  shell.style.cssText =
    "border:0;padding:0;margin:0;width:100vw;height:100vh;max-width:none;max-height:none;background:transparent;overflow:hidden;";
  if (actionPopup || newTab) {
    const style = document.createElement("style");
    style.textContent = "dialog::backdrop{background:transparent}";
    root.append(style);
  }
  const frame = document.createElement("iframe");
  frame.title = "Arc search";
  frame.style.cssText =
    "display:block;border:0;width:100%;height:100%;background:transparent;";
  shell.append(frame);
  root.append(shell);
  document.documentElement.append(host);
  let requestClose = () => {};
  let editCurrent = () => {};
  let openCommands = () => {};
  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    shell.close();
    host.remove();
    if (newTab) return;
    if (floating) window.close();
    else if (previousFocus?.isConnected) previousFocus.focus();
  }
  host.addEventListener("arc-palette-commands", () => openCommands());
  host.addEventListener("arc-palette-close", () => requestClose());
  host.addEventListener("arc-palette-edit", (event) =>
    editCurrent(event.detail),
  );
  shell.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestClose();
  });
  shell.showModal();
  // Frame events never traverse the page's window/document capture listeners.
  // Keep the final keyup in the frame before returning focus to the page.
  function showPalette(document) {
    // Keep Chrome's default font preferences rather than inheriting the website's typography.
    document.documentElement.style.cssText =
      "color-scheme:light dark;font-size:medium;font-family:sans-serif";
    document.documentElement.lang = navigator.language;
    const host = document.createElement("div");
    host.setAttribute("data-arc-command-palette", "");
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent =
      (context.designTokens || "") +
      `
      :host{all:initial;color-scheme:light dark}*{box-sizing:border-box}
      dialog{--bg:var(--arc-surface,Canvas);--fg:var(--arc-text,CanvasText);--muted:var(--arc-muted,GrayText);
      --hover:var(--arc-hover,color-mix(in srgb,CanvasText 7%,Canvas));--selection:var(--arc-selection,color-mix(in srgb,Highlight 17%,Canvas));--line:var(--arc-border,color-mix(in srgb,CanvasText 18%,Canvas));
      color-scheme:light dark;border:1px solid var(--line);border-radius:var(--arc-radius-panel,1rem);padding:0;width:min(600px,calc(100vw - 32px));
      height:min(420px,calc(100vh - 32px));max-height:calc(100vh - 32px);margin:auto;background:var(--bg);color:var(--fg);box-shadow:0 20px 64px #0006,0 2px 8px #0002;
      display:flex;flex-direction:column;
      font:.875rem/1.45 var(--arc-font,system-ui);overflow:hidden}
      dialog::backdrop{background:#0005}
      input{font:inherit;font-size:1.1875rem;width:100%;padding:17px 18px;border:0;outline:none;color:var(--fg);background:transparent}
      [hidden]{display:none!important}#note-body{display:block;resize:none;width:100%;height:220px;min-height:80px;max-height:45vh;border:0;border-top:1px solid var(--line);outline:none;padding:14px 22px;font:inherit;line-height:1.7;background:Canvas;color:CanvasText}#note-body:focus-visible{box-shadow:inset 0 0 0 1px Highlight}dialog[data-sized] #note-body{flex:1;max-height:none;height:auto}button.result[data-shortcut=true] .url{white-space:normal;line-height:1.45}button.result[data-shortcut=true]>kbd{max-width:38%;white-space:normal;text-align:right}
      #results{flex:1;min-height:0;padding:6px 8px;max-height:none;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;border-top:1px solid var(--line)}
      dialog input,dialog footer,dialog #error{flex-shrink:0}
      button{font:inherit;color:inherit;cursor:pointer}button.result{display:flex;align-items:center;gap:10px;width:100%;border:0;
      border-radius:var(--arc-radius-row,.625rem);background:transparent;text-align:left;padding:8px 11px}button.result:hover{background:var(--hover)}button.result[aria-selected=true]{background:var(--selection);outline:1px solid color-mix(in srgb,Highlight 22%,transparent);outline-offset:-1px}
      button.result[data-marked=true]{box-shadow:inset 3px 0 Highlight}
      .result[data-group-color]{border-left:3px solid var(--group-color)}
      [data-group-color=grey]{--group-color:#80868b}[data-group-color=blue]{--group-color:#4285f4}
      [data-group-color=red]{--group-color:#ea4335}[data-group-color=yellow]{--group-color:#fbbc04}
      [data-group-color=green]{--group-color:#34a853}[data-group-color=pink]{--group-color:#e871bd}
      [data-group-color=purple]{--group-color:#a142f4}[data-group-color=cyan]{--group-color:#24c1e0}
      [data-group-color=orange]{--group-color:#fa903e}
      .group-badge{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;padding:1px 7px;margin:0;border-radius:6px;font-size:.6875rem;color:CanvasText;background:color-mix(in srgb,var(--group-color) 12%,Canvas);border:1px solid color-mix(in srgb,var(--group-color) 35%,Canvas)}
      .group-badge::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--group-color);margin-right:6px;vertical-align:middle}
      .metadata{display:flex;min-width:0;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:5px;max-width:34%;flex-shrink:0}.group-badge{margin:0}.result{position:relative}.result[data-section]{margin-top:23px}.section-label{position:absolute;left:10px;top:-20px;color:var(--muted);font-size:.6875rem;font-weight:600;pointer-events:none}
      .source-badge{--source-color:#526174;display:inline-flex;align-items:center;gap:5px;padding:1px 5px;border-radius:5px;font-size:.6875rem;color:var(--muted);background:transparent;border:1px solid transparent}
      .source-badge::before{flex:none;content:'';width:6px;height:6px;border-radius:50%;background:var(--source-color)}
      [data-source=tab]{--source-color:#3685ec}[data-source=bookmark]{--source-color:#be8500}
      [data-source=history]{--source-color:#a16be0}[data-source=domain]{--source-color:#168e70}
      [data-source=site]{--source-color:#1495a8}[data-source=command],[data-source=browser-page]{--source-color:#7b8795}
      [data-source=closed]{--source-color:#d77940}
      [data-source=navigate]{--source-color:#6373dc}[data-source=move]{--source-color:#657d98}
      [data-source=ai-draft]{--source-color:#d46676}[data-source=bookmark-folder]{--source-color:#be8500}
      [data-source=group]{--source-color:#b75cb0}[data-source=quicklink],[data-source=quicklink-save]{--source-color:#c0784d}[data-source=calculator]{--source-color:#27a189}[data-source=note]{--source-color:#8a9b3c}[data-source=shortcut]{--source-color:#73859b}[data-source=activity]{--source-color:#748795}[data-source=result-action]{--source-color:#7b8795}
      @media (forced-colors:active){.source-badge{border-color:CanvasText}.source-badge::before{background:CanvasText}}
      .icon{position:relative;width:var(--arc-icon-tile,1.75rem);height:var(--arc-icon-tile,1.75rem);border-radius:var(--arc-radius-control,.5rem);background:var(--hover);display:grid;place-items:center;flex-shrink:0}
      .icon svg,#resize svg{width:var(--arc-icon-size,1.0625rem);height:var(--arc-icon-size,1.0625rem);display:block}
      .icon img{width:18px;height:18px;object-fit:contain;border-radius:3px}
      .icon:has(img)>.icon-symbol{display:none}
      .tab-mark{display:none;position:absolute;right:-3px;bottom:-3px;padding:1px;background:Canvas;border-radius:4px;color:CanvasText}
      .tab-mark svg{width:12px;height:12px}
      .icon:hover .tab-mark,.icon[data-marked=true] .tab-mark{display:block}
      #resize svg{margin:auto;width:13px;height:13px}
      .text{min-width:0;flex:1}.title{font-weight:600}.title,.url{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .url:empty{display:none}.url{font-size:.75rem;color:var(--muted)}.hint{font-size:.625rem;color:var(--muted);flex-shrink:0}
      kbd{font:inherit;font-size:.6875rem;border:1px solid var(--line);border-radius:4px;padding:1px 4px;white-space:nowrap}.footer-action{flex-shrink:0;border:0;background:transparent;display:flex;align-items:center;gap:5px;font-size:.6875rem;padding:2px;color:var(--fg)}.footer-action:hover{color:Highlight}.footer-main{display:flex;align-items:center;gap:6px;min-width:0}.footer-status{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}footer{display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:grab;touch-action:none;user-select:none;padding:12px 22px;color:var(--muted);font-size:.6875rem;border-top:1px solid var(--line)}
      footer.dragging{cursor:grabbing}
      dialog[data-sized]{display:flex;flex-direction:column}
      dialog[data-sized] #results{flex:1;min-height:0;max-height:none}
      #resize{position:absolute;right:3px;bottom:3px;width:20px;height:20px;padding:0;border:0;background:transparent;color:GrayText;cursor:nwse-resize;touch-action:none}
      #error{margin:0;padding:8px 16px;color:#b3261e;font-size:.75rem;overflow-wrap:anywhere}
      #error:empty,#results:empty{display:none}
      button:focus-visible{outline:2px solid Highlight;outline-offset:-2px}
      @media (max-width:480px){
        dialog{width:calc(100vw - 20px);border-radius:14px}
        input{padding:14px 12px;font-size:1rem}
        button.result{gap:8px;padding:7px 8px}
        .metadata{max-width:30%;min-width:0}
        .source-badge{font-size:.625rem;white-space:nowrap;padding-inline:2px}
        .group-badge{font-size:.625rem}
        footer{padding:8px 24px 8px 10px}
      }
      @media (max-width:340px){
        .metadata{display:none}
      }
      @media (max-height:420px){
        dialog{height:calc(100vh - 16px);max-height:calc(100vh - 16px)}
      }
      @media(prefers-color-scheme:dark){#error{color:#f2b8b5}}
      @media(prefers-contrast:more){dialog{--line:CanvasText}.url,.hint,footer{color:CanvasText}}
      @media(forced-colors:active){button.result[aria-selected=true]{background:Highlight;color:HighlightText}
        button.result[aria-selected=true] .url,button.result[aria-selected=true] .hint{color:HighlightText}}
      `;
    root.append(style);
    if (newTab) {
      const tabStyle = document.createElement("style");
      tabStyle.textContent = "dialog::backdrop{background:transparent}";
      root.append(tabStyle);
    }
    if (actionPopup) {
      const popupStyle = document.createElement("style");
      popupStyle.textContent = `
        dialog{inset:0;margin:0;width:100vw;height:100vh;max-width:none;max-height:none;
          border:0;border-radius:0;box-shadow:none;display:flex;flex-direction:column}
        dialog::backdrop{background:transparent}
        input{padding:15px 17px;font-size:1.125rem}
        #results{flex:1;min-height:0;max-height:none;scrollbar-width:thin;padding:6px 8px}
        #results[hidden]{display:none}
        #note-body:not([hidden]){flex:1;min-height:0;max-height:none}
        #error:empty{display:none}
        footer{padding:9px 14px;cursor:default}
        input,footer,#error{flex-shrink:0}
      `;
      root.append(popupStyle);
    }
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-label", "Search tabs or the web");
    const input = document.createElement("input");
    input.placeholder = "Search tabs or enter a URL…";
    input.maxLength = 8192;
    input.setAttribute("aria-label", "Search tabs or enter a URL");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", "results");
    input.setAttribute("aria-expanded", "true");
    const results = document.createElement("div");
    results.id = "results";
    results.setAttribute("role", "listbox");
    const noteBody = document.createElement("textarea");
    noteBody.id = "note-body";
    noteBody.hidden = true;
    noteBody.maxLength = 20000;
    noteBody.placeholder = "Write your note…";
    noteBody.setAttribute("aria-label", "Note text");
    const error = document.createElement("p");
    error.id = "error";
    error.setAttribute("role", "status");
    const footer = document.createElement("footer");
    footer.textContent =
      "↑ ↓ select · Tab complete address · Enter open · Esc return";
    // Draw bundled icons with currentColor so page fonts and network access are irrelevant.
    const iconPaths = {
      tab: "M4 5h16v14H4z M4 9h16 M7 7h2",
      bookmark: "M6 4h12v16l-6-4-6 4z",
      history: "M12 5a7 7 0 1 0 7 7 7 7 0 0 0-7-7z M12 8v4l3 2",
      domain: "M3 11l9-7 9 7 M6 10v10h12V10 M10 20v-6h4v6",
      navigate: "M7 17 17 7 M8 7h9v9",
      command: "m9 6 6 6-6 6",
      closed: "M9 7 5 11l4 4 M5 11h9a5 5 0 0 1 0 10",
      site: "M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M15 15l5 5",
      move: "M4 12h16 M8 8l-4 4 4 4 M16 8l4 4-4 4",
      settings: "M5 6h14 M5 12h14 M5 18h14 M9 4v4 M15 10v4 M10 16v4",
      calculator: "M7 4h10v16H7z M10 8h4 M10 12h1 M13 12h1 M10 16h1 M13 16h1",
      note: "M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5",
      keyboard: "M3 6h18v12H3z M6 10h1 M11 10h1 M16 10h1 M7 14h10",
      folder: "M3 7h7l2 2h9v11H3z",
      mark: "M5 5h14v14H5z",
      checked: "M5 5h14v14H5z M8 12l3 3 5-6",
      resize: "M10 19l9-9 M15 19l4-4",
    };
    const resultIcons = {
      "order-tab": "tab",
      "browser-page": "settings",
      "site-query": "site",
      "ai-draft": "closed",
      quicklink: "navigate",
      "quicklink-save": "bookmark",
      "bookmark-folder": "folder",
      activity: "history",
      "note-save": "note",
      shortcut: "keyboard",
    };
    function drawIcon(name) {
      const namespace = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(namespace, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      const path = document.createElementNS(namespace, "path");
      path.setAttribute("d", iconPaths[name] || iconPaths.command);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "1.7");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.append(path);
      return svg;
    }
    const resizeHandle = document.createElement("button");
    resizeHandle.id = "resize";
    resizeHandle.type = "button";
    resizeHandle.append(drawIcon("resize"));
    resizeHandle.setAttribute("aria-label", "Resize Spotlight");
    resizeHandle.title =
      "Drag corner to resize · Arrow keys when focused · Enter reset size";
    const sites = Array.isArray(context.sites) ? context.sites : [];
    footer.title =
      "Drag to move · Ctrl+Alt+arrows move · Shift for larger steps · Ctrl+Alt+0 reset";
    footer.id = "hints";
    input.setAttribute("aria-describedby", "hints");
    dialog.append(input, noteBody, results, error, footer);
    if (!actionPopup) dialog.append(resizeHandle);
    root.append(dialog);
    document.documentElement.append(host);
    let positioned = false;
    let customSize = null;
    let drag = null;
    let suppressDragClick = false;
    const view = document.defaultView;
    function applyGeometry(values) {
      for (const [property, value] of Object.entries(values))
        if (dialog.style[property] !== value) dialog.style[property] = value;
    }
    function place(left, top) {
      const bounds = dialog.getBoundingClientRect();
      const x = Math.max(
        16,
        Math.min(left, view.innerWidth - bounds.width - 16),
      );
      const y = Math.max(
        16,
        Math.min(top, view.innerHeight - bounds.height - 16),
      );
      applyGeometry({
        position: "fixed",
        margin: "0px",
        left: `${x}px`,
        top: `${y}px`,
        right: "auto",
        bottom: "auto",
      });
      positioned = true;
    }
    function move(dx, dy) {
      const bounds = dialog.getBoundingClientRect();
      place(bounds.left + dx, bounds.top + dy);
    }
    function resize(width, height) {
      const maxWidth = Math.min(1000, view.innerWidth - 32),
        maxHeight = Math.min(800, view.innerHeight - 32);
      const bounds = dialog.getBoundingClientRect();
      customSize = {
        width: Math.max(Math.min(360, maxWidth), Math.min(width, maxWidth)),
        height: Math.max(Math.min(220, maxHeight), Math.min(height, maxHeight)),
      };
      if (!dialog.hasAttribute("data-sized")) dialog.dataset.sized = "";
      applyGeometry({
        width: `${customSize.width}px`,
        height: `${customSize.height}px`,
        maxHeight: "none",
      });
      place(bounds.left, bounds.top);
    }
    function resetSize() {
      customSize = null;
      delete dialog.dataset.sized;
      dialog.style.removeProperty("width");
      dialog.style.removeProperty("height");
      dialog.style.removeProperty("max-height");
      keepVisible();
    }
    function resetPosition() {
      customSize = null;
      delete dialog.dataset.sized;
      dialog.removeAttribute("style");
      positioned = false;
    }
    document.addEventListener(
      "pointerdown",
      () => {
        suppressDragClick = false;
      },
      true,
    );
    function beginPointer(event, kind) {
      if (event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      const bounds = dialog.getBoundingClientRect();
      drag = {
        id: event.pointerId,
        kind,
        x: event.clientX,
        y: event.clientY,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      footer.classList.add("dragging");
    }
    footer.addEventListener("pointerdown", (event) => {
      if (!actionPopup && !event.target.closest("button"))
        beginPointer(event, "move");
    });
    resizeHandle.addEventListener("pointerdown", (event) =>
      beginPointer(event, "resize"),
    );
    // Track the frame document too: modal backdrop retargeting can bypass the handle.
    document.addEventListener("pointermove", (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      if (
        Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) >
        3
      )
        drag.moved = true;
      if (drag.kind === "resize")
        resize(
          drag.width + event.clientX - drag.x,
          drag.height + event.clientY - drag.y,
        );
      else
        place(
          drag.left + event.clientX - drag.x,
          drag.top + event.clientY - drag.y,
        );
    });
    function stopDrag(event) {
      if (event.type === "pointerup" && drag?.moved) suppressDragClick = true;
      drag = null;
      footer.classList.remove("dragging");
    }
    dialog.addEventListener(
      "click",
      (event) => {
        if (suppressDragClick) {
          suppressDragClick = false;
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );
    document.addEventListener("pointerup", stopDrag, true);
    document.addEventListener("pointercancel", stopDrag, true);
    view.addEventListener("blur", () => stopDrag({ type: "blur" }));
    function keepVisible() {
      if (customSize) {
        resize(customSize.width, customSize.height);
        return;
      }
      if (positioned) {
        const bounds = dialog.getBoundingClientRect();
        place(bounds.left, bounds.top);
      }
    }
    let layoutFrame = 0;
    function scheduleKeepVisible() {
      if (layoutFrame || dismissed) return;
      layoutFrame = view.requestAnimationFrame(() => {
        layoutFrame = 0;
        if (!dismissed) keepVisible();
      });
    }
    view.addEventListener("resize", scheduleKeepVisible);
    // Observer notifications only schedule work; geometry writes happen in the next frame.
    const sizeObserver = new view.ResizeObserver(scheduleKeepVisible);
    sizeObserver.observe(dialog);
    view.addEventListener(
      "pagehide",
      () => {
        view.cancelAnimationFrame(layoutFrame);
        sizeObserver.disconnect();
      },
      { once: true },
    );
    let scope = context.activeGroupId >= 0 ? "group" : "window";
    let routeUrl = "";
    function toggleScope() {
      if (!(context.activeGroupId >= 0))
        throw new Error("Open a tab in a group first");
      scope = scope === "group" ? "window" : "group";
      setMode(
        "search",
        mode === "actions"
          ? actionReturn.value
          : mode === "search"
            ? input.value
            : "",
      );
      notice = scope === "group" ? "Tabs in this group" : "Tabs in this window";
      render();
    }
    let mode = ["edit", "commands"].includes(context.mode)
      ? context.mode
      : "search";
    openCommands = () => setMode("commands");
    let orderTabId;
    const markedTabs = new Set();
    let groupTargetIds = [];
    let bookmarkTargetIds = [];
    let bookmarkOperation = "add";
    let notice = "";
    let actionTarget = null,
      actionReturn = null,
      actionIds = [];
    let providerQuery = "",
      lastSearchQuery = "",
      providerReturn = null,
      quicklinkReturn = null;
    let quicklinkTarget = null;
    let noteDraft = null,
      noteDirty = false,
      shortcutsReturn = null;
    let footerDescription = "";
    let returnKey = null;
    const modifierLabel = /Mac|iPhone|iPad/.test(navigator.platform)
      ? "⌘"
      : "Ctrl";
    function shortcutLabel(value) {
      return value
        .replaceAll("⌘/Ctrl", modifierLabel)
        .replaceAll("Alt", modifierLabel === "⌘" ? "⌥" : "Alt");
    }
    const actionDefinitions = Array.isArray(context.actions)
      ? context.actions
      : [];
    const shortcutDefinitions = Array.isArray(context.shortcuts)
      ? context.shortcuts
      : [];
    function choiceKey(choice) {
      return (
        choice &&
        `${choice.kind}:${choice.shortcutId ?? choice.noteId ?? choice.activityId ?? choice.linkId ?? choice.actionId ?? choice.folderId ?? choice.groupId ?? choice.color ?? choice.action ?? choice.draftId ?? choice.beforeTabId ?? choice.placement ?? choice.tabId ?? choice.site ?? choice.command ?? choice.sessionId ?? choice.id ?? choice.url}`
      );
    }
    function webUrl(value) {
      try {
        const url = new URL(value);
        return (
          ["http:", "https:"].includes(url.protocol) &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    }
    function startProviders(query = input.value) {
      const inline = query.match(/^([\p{L}\d.-]{1,32})\s+(.+)$/su);
      providerQuery = (
        inline && siteMatches(inline[1], true).length ? inline[2] : query
      ).trim();
      if (!providerQuery) {
        error.textContent = "Type a query first";
        return;
      }
      providerReturn =
        mode === "actions"
          ? actionReturn
          : {
              mode: mode === "commands" ? "search" : mode,
              value: mode === "commands" ? lastSearchQuery : query,
              orderTabId,
            };
      setMode("providers");
    }
    function startQuicklink(target = choices[selected]) {
      const tabId =
        target?.kind === "tab"
          ? target.id
          : target?.kind === "order-tab"
            ? target.tabId
            : undefined;
      const url = target?.url || context.sourceUrl;
      if (!webUrl(url)) {
        error.textContent = "Choose a web page to save as a quicklink";
        return;
      }
      quicklinkReturn =
        mode === "actions"
          ? actionReturn
          : { mode, value: input.value, orderTabId };
      quicklinkTarget = {
        url,
        ...(tabId !== undefined ? { tabId } : {}),
        ...(target?.linkId ? { id: target.linkId } : {}),
      };
      setMode(
        "quicklink-name",
        (target?.linkName || target?.title || "Quicklink").slice(0, 80),
      );
      input.select();
    }
    function openActions() {
      if (busy) return;
      if (mode === "actions") {
        leaveActions();
        return;
      }
      if (
        !choices[selected] &&
        suggestionsPending &&
        (mode !== "search" || input.value.trim())
      )
        return;
      actionTarget = mode === "note-editor" ? null : choices[selected] || null;
      actionReturn = {
        mode,
        value: input.value,
        placeholder: input.placeholder,
        maxLength: input.maxLength,
        orderTabId,
        suggestions: suggestions.slice(),
        domains: domains.slice(),
        completedAddress,
      };
      actionIds = markedTabs.size
        ? [...markedTabs]
        : actionTarget?.kind === "tab"
          ? [actionTarget.id]
          : actionTarget?.kind === "order-tab"
            ? [actionTarget.tabId]
            : [];
      setMode("actions");
    }
    function leaveActions() {
      if (!actionReturn) {
        setMode("search");
        return;
      }
      returnKey = choiceKey(actionTarget);
      setMode(actionReturn.mode, actionReturn.value, actionReturn.orderTabId);
    }
    function availableActions() {
      const page = webUrl(actionTarget?.url),
        query = actionReturn?.value.trim();
      return actionDefinitions
        .map((action) =>
          action.id === "open"
            ? { ...action, title: primaryLabel(actionTarget) }
            : action,
        )
        .sort((a, b) => Number(b.id === "open") - Number(a.id === "open"))
        .filter((action) => {
          if (action.id === "open") return Boolean(actionTarget);
          if (["edit-note", "copy-note", "remove-note"].includes(action.id))
            return actionTarget?.kind === "note";
          if (action.id === "save-note")
            return actionReturn?.mode === "note-editor" && Boolean(noteDraft);
          if (["new", "background"].includes(action.id))
            return (
              page || ["navigate", "site-query"].includes(actionTarget?.kind)
            );
          if (["copy-tabs", "copy-markdown"].includes(action.id))
            return actionIds.length > 0;
          if (["preview", "route", "remove-route"].includes(action.id))
            return page;
          if (action.id === "hide")
            return (
              page &&
              ["history", "bookmark", "domain"].includes(actionTarget?.kind)
            );
          if (action.id === "instant")
            return (
              Boolean(query) &&
              actionReturn?.mode === "search" &&
              actionTarget?.kind === "navigate"
            );
          if (action.id === "toggle-search-scope")
            return context.activeGroupId >= 0;
          if (action.id === "paste-url") return actionReturn?.mode === "search";
          if (action.id === "copy")
            return page || Boolean(actionTarget?.copyText);
          if (
            ["group", "ungroup", "bookmark", "remove-bookmark"].includes(
              action.id,
            )
          )
            return actionIds.length > 0;
          if (["move", "duplicate"].includes(action.id))
            return actionIds.length === 1;
          if (action.id === "save-link") return page && !actionTarget?.linkId;
          if (["rename-link", "remove-link"].includes(action.id))
            return Boolean(actionTarget?.linkId);
          if (action.id === "provider")
            return (
              Boolean(query) &&
              (["search", "edit"].includes(actionReturn?.mode) ||
                actionReturn?.mode.startsWith("site:"))
            );
          return true;
        });
    }
    async function runAction(id) {
      const revision = queryRevision;
      if (id === "toggle-search-scope") {
        toggleScope();
        return;
      }
      if (id === "route") {
        routeUrl = actionTarget.url;
        setMode("group-route");
        return;
      }
      if (id === "preview" || id === "remove-route") {
        const reply = await chrome.runtime.sendMessage({
          type: "palette:extra",
          action: id === "preview" ? "preview" : "route",
          url: actionTarget.url,
          groupId: null,
        });
        if (!reply?.ok) throw new Error(reply?.error || "Action failed");
        if (dismissed || closing || revision !== queryRevision) return;
        if (id === "preview") close();
        else {
          leaveActions();
          notice = "Domain route cleared";
          render();
        }
        return;
      }
      if (
        ["copy-tabs", "copy-markdown", "hide", "paste-url", "instant"].includes(
          id,
        )
      ) {
        let clipboardUrl;
        if (id === "paste-url") {
          try {
            clipboardUrl = (await window.navigator.clipboard.readText()).trim();
          } catch {
            setMode("paste-url");
            return;
          }
        }
        const action = id.startsWith("copy-") ? "copy-tabs" : id;
        const reply = await chrome.runtime.sendMessage({
          type: "palette:extra",
          action,
          tabIds: actionIds,
          markdown: id === "copy-markdown",
          url: id === "hide" ? actionTarget.url : clipboardUrl,
          query: id === "instant" ? actionReturn.value : undefined,
        });
        if (!reply?.ok) throw new Error(reply?.error || "Action failed");
        if (dismissed || closing || revision !== queryRevision) return;
        if (reply.copyText) {
          await copyText(reply.copyText);
          leaveActions();
          notice = "Links copied";
          render();
        } else if (id === "hide") {
          returnKey = null;
          setMode("search", actionReturn.value);
        } else close();
        return;
      }
      if (id === "new-note") {
        startNote();
        return;
      }
      if (id === "notes") {
        setMode("notes");
        return;
      }
      if (id === "commands") {
        setMode("commands");
        return;
      }
      if (id === "shortcuts") {
        shortcutsReturn =
          mode === "actions"
            ? actionReturn
            : { mode, value: input.value, orderTabId };
        setMode("shortcuts");
        return;
      }
      if (id === "edit-note") {
        await openNote(actionTarget.noteId);
        return;
      }
      if (id === "save-note") {
        await saveNote();
        return;
      }
      if (id === "copy-note") {
        const reply = await chrome.runtime.sendMessage({
          type: "palette:note",
          operation: "get",
          id: actionTarget.noteId,
        });
        if (!reply?.ok) throw Error(reply?.error || "Could not read note");
        if (dismissed || closing || revision !== queryRevision) return;
        await copyText(reply.note.body || reply.note.title);
        if (dismissed || closing || revision !== queryRevision) return;
        leaveActions();
        notice = "Note copied";
        render();
        return;
      }
      if (id === "remove-note") {
        const reply = await chrome.runtime.sendMessage({
          type: "palette:note",
          operation: "remove",
          id: actionTarget.noteId,
          revision: actionTarget.revision,
        });
        if (!reply?.ok) throw Error(reply?.error || "Could not delete note");
        if (dismissed || closing || revision !== queryRevision) return;
        setMode("notes");
        notice = "Note deleted";
        render();
        return;
      }
      if (id === "group") {
        startGrouping();
        return;
      }
      if (id === "ungroup") {
        await performGroup({ action: "remove", tabIds: selectedTabIds() });
        return;
      }
      if (id === "manage-groups") {
        setMode("group-manage");
        return;
      }
      if (id === "bookmark" || id === "remove-bookmark") {
        startBookmarks(id === "bookmark" ? "add" : "remove");
        return;
      }
      if (id === "move") {
        setMode("order", "", actionIds[0]);
        return;
      }
      if (id === "save-link" || id === "rename-link") {
        startQuicklink(actionTarget);
        return;
      }
      if (id === "provider") {
        startProviders(actionReturn.value);
        return;
      }
      if (id === "copy") {
        await copyText(actionTarget.copyText ?? actionTarget.url);
        if (dismissed || closing || revision !== queryRevision) return;
        leaveActions();
        notice = "Copied";
        render();
        return;
      }
      const message =
        id === "remove-link"
          ? {
              type: "palette:quicklink",
              operation: "remove",
              id: actionTarget.linkId,
            }
          : id === "duplicate"
            ? {
                type: "palette:tab-action",
                action: "duplicate",
                tabId: actionIds[0],
              }
            : null;
      if (message) {
        const reply = await chrome.runtime.sendMessage(message);
        if (!reply?.ok) throw Error(reply?.error || "Action failed");
        if (dismissed || closing || revision !== queryRevision) return;
        setMode(id === "remove-link" ? "quicklinks" : "search");
        notice = id === "remove-link" ? "Quicklink removed" : "Tab duplicated";
        render();
      }
    }

    function startNote() {
      noteDraft = { title: "", body: "" };
      noteDirty = false;
      noteBody.value = "";
      setMode("note-editor");
    }
    async function openNote(id) {
      const revision = queryRevision;
      const reply = await chrome.runtime.sendMessage({
        type: "palette:note",
        operation: "get",
        id,
      });
      if (!reply?.ok) throw Error(reply?.error || "Could not read note");
      if (dismissed || closing || revision !== queryRevision) return;
      noteDraft = { ...reply.note };
      noteDirty = false;
      noteBody.value = noteDraft.body;
      setMode("note-editor", noteDraft.title);
    }
    async function saveNote() {
      if (!noteDraft) throw Error("Choose a note first");
      const revision = queryRevision;
      const reply = await chrome.runtime.sendMessage({
        type: "palette:note",
        operation: "save",
        ...noteDraft,
      });
      if (!reply?.ok) throw Error(reply?.error || "Could not save note");
      if (dismissed || closing || revision !== queryRevision) return;
      noteDirty = false;
      setMode("notes");
      noteDraft = null;
      notice = "Note saved";
      render();
    }
    function submitNote() {
      if (busy) return;
      busy = true;
      error.textContent = "";
      saveNote()
        .catch((failure) => {
          error.textContent = failure.message;
        })
        .finally(() => {
          busy = false;
        });
    }
    function shortcutRows(query, omit = new Set()) {
      const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
      return shortcutDefinitions
        .filter(
          (row) =>
            !omit.has(row.id) &&
            terms.every((term) =>
              `${row.title} ${row.description} ${row.aliases || ""} ${row.shortcut}`
                .toLocaleLowerCase()
                .includes(term),
            ),
        )
        .map((row) => ({
          kind: "shortcut",
          shortcutId: row.id,
          title: row.title,
          url: "",
          description: row.description,
          shortcut: row.shortcut,
          copyText: `${row.title}\n${shortcutLabel(row.shortcut)}\n${row.description}`,
          sources: ["shortcut"],
          section: "Keyboard shortcuts",
        }));
    }
    let managedGroupId;
    let completedAddress = null;
    let suggestionsPending = false;
    let pendingQuery = Promise.resolve();
    let finishPending = () => {};
    let selected = 0;
    let selectionMoved = false;
    let choices = [];
    let busy = false;
    let moving = false;
    const moveQueue = [];
    const icons = new Map();
    async function decorateIcons() {
      if (!context.favicons) return;
      const urls = [
        ...new Set(
          choices
            .filter((choice) =>
              ["tab", "bookmark", "history", "quicklink"].includes(choice.kind),
            )
            .map((choice) => choice.url)
            .filter((url) => webUrl(url)),
        ),
      ].slice(0, 20);
      const missing = urls.filter((url) => !icons.has(url));
      for (const url of missing) icons.set(url, null);
      if (missing.length) {
        try {
          const reply = await chrome.runtime.sendMessage({
            type: "palette:icons",
            urls: missing,
          });
          if (reply?.ok)
            missing.forEach((url, index) => {
              const data = reply.images?.[index];
              if (
                typeof data === "string" &&
                data.startsWith("data:image/png;base64,") &&
                data.length < 90000
              )
                icons.set(url, data);
            });
        } catch {}
      }
      if (dismissed || closing) return;
      while (icons.size > 100) icons.delete(icons.keys().next().value);
      [...results.children].forEach((row, index) => {
        const choice = choices[index];
        if (
          !choice ||
          !["tab", "bookmark", "history", "quicklink"].includes(choice.kind)
        )
          return;
        const data = icons.get(choice.url);
        const icon = row.querySelector(".icon");
        if (!data || !icon || icon.querySelector("img")) return;
        const image = document.createElement("img");
        image.alt = "";
        image.addEventListener("error", () => image.remove(), { once: true });
        image.src = data;
        icon.append(image);
      });
    }
    let queryRevision = 0;
    let timer;
    let searchPort;
    function disconnectSearch() {
      searchPort?.disconnect();
      searchPort = undefined;
    }
    let suggestions = [];
    let domains = [];
    let learnedProvider;
    let recoveredRoute;
    const labels = {
      tab: "Open tab",
      bookmark: "Bookmark",
      history: "History",
      domain: "Homepage · New tab",
      command: "Command",
      closed: "Restore session",
      site: "Site search",
      "browser-page": "Chrome page",
      navigate: "Open / Search",
      move: "Tab placement",
      "ai-draft": "Saved AI prompt",
      "bookmark-folder": "Bookmark folder",
      group: "Tab group",
      quicklink: "Quicklink",
      calculator: "Calculator",
      "result-action": "Action",
      "quicklink-save": "Quicklink",
      activity: "Recent action",
      note: "Note",
      "note-save": "Note",
      shortcut: "Shortcut",
    };
    const heldKeys = new Set();
    let closing = false;
    function close() {
      if (newTab) {
        setMode("search");
        return;
      }
      moveQueue.length = 0;
      disconnectSearch();
      clearTimeout(timer);
      finishPending();
      queryRevision++;
      if (heldKeys.size) {
        closing = true;
        return;
      }
      dismiss();
    }
    document.addEventListener(
      "keydown",
      (event) => heldKeys.add(event.code || event.key),
      true,
    );
    document.addEventListener(
      "keyup",
      (event) => {
        heldKeys.delete(event.code || event.key);
        if (closing && !heldKeys.size) dismiss();
      },
      true,
    );
    document.defaultView.addEventListener("blur", () => {
      heldKeys.clear();
      if (closing) dismiss();
    });
    requestClose = close;
    function siteMatches(value, exact = false) {
      const query = value.trim().toLocaleLowerCase();
      if (!/^[\p{L}\d.-]{1,32}$/u.test(query)) return [];
      return sites
        .map((site) => {
          const aliases = [site.key, ...(site.aliases || [])].map((alias) =>
            alias.toLocaleLowerCase(),
          );
          let score = (site.learnedAliases || []).includes(query)
            ? 120
            : aliases.includes(query)
              ? 100
              : aliases.some((alias) => alias.startsWith(query))
                ? 70
                : 0;
          if (!score && query.length <= 4) {
            const name = site.name
              .toLocaleLowerCase()
              .replace(/[^\p{L}\d]/gu, "");
            let index = 0;
            for (const char of name) if (char === query[index]) index++;
            if (index === query.length) score = 30;
          }
          return { site, score };
        })
        .filter((item) =>
          exact || query.length === 1 ? item.score >= 100 : item.score,
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    }
    function enterSite(site, alias = input.value, value = "") {
      // Remember only an explicitly chosen site association, not browsing activity or search queries.
      if (alias.trim())
        chrome.runtime
          .sendMessage({ type: "palette:remember-site", site: site.key, alias })
          .catch(() => {});
      setMode(`site:${site.key}`, value);
    }
    function selectedTabIds(useCurrentTab = false) {
      if (mode === "actions" && actionIds.length) return actionIds;
      if (markedTabs.size) return [...markedTabs];
      const choice = useCurrentTab ? null : choices[selected];
      const id =
        choice?.kind === "order-tab"
          ? choice.tabId
          : choice?.kind === "tab"
            ? choice.id
            : newTab
              ? context.actionTabId
              : context.sourceTabId;
      if (!Number.isInteger(id))
        throw new Error("Choose an open tab or mark tabs with Shift+Space");
      return [id];
    }
    function markTab(id) {
      if (busy) return;
      notice = "";
      if (markedTabs.has(id)) markedTabs.delete(id);
      else if (markedTabs.size < 100) markedTabs.add(id);
      else {
        error.textContent = "Select at most 100 tabs";
        return;
      }
      render();
    }
    function startBookmarks(
      operation = "add",
      value = "",
      useCurrentTab = false,
    ) {
      if (mode !== "bookmark-folders")
        bookmarkTargetIds = selectedTabIds(useCurrentTab);
      bookmarkOperation = operation;
      setMode("bookmark-folders", value);
    }
    async function performBookmark(folderId, revision) {
      const response = await chrome.runtime.sendMessage({
        type: "palette:bookmark",
        operation: bookmarkOperation,
        tabIds: bookmarkTargetIds,
        folderId,
      });
      if (!response?.ok)
        throw new Error(response?.error || "Could not change bookmarks");
      if (dismissed || closing || revision !== queryRevision) return;
      const action = bookmarkOperation === "add" ? "Saved" : "Removed";
      markedTabs.clear();
      bookmarkTargetIds = [];
      setMode("search");
      notice = `${action} ${response.changed ?? 0}${response.skipped ? ` · ${response.skipped} already saved` : ""} · ${response.folderPath || "Selected folder"}`;
      render();
    }
    function startGrouping(value = "", useCurrentTab = false) {
      groupTargetIds = selectedTabIds(useCurrentTab);
      managedGroupId = undefined;
      setMode("groups", value);
    }
    async function performGroup(message, revision = queryRevision) {
      const response = await chrome.runtime.sendMessage({
        type: "palette:group",
        ...message,
      });
      if (!response?.ok)
        throw new Error(response?.error || "Could not change group");
      if (dismissed || closing || revision !== queryRevision) return;
      markedTabs.clear();
      groupTargetIds = [];
      if (message.action === "switch") close();
      else setMode("search");
    }
    function setMode(
      next,
      value = "",
      tabId,
      preferredId,
      keepResults = false,
    ) {
      if (!keepResults) {
        moveQueue.length = 0;
        notice = "";
      }
      if (
        mode === "search" &&
        !["search", "edit"].includes(next) &&
        !">@<?$#*:".includes(input.value[0] || "\0")
      )
        lastSearchQuery = input.value;
      orderTabId = next === "order" ? tabId : undefined;
      mode = next;
      completedAddress = null;
      input.maxLength = ["quicklink-name", "note-editor"].includes(mode)
        ? 80
        : 8192;
      if (mode !== "search" || value !== recoveredRoute?.input)
        recoveredRoute = undefined;
      input.value = value;
      input.placeholder =
        mode === "paste-url"
          ? "Paste an address, then press Enter…"
          : mode === "note-editor"
            ? "Note title…"
            : mode === "notes"
              ? "Search note titles and text…"
              : mode === "shortcuts"
                ? "Find any shortcut or prefix…"
                : mode === "actions"
                  ? `Actions · ${actionTarget?.title || (actionReturn?.mode === "note-editor" ? "Note editor" : "Spotlight")}`
                  : mode === "providers"
                    ? `Search with… · ${providerQuery.slice(0, 80)}`
                    : mode === "quicklink-name"
                      ? "Name this quicklink…"
                      : mode === "quicklinks"
                        ? "Find a quicklink…"
                        : mode === "bookmark-folders"
                          ? bookmarkOperation === "add"
                            ? "Choose a folder to save bookmarks…"
                            : "Choose a folder to remove matching bookmarks…"
                          : mode === "groups"
                            ? "Type a new group name, or choose an existing group…"
                            : [
                                  "group-manage",
                                  "group-switch",
                                  "group-route",
                                ].includes(mode)
                              ? "Find a tab group…"
                              : mode === "group-actions"
                                ? "Choose a group action…"
                                : mode === "group-rename"
                                  ? "New group name…"
                                  : mode === "group-colors"
                                    ? "Choose a group color…"
                                    : mode === "order"
                                      ? orderTabId === undefined
                                        ? "Choose a tab to move…"
                                        : "Choose a position or a destination tab…"
                                      : mode === "drafts"
                                        ? "Recover a recent AI prompt…"
                                        : mode === "commands"
                                          ? "Find a browser command…"
                                          : mode === "closed"
                                            ? "Find a recently closed tab…"
                                            : mode.startsWith("site:")
                                              ? "Enter a site search query…"
                                              : mode === "search" &&
                                                  scope === "group"
                                                ? "Search tabs in this group or enter a URL…"
                                                : "Search tabs or enter a URL…";
      input.setAttribute("aria-label", input.placeholder);
      noteBody.hidden = mode !== "note-editor";
      results.hidden = mode === "note-editor";
      input.setAttribute(
        "role",
        mode === "note-editor" ? "textbox" : "combobox",
      );
      input.setAttribute("aria-expanded", String(mode !== "note-editor"));
      if (!keepResults) updateSuggestions(preferredId);
      input.focus();
      if (mode === "edit" || mode === "group-rename") input.select();
    }
    async function copyText(value) {
      if (view.navigator.clipboard?.writeText) {
        await view.navigator.clipboard.writeText(value);
        return;
      }
      const area = document.createElement("textarea");
      area.value = value;
      root.append(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      if (!copied) throw new Error("Clipboard access is unavailable");
    }
    async function activate(event = {}) {
      if (busy) return;
      busy = true;
      error.textContent = "";
      const actionRevision = queryRevision;
      try {
        // An explicitly selected row can be opened while other sources are loading.
        if (!selectionMoved || !choices[selected] || mode !== "search")
          await pendingQuery;
        if (dismissed || closing || actionRevision !== queryRevision) return;
        let choice = choices[selected];
        let fromActions = false;
        if (!choice) return;
        if (choice.kind === "result-action") {
          if (!["open", "new", "background"].includes(choice.actionId)) {
            await runAction(choice.actionId);
            return;
          }
          fromActions = true;
          const actionId = choice.actionId;
          choice = actionTarget;
          mode = actionReturn.mode;
          orderTabId = actionReturn.orderTabId;
          input.value = actionReturn.value;
          input.placeholder = actionReturn.placeholder;
          input.maxLength = actionReturn.maxLength;
          input.setAttribute("aria-label", input.placeholder);
          suggestions = actionReturn.suggestions;
          domains = actionReturn.domains;
          completedAddress = actionReturn.completedAddress;
          returnKey = choiceKey(choice);
          render();
          event =
            actionId === "background"
              ? { shiftKey: true }
              : actionId === "new"
                ? { ctrlKey: true }
                : {};
        }
        if (choice.kind === "paste-address") {
          const reply = await chrome.runtime.sendMessage({
            type: "palette:extra",
            action: "paste-url",
            url: input.value.trim(),
          });
          if (!reply?.ok)
            throw new Error(reply?.error || "Could not open address");
          if (!dismissed && !closing && actionRevision === queryRevision)
            close();
          return;
        }
        if (choice.kind === "note-save") {
          await saveNote();
          return;
        }
        if (choice.kind === "note") {
          await openNote(choice.noteId);
          return;
        }
        if (choice.kind === "shortcut") {
          await copyText(choice.copyText);
          if (dismissed || closing || actionRevision !== queryRevision) return;
          notice = "Shortcut copied";
          render();
          return;
        }
        if (choice.command === "new-note") {
          startNote();
          return;
        }
        if (choice.command === "notes") {
          setMode("notes");
          return;
        }
        if (choice.command === "shortcuts") {
          await runAction("shortcuts");
          return;
        }
        if (choice.kind === "calculator") {
          await copyText(choice.copyText);
          if (dismissed || closing || actionRevision !== queryRevision) return;
          if (fromActions) setMode(actionReturn.mode, actionReturn.value);
          notice = `Copied ${choice.copyText}`;
          render();
          return;
        }
        if (choice.kind === "quicklink-save") {
          const response = await chrome.runtime.sendMessage({
            type: "palette:quicklink",
            operation: "save",
            ...quicklinkTarget,
            name: input.value,
          });
          if (!response?.ok)
            throw Error(response?.error || "Could not save quicklink");
          if (dismissed || closing || actionRevision !== queryRevision) return;
          setMode("search");
          notice = "Quicklink saved";
          render();
          return;
        }
        if (choice.kind === "activity") {
          const response = await chrome.runtime.sendMessage({
            type: "palette:command",
            command: "activity",
          });
          if (!response?.ok)
            throw Error(response?.error || "Could not open history");
          close();
          return;
        }
        if (choice.command === "quicklinks") {
          setMode("quicklinks");
          return;
        }
        if (choice.command === "save-quicklink") {
          startQuicklink({
            title:
              tabs.find((tab) => tab.id === context.sourceTabId)?.title ||
              "Quicklink",
            url: context.sourceUrl,
            kind: "tab",
            id: context.sourceTabId,
          });
          return;
        }
        if (choice.command === "search-with") {
          startProviders(lastSearchQuery);
          return;
        }

        if (choice.command === "bookmark-tabs") {
          startBookmarks("add");
          return;
        }
        if (choice.command === "remove-bookmarks") {
          startBookmarks("remove");
          return;
        }
        if (choice.kind === "bookmark-folder") {
          await performBookmark(choice.folderId, actionRevision);
          return;
        }
        if (choice.command === "group-tabs") {
          startGrouping();
          return;
        }
        if (choice.command === "toggle-search-scope") {
          toggleScope();
          return;
        }
        if (choice.kind === "group-route") {
          const reply = await chrome.runtime.sendMessage({
            type: "palette:extra",
            action: "route",
            url: routeUrl,
            groupId: choice.groupId,
          });
          if (!reply?.ok)
            throw new Error(reply?.error || "Could not save route");
          if (dismissed || closing || actionRevision !== queryRevision) return;
          setMode("search");
          notice = "Domain route saved";
          render();
          return;
        }
        if (choice.command === "switch-space") {
          setMode("group-switch");
          return;
        }
        if (choice.command === "new-space") {
          startGrouping("", true);
          return;
        }
        if (choice.kind === "group-switch") {
          await performGroup(
            { action: "switch", groupId: choice.groupId },
            actionRevision,
          );
          return;
        }
        if (choice.command === "manage-groups") {
          setMode("group-manage");
          return;
        }
        if (choice.command === "ungroup-tabs") {
          await performGroup(
            { action: "remove", tabIds: selectedTabIds() },
            actionRevision,
          );
          return;
        }
        if (choice.kind === "group-create") {
          await performGroup(
            { action: "create", tabIds: groupTargetIds, title: choice.name },
            actionRevision,
          );
          return;
        }
        if (choice.kind === "group-add") {
          await performGroup(
            { action: "add", tabIds: groupTargetIds, groupId: choice.groupId },
            actionRevision,
          );
          return;
        }
        if (choice.kind === "group-manage") {
          managedGroupId = choice.groupId;
          setMode("group-actions");
          return;
        }
        if (choice.kind === "group-rename") {
          setMode("group-rename", choice.name);
          return;
        }
        if (choice.kind === "group-colors") {
          setMode("group-colors");
          return;
        }
        if (choice.kind === "group-change") {
          await performGroup(
            {
              action: choice.action,
              groupId: managedGroupId,
              ...(choice.color ? { color: choice.color } : {}),
              ...(choice.name ? { title: choice.name } : {}),
            },
            actionRevision,
          );
          return;
        }
        if (choice.kind === "order-tab") {
          setMode("order", "", choice.tabId);
          return;
        }
        const commandMode = {
          "order-tabs": "order",
          "closed-tabs": "closed",
          "edit-url": "edit",
          "recover-prompts": "drafts",
        }[choice.command];
        if (choice.kind === "command" && commandMode) {
          setMode(
            commandMode,
            commandMode === "edit" ? context.sourceUrl || "" : "",
          );
          return;
        }
        if (choice.kind === "ai-draft") {
          const response = await chrome.runtime.sendMessage({
            type: "palette:recover",
            draftId: choice.draftId,
          });
          if (!response?.ok)
            throw new Error(response?.error || "Could not recover prompt");
          if (dismissed || closing || actionRevision !== queryRevision) return;
          const value = response.alias
            ? `${response.alias} ${response.query}`
            : response.query;
          if (response.learnedProvider)
            recoveredRoute = {
              input: value,
              query: response.query,
              site: response.learnedProvider,
            };
          setMode("search", value);
          if (response.alias) input.setSelectionRange(0, response.alias.length);
          return;
        }
        if (choice.kind === "site") {
          enterSite(sites.find((site) => site.key === choice.site));
          return;
        }
        const target = event.altKey
          ? "current"
          : event.shiftKey
            ? "background"
            : (newTab || mode === "edit") && !(event.metaKey || event.ctrlKey)
              ? "current"
              : "new";
        const targetField = {
          ...(target === "new" ? {} : { target }),
          ...(mode === "search" ? { scope } : {}),
        };
        let message;
        if (choice.kind === "move")
          message = {
            type: "palette:move",
            tabId: orderTabId,
            placement: choice.placement,
            ...(choice.beforeTabId === undefined
              ? {}
              : { beforeTabId: choice.beforeTabId }),
          };
        else if (
          [
            "pin-tab",
            "unpin-tab",
            "mute-tab",
            "unmute-tab",
            "new-split",
            "close-split",
          ].includes(choice.command)
        ) {
          message = {
            type: "palette:tab-action",
            action: choice.command,
            tabIds:
              choice.command === "close-split"
                ? selectedTabIds(true).slice(0, 1)
                : selectedTabIds(true),
          };
        } else if (choice.kind === "command")
          message = {
            type: "palette:command",
            command: choice.command,
            selectionQuery: input.value,
            selectionIndex: choices.indexOf(choice),
            suggestedCommand: choices.find((row) => row.kind === "command")
              ?.command,
          };
        else if (choice.kind === "closed")
          message = { type: "palette:restore", sessionId: choice.sessionId };
        else if (choice.kind === "site-query")
          message = {
            type: "palette:site",
            site: choice.site,
            query: choice.query,
            ...targetField,
          };
        else if (mode.startsWith("site:"))
          message = {
            type: "palette:site",
            site: mode.slice(5),
            query: input.value,
            ...targetField,
          };
        else if (
          choice.id !== undefined &&
          mode !== "edit" &&
          !event.altKey &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey
        )
          message = {
            type: "palette:activate",
            tabId: choice.id,
            ...(mode === "search" ? { selectionQuery: input.value } : {}),
          };
        else
          message = {
            type: "palette:navigate",
            query: choice.kind === "navigate" ? input.value : choice.url,
            ...targetField,
          };
        const response = await chrome.runtime.sendMessage(message);
        if (!response?.ok)
          throw new Error(response?.error || "Could not open result");
        if (choice.kind === "site-query" && choice.alias)
          chrome.runtime
            .sendMessage({
              type: "palette:remember-site",
              site: choice.site,
              alias: choice.alias,
            })
            .catch(() => {});
        if (response.copyText !== undefined) await copyText(response.copyText);
        close();
      } catch (failure) {
        error.textContent = failure.message;
      } finally {
        busy = false;
      }
    }
    editCurrent = (value) =>
      mode === "edit" ? close() : setMode("edit", value);
    function primaryLabel(choice) {
      const titles = {
        tab: "Switch tab",
        command: "Run",
        calculator: "Copy result",
        closed: "Restore",
        "site-query": "Search",
        site: "Choose site",
        "result-action": "Choose action",
        "quicklink-save": "Save",
        quicklink: "Open link",
        "bookmark-folder": "Choose folder",
        "ai-draft": "Recover prompt",
        "order-tab": "Choose position",
        move: "Move tab",
        "group-create": "Create group",
        "group-add": "Add to group",
        "group-manage": "Manage group",
        "group-switch": "Switch to group",
        "group-route": "Save route",
        "group-rename": "Rename",
        "group-colors": "Choose color",
        "group-change": "Apply",
        activity: "View history",
        note: "Edit note",
        "note-save": "Save note",
        shortcut: "Copy shortcut",
      };
      return titles[choice?.kind] || "Open";
    }
    function paintFooter() {
      const choice = choices[selected];
      const main = document.createElement("span");
      main.className = "footer-main";
      const status = document.createElement("span");
      status.className = "footer-status";
      status.textContent =
        notice ||
        (mode === "note-editor"
          ? noteDirty
            ? "Unsaved note"
            : "Note editor"
          : mode === "shortcuts"
            ? "All shortcuts"
            : mode === "notes"
              ? "Notes"
              : mode === "order"
                ? "Arrange tabs"
                : mode === "actions"
                  ? "Actions"
                  : markedTabs.size
                    ? `${markedTabs.size} marked`
                    : mode === "providers"
                      ? "Search with"
                      : mode === "quicklinks"
                        ? "Quicklinks"
                        : "");
      const key = document.createElement("kbd");
      key.textContent = mode === "note-editor" ? `${modifierLabel} ↵` : "↵";
      const label = document.createElement("span");
      label.textContent = primaryLabel(choice);
      if (mode === "note-editor") {
        const save = document.createElement("button");
        save.type = "button";
        save.id = "save-note";
        save.className = "footer-action";
        save.append(key, label);
        save.addEventListener("click", (event) => {
          event.stopPropagation();
          submitNote();
        });
        main.append(status, save);
      } else main.append(status, key, label);
      const action = document.createElement("button");
      action.type = "button";
      action.className = "footer-action";
      action.id = "actions";
      action.setAttribute(
        "aria-label",
        mode === "actions"
          ? "Return to results"
          : "Actions for selected result",
      );
      action.textContent = mode === "actions" ? "Back" : "Actions";
      const shortcut = document.createElement("kbd");
      shortcut.textContent = `${modifierLabel} K`;
      action.append(shortcut);
      action.disabled = false;
      action.addEventListener("click", (event) => {
        event.stopPropagation();
        openActions();
      });
      footer.replaceChildren(main, action);
      footer.title =
        footerDescription +
        " · Drag to move · Ctrl+Alt+arrows move · Ctrl+Alt+0 reset";
    }
    function highlight() {
      [...results.children].forEach((row, index) =>
        row.setAttribute("aria-selected", String(index === selected)),
      );
      const row = results.children[selected];
      if (mode === "note-editor") {
        input.removeAttribute("aria-activedescendant");
        paintFooter();
        return;
      }
      if (row) {
        input.setAttribute("aria-activedescendant", row.id);
        row.scrollIntoView({ block: "nearest" });
      } else input.removeAttribute("aria-activedescendant");
      paintFooter();
    }
    function render(preferredId) {
      const oldPositions = new Map(
        [...results.children].map((row) => [
          row.dataset.key,
          row.getBoundingClientRect().top,
        ]),
      );
      const previous = choices[selected];
      const previousKey = choiceKey(previous);
      const homepage = mode === "search" ? domains[0] : undefined;
      choices = [
        ...suggestions,
        ...domains.filter(
          (domain) => !suggestions.some((row) => row.url === domain.url),
        ),
      ];
      const query = input.value.trim();
      if (
        [
          "commands",
          "closed",
          "order",
          "drafts",
          "bookmark-folders",
          "actions",
          "providers",
          "quicklinks",
          "quicklink-name",
          "notes",
          "note-editor",
          "shortcuts",
        ].includes(mode) ||
        mode.startsWith("group")
      )
        choices = suggestions;
      else if (mode === "paste-url") choices = suggestions;
      else if (mode.startsWith("site:"))
        choices = query
          ? [
              {
                kind: "navigate",
                title: `Search ${sites.find((site) => site.key === mode.slice(5))?.name || "site"}: ${query}`,
                url: "Site search",
              },
            ]
          : [];
      else if (query) {
        const address =
          /^(?:https?:\/\/|chrome:\/\/|localhost(?:[:/]|$)|\[::1\]|[^\s/:]+\.[^\s/:]+)\S*$/i.test(
            query,
          );
        const navigation = {
          kind: "navigate",
          title: address ? `Go to ${query}` : `Search the web for “${query}”`,
          url: newTab || mode === "edit" ? "Use this tab" : "Open in a new tab",
        };
        const existingAddress = choices.find((row) => {
          if (row.kind !== "tab" || !address || !row.url) return false;
          return (
            row.url.replace(/^https?:\/\//i, "").replace(/\/$/, "") ===
            query.replace(/^https?:\/\//i, "").replace(/\/$/, "")
          );
        });
        if (
          mode === "edit" ||
          completedAddress === query ||
          (address && !existingAddress)
        )
          choices.unshift(navigation);
        else choices.push(navigation);
        if (
          existingAddress &&
          mode === "search" &&
          completedAddress !== query
        ) {
          choices = [
            existingAddress,
            ...choices.filter((row) => row !== existingAddress),
          ];
        }
        if (mode === "search" && completedAddress !== query) {
          const normalized = query.toLocaleLowerCase();
          if (normalized.length >= 3) {
            const matchingCommands = (context.commands || []).filter(
              (row) =>
                row.title.toLocaleLowerCase().startsWith(normalized) ||
                row.command === normalized ||
                row.aliases
                  .toLocaleLowerCase()
                  .split(/\s+/)
                  .includes(normalized),
            );
            const actions = matchingCommands
              .slice(0, 3)
              .map(({ command, title }) => ({
                kind: "command",
                command,
                title,
                url: "Browser action",
                sources: ["command"],
              }));
            // Keep ordinary search as the default Enter action when there are
            // no local matches; command suggestions must never run implicitly.
            choices.splice(Math.min(1, choices.length), 0, ...actions);
          }

          const siteRows = siteMatches(query).map(({ site }) => ({
            kind: "site",
            site: site.key,
            title: `Search ${site.name}`,
            url: site.detected
              ? "Detected from your browsing · Tab to search"
              : "Site search · Tab to search",
          }));
          choices.splice(choices[0] ? 1 : 0, 0, ...siteRows);
        }
      }
      const inline =
        mode === "search" && completedAddress !== query
          ? query.match(/^([\p{L}\d.-]{1,32})\s+(.+)$/su)
          : null;
      const inlineSites = inline ? siteMatches(inline[1], true) : [];
      const uniqueInline =
        inlineSites.length &&
        (inlineSites.length === 1 ||
          inlineSites[0].score > inlineSites[1].score);
      if (inlineSites.length) {
        const siteRows = inlineSites.map(({ site }) => ({
          kind: "site-query",
          site: site.key,
          query: inline[2],
          alias: inline[1].toLocaleLowerCase(),
          title: `Search ${site.name}: ${inline[2]}`,
          url: new URL(site.template.replace("%s", "query")).origin,
          sources: ["site"],
        }));
        if (uniqueInline) choices = [...siteRows, ...choices];
        else
          choices = [
            ...choices.filter((choice) => choice.kind === "navigate"),
            ...siteRows,
            ...choices.filter((choice) => choice.kind !== "navigate"),
          ];
      }
      if (mode === "search" && query) {
        if (homepage && !inlineSites.length && completedAddress !== query) {
          const first = suggestions.find(
            (row) =>
              row.url !== homepage.url &&
              ["tab", "bookmark", "history"].includes(row.kind),
          );
          choices = [
            homepage,
            ...(first ? [first] : []),
            ...choices.filter(
              (row) => row.url !== homepage.url && row !== first,
            ),
          ];
        }
        const suggestedSite =
          recoveredRoute?.site ||
          (!inlineSites.length && !siteMatches(query, true).length
            ? learnedProvider
            : undefined);
        const provider = sites.find((site) => site.key === suggestedSite);
        if (provider && choices.length) {
          const prompt = recoveredRoute?.query || query;
          choices.splice(1, 0, {
            kind: "site-query",
            site: provider.key,
            query: prompt,
            title: `Ask ${provider.name}: ${prompt}`,
            url: "Suggested from your local choices",
            sources: ["site"],
          });
        }
        const fallback = choices.find((row) => row.kind === "navigate");
        const limit = 8;
        if (fallback && choices.indexOf(fallback) >= limit) {
          choices = [...choices.slice(0, limit - 1), fallback];
        } else {
          choices = choices.slice(0, limit);
        }
      }
      footer.textContent =
        mode === "drafts"
          ? "Saved AI prompts · Enter recover · Edit shortcut to redirect · Esc back"
          : mode === "order"
            ? orderTabId === undefined
              ? "Arrange tabs · Alt+←/→ or ↑/↓ move · +Shift first/last · Enter place"
              : "Choose a destination · Enter move · Esc back"
            : mode === "commands"
              ? "Commands · ↑ ↓ select · Enter run · Esc back"
              : mode === "closed"
                ? "Recently closed · Enter restore · Esc back"
                : mode === "edit"
                  ? "Edit URL · Enter replace · Cmd/Ctrl+Enter new tab · Esc back"
                  : mode.startsWith("site:")
                    ? `Search ${sites.find((site) => site.key === mode.slice(5))?.name || "site"} · Enter search · Esc back`
                    : "↑ ↓ select · Alt+arrows move tab · > commands · @ arrange · ? prompts";
      if (mode.startsWith("group"))
        footer.textContent =
          mode === "groups"
            ? `Grouping ${groupTargetIds.length} tabs · Enter create/add · Esc back`
            : mode === "group-rename"
              ? "Enter rename · Esc back"
              : "Manage groups · Enter choose · Esc back";
      else if (markedTabs.size)
        footer.textContent = `${markedTabs.size} marked · Shift+Space select · Cmd/Ctrl+G group · Cmd/Ctrl+Shift+G remove`;
      else if (mode === "search")
        footer.textContent =
          "↑ ↓ select · Shift+Space mark · Cmd/Ctrl+G group · > commands";
      if (mode === "bookmark-folders")
        footer.textContent = `${bookmarkOperation === "add" ? "Save" : "Remove"} bookmarks for ${bookmarkTargetIds.length} tab(s) · Enter choose folder · Esc back`;
      if (mode === "search" && notice) footer.textContent = notice;
      if (inlineSites.length)
        footer.textContent = uniqueInline
          ? `Search ${inlineSites[0].site.name} · Enter send query · Tab enter scope · ↓ other results`
          : "Shared shortcut · ↓ choose site · Enter default search";
      footerDescription = footer.textContent;
      const retained = choices.findIndex(
        (choice) => choiceKey(choice) === (returnKey || previousKey),
      );
      if (returnKey && retained >= 0) {
        selectionMoved = true;
        returnKey = null;
      }
      const preferred =
        preferredId === undefined
          ? -1
          : choices.findIndex(
              (choice) => (choice.tabId ?? choice.id) === preferredId,
            );
      selected =
        preferred >= 0
          ? preferred
          : selectionMoved && retained >= 0
            ? retained
            : 0;
      if (preferred >= 0) selectionMoved = true;
      results.replaceChildren(
        ...choices.map((choice, index) => {
          const row = document.createElement("button");
          row.className = "result";
          row.id = `result-${index}`;
          row.setAttribute("role", "option");
          if (choice.kind === "shortcut") row.dataset.shortcut = "true";
          const tabId =
            choice.kind === "tab"
              ? choice.id
              : choice.kind === "order-tab"
                ? choice.tabId
                : undefined;
          if (tabId !== undefined) {
            row.dataset.marked = String(markedTabs.has(tabId));
            row.setAttribute("aria-checked", String(markedTabs.has(tabId)));
          }
          row.tabIndex = -1;
          row.dataset.key = String(
            choice.tabId ?? choice.id ?? `other:${index}`,
          );
          const icon = document.createElement("span");
          icon.className = "icon";
          const symbol = drawIcon(
            choice.kind.startsWith("group")
              ? "folder"
              : resultIcons[choice.kind] || choice.kind,
          );
          symbol.classList.add("icon-symbol");
          icon.append(symbol);
          if (tabId !== undefined) {
            const marked = markedTabs.has(tabId);
            icon.dataset.marked = String(marked);
            icon.title = "Select tab · Shift+Space";
            const indicator = document.createElement("span");
            indicator.className = "tab-mark";
            indicator.append(drawIcon(marked ? "checked" : "mark"));
            icon.append(indicator);
            icon.addEventListener("click", (event) => {
              event.stopPropagation();
              markTab(tabId);
            });
          } else if (choice.kind === "bookmark-folder")
            row.title = choice.title;
          const text = document.createElement("span");
          text.className = "text";
          const title = document.createElement("span");
          title.className = "title";
          title.textContent = choice.title || "Untitled tab";
          const url = document.createElement("span");
          url.className = "url";
          const detail = choice.description || choice.url || "";
          url.textContent =
            choice.kind === "command" && !choice.description
              ? ""
              : webUrl(detail)
                ? detail.replace(/^https?:\/\/(www\.)?/, "")
                : detail;
          url.title = detail;
          if (choice.groupColor || choice.groupTitle)
            row.dataset.groupColor = choice.groupColor || "grey";
          if (choice.match)
            url.title +=
              choice.match === "layout"
                ? " · Keyboard layout match"
                : " · Similar spelling";
          text.append(title);
          const metadata = document.createElement("span");
          metadata.className = "metadata";
          if (choice.groupTitle) {
            const badge = document.createElement("span");
            badge.className = "group-badge";
            badge.textContent =
              choice.groupTitle + (choice.groupCollapsed ? " · Collapsed" : "");
            badge.title = `Tab group: ${choice.groupTitle}`;
            metadata.append(badge);
          }
          const sources = Array.from(
            new Set(
              choice.sources || [
                choice.kind === "order-tab"
                  ? "tab"
                  : choice.kind === "site-query"
                    ? "site"
                    : choice.kind.startsWith("group-")
                      ? "group"
                      : choice.kind,
              ],
            ),
          ).filter((source) => labels[source]);
          const source = sources[0];
          if (
            source &&
            !choice.groupTitle &&
            !["navigate", "result-action", "shortcut"].includes(choice.kind)
          ) {
            const badge = document.createElement("span");
            badge.className = "source-badge";
            badge.dataset.source = source;
            badge.textContent = labels[source];
            badge.title = sources.map((value) => labels[value]).join(" · ");
            metadata.append(badge);
          }
          text.append(url);
          row.append(icon, text, metadata);
          const section =
            choice.section ||
            (mode === "search" && !query
              ? choice.kind === "tab"
                ? "Open tabs"
                : choice.kind === "quicklink"
                  ? "Quicklinks"
                  : choice.kind === "command"
                    ? "Frequent commands"
                    : ""
              : null);
          const previousSection = index
            ? choices[index - 1].section ||
              (choices[index - 1].kind === "tab"
                ? "Open tabs"
                : choices[index - 1].kind === "quicklink"
                  ? "Quicklinks"
                  : choices[index - 1].kind === "command"
                    ? "Frequent commands"
                    : "")
            : null;
          if (section && section !== previousSection) {
            row.dataset.section = section;
            const label = document.createElement("span");
            label.className = "section-label";
            label.textContent = section;
            label.setAttribute("aria-hidden", "true");
            row.append(label);
          }
          if (choice.shortcut) {
            const key = document.createElement("kbd");
            key.textContent = shortcutLabel(choice.shortcut);
            row.append(key);
          }
          row.addEventListener("click", (event) => {
            if (busy) return;
            selected = index;
            selectionMoved = true;
            activate(event);
          });
          return row;
        }),
      );
      highlight();
      decorateIcons();
      if (
        mode === "order" &&
        !view.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        for (const row of results.children) {
          const previous = oldPositions.get(row.dataset.key);
          const offset =
            previous === undefined
              ? 0
              : previous - row.getBoundingClientRect().top;
          if (offset)
            row.animate(
              [
                { transform: `translateY(${offset}px)` },
                { transform: "translateY(0)" },
              ],
              { duration: 120, easing: "ease-out" },
            );
        }
      }
    }
    function updateSuggestions(preferredId) {
      if (mode === "paste-url") {
        disconnectSearch();
        clearTimeout(timer);
        finishPending();
        ++queryRevision;
        suggestionsPending = false;
        const url = input.value.trim();
        suggestions = webUrl(url)
          ? [{ kind: "paste-address", title: "Open pasted address", url }]
          : [];
        domains = [];
        render();
        return;
      }
      if (mode === "search" && /^\/\s/u.test(input.value)) {
        setMode("commands", input.value.slice(1).trimStart());
        return;
      }
      if (mode === "search" || mode === "commands") {
        const typed = input.value.trimStart().normalize("NFC");
        const normalized = typed.toLocaleLowerCase();
        for (const { kind, prefixes } of context.targetCommands || []) {
          const prefix = prefixes.find((value) =>
            normalized.startsWith(value + " "),
          );
          if (!prefix) continue;
          const target = typed.slice(prefix.length).trimStart();
          try {
            if (kind === "switch-group") setMode("group-switch", target);
            else if (kind === "group") startGrouping(target, true);
            else startBookmarks("add", target, true);
          } catch (failure) {
            error.textContent = failure.message;
          }
          return;
        }
      }
      const prefixMode = {
        ">": "commands",
        "@": "order",
        "<": "closed",
        "?": "drafts",
        $: "quicklinks",
        ":": "notes",
      }[input.value[0]];
      if (mode === "search" && input.value.startsWith("*")) {
        try {
          startBookmarks("add", input.value.slice(1).trimStart());
        } catch (failure) {
          error.textContent = failure.message;
        }
        return;
      }
      if (mode === "search" && input.value.startsWith("#")) {
        try {
          startGrouping(input.value.slice(1).trimStart());
        } catch (failure) {
          error.textContent = failure.message;
        }
        return;
      }
      if (mode === "search" && prefixMode) {
        setMode(prefixMode, input.value.slice(1).trimStart());
        return;
      }
      const revision = ++queryRevision;
      disconnectSearch();
      clearTimeout(timer);
      finishPending();
      suggestionsPending = false;
      let resolvePending;
      pendingQuery = new Promise((resolve) => {
        resolvePending = resolve;
        finishPending = resolve;
      });
      if (input.value !== recoveredRoute?.input) recoveredRoute = undefined;
      const query = input.value.trim();
      const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
      suggestions =
        [
          "commands",
          "closed",
          "order",
          "drafts",
          "bookmark-folders",
          "actions",
          "providers",
          "quicklinks",
          "quicklink-name",
          "notes",
          "note-editor",
          "shortcuts",
        ].includes(mode) ||
        mode.startsWith("group") ||
        mode.startsWith("site:")
          ? []
          : [...tabs]
              .sort((a, b) =>
                query ? 0 : (b.lastAccessed || 0) - (a.lastAccessed || 0),
              )
              .filter(
                (tab) =>
                  (scope !== "group" ||
                    tab.groupId === context.activeGroupId) &&
                  terms.every((term) =>
                    `${tab.title || ""} ${tab.url || ""}`
                      .toLocaleLowerCase()
                      .includes(term),
                  ),
              )
              .slice(0, query ? 8 : 5)
              .map((tab) => ({ ...tab, kind: "tab", sources: ["tab"] }));
      domains = [];
      learnedProvider = undefined;
      choices = [];
      selected = 0;
      selectionMoved = false;
      error.textContent = "";
      render(preferredId);
      if (mode === "actions") {
        const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
        const actions = availableActions();
        suggestions = [
          ...actions
            .filter((action) =>
              terms.every((term) =>
                `${action.title} ${action.aliases || ""}`
                  .toLocaleLowerCase()
                  .includes(term),
              ),
            )
            .map((action) => ({
              kind: "result-action",
              actionId: action.id,
              title: action.title,
              url: "",
              shortcut: action.shortcut,
            })),
          ...shortcutRows(query, new Set(actions.map((action) => action.id))),
        ];
        render();
        resolvePending();
        return;
      }
      if (mode === "shortcuts") {
        suggestions = shortcutRows(query);
        render();
        resolvePending();
        return;
      }
      if (mode === "note-editor") {
        suggestions = [{ kind: "note-save", title: "Save note", url: "" }];
        render();
        resolvePending();
        return;
      }
      if (mode === "providers") {
        const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
        suggestions = sites
          .filter((site) =>
            terms.every((term) =>
              `${site.name} ${(site.aliases || []).join(" ")}`
                .toLocaleLowerCase()
                .includes(term),
            ),
          )
          .map((site) => ({
            kind: "site-query",
            site: site.key,
            query: providerQuery,
            alias: "",
            title: `Search ${site.name}`,
            url: providerQuery,
            sources: ["site"],
          }));
        render();
        resolvePending();
        return;
      }
      if (mode === "quicklink-name") {
        suggestions =
          query && query.length <= 80
            ? [
                {
                  kind: "quicklink-save",
                  title: `Save “${query}”`,
                  url: quicklinkTarget.url,
                },
              ]
            : [];
        render();
        resolvePending();
        return;
      }
      if (mode === "group-rename") {
        suggestions =
          query && query.length <= 80
            ? [
                {
                  kind: "group-change",
                  action: "rename",
                  name: query,
                  title: `Rename group to “${query}”`,
                  url: "Enter apply name",
                },
              ]
            : [];
        render();
        resolvePending();
        return;
      }
      if (mode === "group-colors") {
        suggestions = (context.groupColors || [])
          .filter((color) => color.includes(query.toLocaleLowerCase()))
          .map((color) => ({
            kind: "group-change",
            action: "color",
            color,
            title: color,
            url: "Apply group color",
          }));
        render();
        resolvePending();
        return;
      }
      if (mode.startsWith("site:")) {
        resolvePending();
        return;
      }
      suggestionsPending = true;
      if (mode === "search" && query && chrome.runtime.connect) {
        const port = chrome.runtime.connect({ name: "palette-search" });
        searchPort = port;
        const finish = () => {
          if (searchPort === port) searchPort = undefined;
          if (revision === queryRevision) suggestionsPending = false;
          resolvePending();
        };
        port.onDisconnect.addListener(finish);
        port.onMessage.addListener((response) => {
          if (revision !== queryRevision || dismissed || closing) return;
          if (response.ok) {
            suggestions = response.suggestions;
            domains = response.domains || [];
            learnedProvider = response.learnedProvider;
            error.textContent = (response.warnings || []).join(" · ");
            render(preferredId);
          } else if (!response.ok)
            error.textContent = response.error || "Suggestions unavailable";
          if (!response.partial) {
            finish();
            port.disconnect();
          }
        });
        timer = setTimeout(() => {
          if (searchPort === port) port.postMessage({ query, scope });
        }, 60);
        return;
      }
      timer = setTimeout(async () => {
        try {
          const response = await chrome.runtime.sendMessage({
            type: "palette:suggest",
            query,
            scope,
            ...([
              "commands",
              "closed",
              "order",
              "drafts",
              "groups",
              "group-manage",
              "group-switch",
              "group-route",
              "group-actions",
              "bookmark-folders",
              "quicklinks",
              "notes",
            ].includes(mode)
              ? { mode }
              : {}),
            ...(mode === "bookmark-folders"
              ? { operation: bookmarkOperation, tabIds: bookmarkTargetIds }
              : {}),
            ...(mode === "group-actions" ? { groupId: managedGroupId } : {}),
            ...(mode === "order" && orderTabId !== undefined
              ? { tabId: orderTabId }
              : {}),
          });
          if (revision !== queryRevision || dismissed || closing) return;
          if (!response?.ok || !Array.isArray(response.suggestions))
            throw new Error(response?.error || "Suggestions unavailable");
          suggestions = response.suggestions;
          domains = Array.isArray(response.domains) ? response.domains : [];
          learnedProvider = response.learnedProvider;
          error.textContent = (response.warnings || []).join(" · ");
          render(preferredId);
        } catch (failure) {
          if (revision === queryRevision && !dismissed && !closing)
            error.textContent = failure.message;
        } finally {
          if (revision === queryRevision) suggestionsPending = false;
          resolvePending();
        }
      }, 150);
    }
    async function quickMove(placement) {
      if (busy && !moving) return;
      const choice = choices[selected];
      const tabId =
        orderTabId ??
        (choice?.kind === "order-tab"
          ? choice.tabId
          : choice?.kind === "tab"
            ? choice.id
            : undefined);
      if (tabId === undefined) return;
      moveQueue.push({ tabId, placement });
      if (moving) return;
      moving = true;
      busy = true;
      error.textContent = "";
      const revision = queryRevision;
      const filter =
        mode === "order" && orderTabId === undefined ? input.value : "";
      try {
        await pendingQuery;
        while (
          moveQueue.length &&
          !dismissed &&
          !closing &&
          revision === queryRevision
        ) {
          const next = moveQueue.shift();
          const response = await chrome.runtime.sendMessage({
            type: "palette:move",
            ...next,
          });
          if (!response?.ok)
            throw new Error(response?.error || "Could not move tab");
          if (dismissed || closing || revision !== queryRevision) break;
          const snapshot = Array.isArray(response.suggestions)
            ? response
            : await chrome.runtime.sendMessage({
                type: "palette:suggest",
                mode: "order",
                query: filter,
              });
          if (dismissed || closing || revision !== queryRevision) break;
          if (!snapshot?.ok && snapshot !== response)
            throw new Error(snapshot?.error || "Could not refresh tab order");
          setMode("order", filter, undefined, next.tabId, true);
          const terms = filter.toLocaleLowerCase().split(/\s+/).filter(Boolean);
          suggestions = snapshot.suggestions.filter((row) =>
            terms.every((term) =>
              `${row.title} ${row.url}`.toLocaleLowerCase().includes(term),
            ),
          );
          domains = [];
          render(next.tabId);
        }
      } catch (failure) {
        if (!dismissed && !closing && revision === queryRevision)
          error.textContent = failure.message;
      } finally {
        moveQueue.length = 0;
        moving = false;
        busy = false;
      }
    }
    noteBody.addEventListener("input", () => {
      if (mode === "note-editor" && noteDraft) {
        noteDraft.body = noteBody.value;
        noteDirty = true;
        notice = "";
        updateSuggestions();
      }
    });
    noteBody.addEventListener("beforeinput", (event) => {
      if (busy) event.preventDefault();
    });
    input.addEventListener("input", () => {
      recoveredRoute = undefined;
      notice = "";
      completedAddress = null;
      if (mode === "note-editor" && noteDraft) {
        noteDraft.title = input.value;
        noteDirty = true;
        updateSuggestions();
        return;
      }
      if (mode === "search" && !">@<?$#*:".includes(input.value[0] || "\0"))
        lastSearchQuery = input.value;
      updateSuggestions();
    });
    input.addEventListener("beforeinput", (event) => {
      if (busy) event.preventDefault();
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      if (event.ctrlKey && event.altKey && !event.metaKey) {
        const directions = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        if (directions[event.key]) {
          event.preventDefault();
          const [x, y] = directions[event.key];
          const step = event.shiftKey ? 64 : 16;
          if (!actionPopup) move(x * step, y * step);
          return;
        }
        if (event.key === "0") {
          event.preventDefault();
          resetPosition();
          return;
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (mode === "actions") leaveActions();
        else if (mode === "note-editor") {
          noteDraft = null;
          noteDirty = false;
          setMode("notes");
        } else if (mode === "shortcuts" && shortcutsReturn)
          setMode(
            shortcutsReturn.mode,
            shortcutsReturn.value,
            shortcutsReturn.orderTabId,
          );
        else if (mode === "providers" && providerReturn)
          setMode(
            providerReturn.mode,
            providerReturn.value,
            providerReturn.orderTabId,
          );
        else if (mode === "quicklink-name" && quicklinkReturn)
          setMode(
            quicklinkReturn.mode,
            quicklinkReturn.value,
            quicklinkReturn.orderTabId,
          );
        else if (["group-rename", "group-colors"].includes(mode))
          setMode("group-actions");
        else if (mode === "group-actions") setMode("group-manage");
        else if (mode === "order" && orderTabId !== undefined) setMode("order");
        else if (mode !== "search") setMode("search");
        else if (markedTabs.size) {
          markedTabs.clear();
          render();
        } else close();
        return;
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLocaleLowerCase() === "k"
      ) {
        event.preventDefault();
        openActions();
        return;
      }
      if (mode === "note-editor") {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          submitNote();
          return;
        }
        if (event.key === "Enter" && event.target !== noteBody) {
          event.preventDefault();
          if (event.target === input) noteBody.focus();
          else if (event.target === resizeHandle) resetSize();
          else if (event.target === footer.querySelector("#actions"))
            openActions();
          else submitNote();
          return;
        }
        if (event.key === "Tab") {
          event.preventDefault();
          const controls = [
            input,
            noteBody,
            footer.querySelector("#save-note"),
            footer.querySelector("#actions"),
            ...(actionPopup ? [] : [resizeHandle]),
          ];
          controls[
            (controls.indexOf(root.activeElement) +
              (event.shiftKey ? -1 : 1) +
              controls.length) %
              controls.length
          ].focus();
          return;
        }
        if (event.target !== resizeHandle) {
          if (
            (event.metaKey || event.ctrlKey) &&
            ["g", "d"].includes(event.key.toLocaleLowerCase())
          )
            event.preventDefault();
          return;
        }
      }
      if (event.metaKey || event.ctrlKey) {
        const action = actionDefinitions.find(
          (action) =>
            action.key === event.key.toLocaleLowerCase() &&
            Boolean(action.shift) === event.shiftKey &&
            Boolean(action.alt) === event.altKey,
        );
        if (action) {
          event.preventDefault();
          if (!busy) {
            busy = true;
            runAction(action.id)
              .catch((failure) => {
                error.textContent = failure.message;
              })
              .finally(() => {
                busy = false;
              });
          }
          return;
        }
      }
      if (
        event.key === " " &&
        event.target === input &&
        event.shiftKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        const choice = choices[selected];
        const id =
          choice?.kind === "tab"
            ? choice.id
            : choice?.kind === "order-tab"
              ? choice.tabId
              : undefined;
        if (id !== undefined) {
          event.preventDefault();
          if (!event.repeat) markTab(id);
        }
        return;
      }
      const moveKey = {
        ArrowLeft: "left",
        ArrowUp: "left",
        ArrowRight: "right",
        ArrowDown: "right",
        Home: "start",
        End: "end",
      }[event.key];
      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        moveKey &&
        (orderTabId !== undefined ||
          ["tab", "order-tab"].includes(choices[selected]?.kind))
      ) {
        event.preventDefault();
        quickMove(
          event.shiftKey && ["left", "right"].includes(moveKey)
            ? moveKey === "left"
              ? "start"
              : "end"
            : moveKey,
        );
        return;
      }
      if (event.target === resizeHandle) {
        if (event.key === "Enter") {
          event.preventDefault();
          resetSize();
          return;
        }
        const deltas = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        if (deltas[event.key]) {
          event.preventDefault();
          const bounds = dialog.getBoundingClientRect();
          const [x, y] = deltas[event.key];
          const step = event.shiftKey ? 64 : 16;
          resize(bounds.width + x * step, bounds.height + y * step);
          return;
        }
      }
      if (busy) {
        event.preventDefault();
        return;
      }
      if (
        event.key === "Backspace" &&
        mode === "providers" &&
        !input.value &&
        providerReturn
      ) {
        event.preventDefault();
        setMode(
          providerReturn.mode,
          providerReturn.value,
          providerReturn.orderTabId,
        );
        return;
      }
      if (event.key === "Backspace" && mode === "actions" && !input.value) {
        event.preventDefault();
        leaveActions();
        return;
      }
      if (event.key === "Backspace" && mode !== "search" && !input.value) {
        event.preventDefault();
        if (mode === "order" && orderTabId !== undefined) setMode("order");
        else setMode("search", mode.startsWith("site:") ? mode.slice(5) : "");
        return;
      }
      if (
        ["ArrowDown", "ArrowUp"].includes(event.key) &&
        event.target === input &&
        choices.length
      ) {
        event.preventDefault();
        selectionMoved = true;
        selected =
          (selected + (event.key === "ArrowDown" ? 1 : -1) + choices.length) %
          choices.length;
        highlight();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.target === footer.querySelector("#actions")) openActions();
        else activate(event);
      }
      if (
        event.key === "Tab" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        const choice = choices[selected];
        const matches = siteMatches(input.value);
        const site =
          choice?.kind === "site"
            ? sites.find((site) => site.key === choice.site)
            : matches.length &&
                (matches.length === 1 || matches[0].score > matches[1].score)
              ? matches[0].site
              : null;
        if (
          !event.shiftKey &&
          event.target === input &&
          choice?.kind === "site-query"
        ) {
          enterSite(
            sites.find((site) => site.key === choice.site),
            choice.alias ?? "",
            choice.query,
          );
          return;
        }
        if (
          !event.shiftKey &&
          event.target === input &&
          mode === "search" &&
          site
        ) {
          enterSite(site);
          return;
        }
        if (
          !event.shiftKey &&
          event.target === input &&
          mode === "search" &&
          !input.value.trim()
        ) {
          setMode("commands");
          return;
        }
        if (
          !event.shiftKey &&
          event.target === input &&
          !choice?.kind.startsWith("group-") &&
          ![
            "navigate",
            "command",
            "closed",
            "site",
            "order-tab",
            "move",
            "ai-draft",
            "bookmark-folder",
            "result-action",
            "quicklink-save",
            "calculator",
            "activity",
            "note",
            "shortcut",
            "note-save",
          ].includes(choice?.kind) &&
          choice?.url
        ) {
          input.value = choice.url;
          completedAddress = choice.url;
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          updateSuggestions();
        } else {
          const controls = [
            input,
            footer.querySelector("#actions"),
            ...(actionPopup ? [] : [resizeHandle]),
          ];
          controls[
            (controls.indexOf(root.activeElement) +
              (event.shiftKey ? -1 : 1) +
              controls.length) %
              controls.length
          ].focus();
        }
      }
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });
    dialog.showModal();
    setMode(mode, mode === "edit" ? context.sourceUrl || "" : "");
  }
  showPalette(frame.contentDocument);
}
