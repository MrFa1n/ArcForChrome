import { interfaceLocale, translate } from "./localization.js";

export async function togglePageNavigation(api, tabId) {
  const { messages } = await interfaceLocale(api);
  const label = translate(messages, "Navigation · Home / End · Esc to exit");
  try {
    await api.scripting.executeScript({
      target: { tabId },
      func: mountPageNavigation,
      args: [label],
    });
  } catch {
    throw Error("Page navigation is unavailable on this page");
  }
}

// This function runs in Chrome's isolated world on explicit invocation.
export function mountPageNavigation(label) {
  const state = "arcPageNavigation";
  if (globalThis[state]) {
    globalThis[state]();
    return;
  }

  const host = document.createElement("div");
  host.style.cssText =
    "all:initial!important;position:fixed!important;inset:auto 16px 16px auto!important;z-index:2147483647!important;pointer-events:none!important";
  const root = host.attachShadow({ mode: "closed" });
  const badge = document.createElement("span");
  badge.setAttribute("role", "status");
  badge.style.cssText =
    "display:block;padding:7px 12px;border:1px solid CanvasText;border-radius:999px;background:Canvas;color:CanvasText;color-scheme:light dark;font:600 12px system-ui";
  root.append(badge);
  document.documentElement.append(host);
  badge.textContent = label;

  const listeners = new AbortController();
  const { signal } = listeners;
  let lastG = -Infinity;
  let pointerTarget;
  function stop() {
    listeners.abort();
    host.remove();
    delete globalThis[state];
  }

  function scrollTarget(target, axis, direction) {
    const page = document.scrollingElement;
    for (let node = target; node && node !== page; ) {
      if (node instanceof Element) {
        const style = getComputedStyle(node);
        const vertical = axis === "y";
        const position = vertical ? node.scrollTop : node.scrollLeft;
        const limit = vertical
          ? node.scrollHeight - node.clientHeight
          : node.scrollWidth - node.clientWidth;
        const rtl = !vertical && style.direction === "rtl";
        const canMove = rtl
          ? direction < 0
            ? position > -limit
            : position < 0
          : direction < 0
            ? position > 0
            : position < limit;
        if (
          limit > 1 &&
          canMove &&
          /^(auto|scroll|overlay)$/.test(
            vertical ? style.overflowY : style.overflowX,
          )
        )
          return node;
      }
      node = node.parentElement || node.getRootNode().host;
    }
    return page;
  }

  function onKey(event) {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229)
      return;
    if (document.querySelector("[data-arc-command-palette]")) return;
    if (
      event.key === "Escape" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      stop();
      return;
    }
    if (
      document.designMode === "on" ||
      event
        .composedPath()
        .some(
          (node) =>
            node instanceof Element &&
            (node.isContentEditable ||
              node.matches(
                'input, textarea, select, [role="textbox"], [role="combobox"]',
              )),
        )
    ) {
      lastG = -Infinity;
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Keep the familiar physical Vim keys on Cyrillic keyboard layouts.
    const key =
      /\p{Script=Cyrillic}/u.test(event.key) &&
      /^Key[HJKLDUG]$/.test(event.code)
        ? event.shiftKey
          ? event.code.at(-1)
          : event.code.at(-1).toLowerCase()
        : event.key;
    const now = performance.now();
    const goTop = key === "g" && now - lastG <= 750;
    lastG = key === "g" && !goTop && !event.repeat ? now : -Infinity;
    const axis = key === "h" || key === "l" ? "x" : "y";
    const direction = ["k", "h", "u", "g"].includes(key) ? -1 : 1;
    if (!["h", "j", "k", "l", "d", "u", "g", "G", "Home", "End"].includes(key))
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (key === "g" && (!goTop || event.repeat)) return;
    if (goTop || key === "G" || key === "Home" || key === "End") {
      const page = document.scrollingElement;
      page?.scrollTo({
        top: goTop || key === "Home" ? 0 : page.scrollHeight,
        behavior: "instant",
      });
      return;
    }
    const pathTarget = event
      .composedPath()
      .find((node) => node instanceof Element);
    const target = [document.body, document.documentElement].includes(
      pathTarget,
    )
      ? pointerTarget || pathTarget
      : pathTarget;
    const scroller = scrollTarget(target, axis, direction);
    if (!scroller) return;
    const distance =
      key === "d" || key === "u" ? Math.max(40, scroller.clientHeight / 2) : 64;
    scroller.scrollBy({
      [axis === "x" ? "left" : "top"]: direction * distance,
      behavior: "instant",
    });
  }

  globalThis[state] = stop;
  window.addEventListener("keydown", onKey, { capture: true, signal });
  window.addEventListener(
    "pointermove",
    (event) => {
      pointerTarget = event
        .composedPath()
        .find((node) => node instanceof Element);
    },
    { capture: true, passive: true, signal },
  );
  window.addEventListener("pagehide", stop, { once: true, signal });
}
