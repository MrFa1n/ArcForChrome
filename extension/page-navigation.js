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
    if (event.metaKey || event.altKey) return;
    let key = event.key;
    if (/\p{Script=Cyrillic}/u.test(key)) {
      if (/^Key[HJKLDUGBF]$/.test(event.code)) {
        const letter = event.code.at(-1);
        key = event.shiftKey ? letter : letter.toLowerCase();
      } else if (event.code === "BracketLeft") {
        key = event.shiftKey ? "{" : "[";
      } else if (event.code === "BracketRight") {
        key = event.shiftKey ? "}" : "]";
      }
    }
    if (event.ctrlKey) {
      if (event.shiftKey || !["u", "d", "b", "f"].includes(key)) return;
      key = { b: "PageUp", f: "PageDown" }[key] || key;
    }
    const now = performance.now();
    const goTop = key === "g" && now - lastG <= 750;
    lastG = key === "g" && !goTop && !event.repeat ? now : -Infinity;
    const axis = ["h", "l", "0", "$"].includes(key) ? "x" : "y";
    const direction = ["k", "h", "u", "g", "0", "[", "{", "PageUp"].includes(
      key,
    )
      ? -1
      : 1;
    const supported = [
      "h",
      "j",
      "k",
      "l",
      "d",
      "u",
      "g",
      "G",
      "Home",
      "End",
      "[",
      "]",
      "{",
      "}",
      "PageUp",
      "PageDown",
      "0",
      "$",
    ];
    if (!supported.includes(key)) return;
    if (key === "{" || key === "}") {
      const headings = [
        ...document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]"),
      ]
        .filter(
          (node) =>
            node.getClientRects().length &&
            getComputedStyle(node).visibility === "visible",
        )
        .map((node) => ({ node, top: node.getBoundingClientRect().top }))
        .sort((a, b) => a.top - b.top);
      const heading =
        direction < 0
          ? headings.findLast(({ top }) => top < -8)
          : headings.find(({ top }) => top > 8);
      if (!heading) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      heading.node.scrollIntoView({
        block: "start",
        inline: "nearest",
        behavior: "instant",
      });
      return;
    }
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
    let distance = 64;
    if (key === "d" || key === "u")
      distance = Math.max(40, scroller.clientHeight / 2);
    if (["[", "]", "PageUp", "PageDown"].includes(key))
      distance = Math.max(40, scroller.clientHeight - 32);
    if (key === "0" || key === "$") distance = scroller.scrollWidth;
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
