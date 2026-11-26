import { launcherContext } from "../extension/launcher-catalog.js";
const PALETTE_CATALOG = await launcherContext({
  commands: {
    getAll: async () => [
      { name: "open-search", shortcut: "⌘T" },
      { name: "edit-address", shortcut: "⌘L" },
    ],
  },
});
import {
  GROUP_COLORS,
  groupSuggestions,
  manageGroupSuggestions,
  groupActionSuggestions,
} from "../extension/tab-groups.js";
import { BUILTIN_SITES } from "../extension/search-providers.js";
import {
  browserPageSuggestions,
  mergeBrowserPages,
} from "../extension/browser-pages.js";
import { orderSuggestions } from "../extension/tab-order.js";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mountPalette } from "../extension/palette.js";
import { inferSites } from "../extension/site-discovery.js";
const DISCOVERED_SITES = inferSites([
  {
    title: "cats - YouTube",
    url: "https://www.youtube.com/results?search_query=cats",
  },
  { title: "GitHub", url: "https://github.com/search?q=old" },
]);
import { commandSuggestions } from "../extension/command-catalog.js";

const designTokens = await readFile(
  new URL("../extension/design-tokens.css", import.meta.url),
  "utf8",
);
const profile = await mkdtemp(join(tmpdir(), "arc-keyboard-"));
const binary =
  process.env.CHROME_BINARY ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const processChrome = spawn(binary, [
  "--headless=new",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
]);
let socket;
let server;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Chrome startup timed out")),
      15000,
    );
    let output = "";
    processChrome.stderr.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    processChrome.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    processChrome.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Chrome exited: ${code}`));
    });
  });
  const port = new URL(endpoint).port;
  const targets = await (
    await fetch(`http://127.0.0.1:${port}/json/list`)
  ).json();
  socket = new WebSocket(
    targets.find((target) => target.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let serial = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++serial;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function key(key, code, text, modifiers = 0) {
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code,
      modifiers,
      ...(text ? { text } : {}),
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
      modifiers,
    });
    if (key === "Enter")
      await evaluate("new Promise(resolve=>setTimeout(resolve,450))");
  }
  async function mount(tabs, context = {}) {
    await evaluate(
      `globalThis.mockTabs=${JSON.stringify(tabs)};(${mountPalette.toString()})(${JSON.stringify(tabs)},false,${JSON.stringify({ ...PALETTE_CATALOG, designTokens, ...context })})`,
    );
  }
  await evaluate(`document.body.innerHTML='<input id="page-input"><video></video>';document.querySelector('input').focus();
    globalThis.pageKeys=[];globalThis.messages=[];
    for(const type of ['keydown','keypress','keyup']) window.addEventListener(type,event=>pageKeys.push(type+':'+event.key),true);
    globalThis.chrome={runtime:{sendMessage:async message=>{if(message.type==='palette:suggest')return {ok:true,suggestions:(mockTabs||[]).filter(tab=>(tab.title+' '+tab.url).toLowerCase().includes(message.query.toLowerCase())).map(tab=>({...tab,kind:'tab',sources:tab.sources || ['tab']})),warnings:[]};messages.push(message);return {ok:true};}}};`);
  async function checkLearnedProvider() {
    const providerContext = { sites: BUILTIN_SITES };
    const lastAction = () =>
      evaluate(
        "messages.filter(message=>message.type!=='palette:remember-site').at(-1)",
      );
    await evaluate(`const sendBeforeLearning=chrome.runtime.sendMessage;chrome.runtime.sendMessage=async message=>{
    if(message.type==='palette:suggest' && message.mode==='drafts')return {ok:true,suggestions:[{kind:'ai-draft',draftId:'saved-1',title:'Gemini: Original prompt',url:'Recover prompt'}]};
    if(message.type==='palette:recover'){messages.push(message);return {ok:true,alias:'gem',query:'Original prompt',learnedProvider:'provider:claude'};}
    const response=await sendBeforeLearning(message);
    return message.type==='palette:suggest' && !message.mode ? {...response,learnedProvider:'provider:claude'} : response;
  };`);
    await mount([], providerContext);
    await send("Input.insertText", { text: "explain closures" });
    await key("Enter", "Enter");
    assert.deepEqual(
      await lastAction(),
      {
        type: "palette:navigate",
        query: "explain closures",
        scope: "window",
      },
      "a learned provider cannot replace the default Enter action",
    );
    await mount([], providerContext);
    await send("Input.insertText", { text: "explain closures" });
    await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
    await key("ArrowDown", "ArrowDown");
    await key("Enter", "Enter");
    assert.deepEqual(await lastAction(), {
      type: "palette:site",
      site: "provider:claude",
      query: "explain closures",
      scope: "window",
    });
    await mount([], providerContext);
    await send("Input.insertText", { text: "gem explain closures" });
    await key("Enter", "Enter");
    assert.deepEqual(await lastAction(), {
      type: "palette:site",
      site: "provider:gemini",
      query: "explain closures",
      scope: "window",
    });
    await mount([], providerContext);
    await send("Input.insertText", { text: "?" });
    await key("Enter", "Enter");
    assert.deepEqual(await lastAction(), {
      type: "palette:recover",
      draftId: "saved-1",
    });
    await key("ArrowDown", "ArrowDown");
    await key("Enter", "Enter");
    assert.deepEqual(await lastAction(), {
      type: "palette:site",
      site: "provider:claude",
      query: "Original prompt",
      scope: "window",
    });
    await evaluate(
      "chrome.runtime.sendMessage=sendBeforeLearning;messages.length=0",
    );
    console.log(
      "PASS: keyboard selection of a learned provider and priority of explicit aliases",
    );
  }
  await checkLearnedProvider();
  await mount([
    {
      id: 1,
      title: "Video",
      url: "https://video.example",
      sources: ["tab", "bookmark", "history", "bookmark"],
    },
  ]);
  assert.equal(
    await paletteCall(
      `function(){return this.querySelectorAll('header,nav,select,#close').length;}`,
    ),
    0,
    "palette must open directly on the query without a toolbar",
  );
  async function paletteCall(
    functionDeclaration,
    args = [],
    pageGlass = false,
  ) {
    const tree = await send("DOM.getDocument", { depth: -1, pierce: true });
    function find(node) {
      if (
        pageGlass
          ? node.nodeName === "DIV" && node.attributes?.includes("page-glass")
          : node.nodeName === "DIALOG" &&
            node.attributes?.includes("Search tabs or the web")
      )
        return node;
      for (const child of [
        ...(node.children || []),
        ...(node.shadowRoots || []),
        ...(node.contentDocument ? [node.contentDocument] : []),
      ]) {
        const match = find(child);
        if (match) return match;
      }
    }
    const node = find(tree.root);
    assert.ok(
      node,
      pageGlass
        ? "page glass should exist"
        : "search dialog should exist in its frame",
    );
    const { object } = await send("DOM.resolveNode", {
      backendNodeId: node.backendNodeId,
    });
    const result = await send("Runtime.callFunctionOn", {
      objectId: object.objectId,
      returnByValue: true,
      awaitPromise: true,
      functionDeclaration,
      arguments: args.map((value) => ({ value })),
    });
    if (result.exceptionDetails)
      throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function paletteStyles(rootSize) {
    return paletteCall(
      `function(rootSize) {
      if(rootSize)this.ownerDocument.documentElement.style.fontSize=rootSize;
      const probe=this.ownerDocument.createElement('span');
      probe.style.cssText='background:Canvas;color:CanvasText;color-scheme:light dark';this.append(probe);
      const view=this.ownerDocument.defaultView;
      const style=view.getComputedStyle(this);
      const theme={background:style.backgroundColor,lens:style.backgroundImage,frost:style.backdropFilter,color:style.color,
        canvas:view.getComputedStyle(probe).backgroundColor,canvasText:view.getComputedStyle(probe).color,
        fontSize:parseFloat(view.getComputedStyle(this).fontSize)};
      probe.remove();return theme;
    }`,
      [rootSize],
    );
  }
  async function screenshot(name) {
    if (!process.env.PALETTE_SCREENSHOT_DIR) return;
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(
      join(process.env.PALETTE_SCREENSHOT_DIR, `arc-spotlight-${name}.png`),
      Buffer.from(data, "base64"),
    );
  }
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "light" }],
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('[data-source=tab]').textContent;}`,
    ),
    "Open tab",
    "open tabs need a named source badge",
  );
  assert.deepEqual(
    await paletteCall(
      `function(){return [...this.querySelectorAll('.source-badge')].map(node=>node.textContent);}`,
    ),
    ["Open tab"],
    "merged results show a single source badge",
  );
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('.source-badge').title;}`,
    ),
    "Open tab · Bookmark · History",
    "the tooltip explains merged sources",
  );
  const light = await paletteStyles();
  assert.notEqual(light.background, light.canvas);
  assert.match(light.lens, /radial-gradient/);
  assert.equal(light.frost, "none");
  const liveGlassStyles = () =>
    paletteCall(
      `function(){return {
      frost: getComputedStyle(this).backdropFilter,
      bounds: this.getBoundingClientRect().toJSON()
    };}`,
      [],
      true,
    );
  assert.match((await liveGlassStyles()).frost, /blur/);
  assert.equal(light.color, light.canvasText);
  assert.equal(
    await paletteCall(
      `function(){return this.ownerDocument.defaultView.getComputedStyle(this,'::backdrop').backdropFilter;}`,
    ),
    "none",
    "backdrop must not blur the page",
  );
  await screenshot("light");
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-contrast", value: "more" }],
  });
  const opaque = await paletteStyles();
  assert.equal(opaque.background, opaque.canvas);
  assert.equal(opaque.lens, "none");
  assert.equal(opaque.frost, "none");
  assert.equal((await liveGlassStyles()).frost, "none");
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "light" }],
  });
  await evaluate(
    "globalThis.paletteErrors=[];window.addEventListener('error',event=>paletteErrors.push(event.message));",
  );
  await paletteCall(
    `function(){this.ownerDocument.defaultView.addEventListener('error',event=>this.ownerDocument.defaultView.parent.paletteErrors.push(event.message));}`,
  );
  const initialPosition = await paletteCall(
    `function(){return this.getBoundingClientRect().toJSON();}`,
  );
  assert.deepEqual((await liveGlassStyles()).bounds, initialPosition);
  await key("ArrowRight", "ArrowRight", undefined, 3);
  const nudgedPosition = await paletteCall(
    `function(){return this.getBoundingClientRect().toJSON();}`,
  );
  assert.deepEqual((await liveGlassStyles()).bounds, nudgedPosition);
  assert.equal(
    Math.round(nudgedPosition.x - initialPosition.x),
    16,
    "Ctrl+Alt+Right should move the palette without moving a tab",
  );
  await key("ArrowDown", "ArrowDown", undefined, 11);
  const largerMove = await paletteCall(
    `function(){return this.getBoundingClientRect().toJSON();}`,
  );
  assert.equal(Math.round(largerMove.y - nudgedPosition.y), 64);
  await key("0", "Digit0", "", 3);
  const reset = await paletteCall(
    `function(){return this.getBoundingClientRect().toJSON();}`,
  );
  assert.equal(Math.round(reset.x), Math.round(initialPosition.x));
  assert.equal(Math.round(reset.y), Math.round(initialPosition.y));
  const footerBounds = await paletteCall(
    `function(){return this.querySelector('footer').getBoundingClientRect().toJSON();}`,
  );
  const dragX = footerBounds.x + footerBounds.width / 2,
    dragY = footerBounds.y + footerBounds.height / 2;
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: dragX,
    y: dragY,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: dragX + 35,
    y: dragY + 30,
    buttons: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: dragX + 35,
    y: dragY + 30,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  const dragged = await paletteCall(
    `function(){return this.getBoundingClientRect().toJSON();}`,
  );
  assert.equal(Math.round(dragged.x - reset.x), 35);
  assert.equal(Math.round(dragged.y - reset.y), 30);
  const viewport = await evaluate("({width:innerWidth,height:innerHeight})");
  const nextFooter = await paletteCall(
    `function(){return this.querySelector('footer').getBoundingClientRect().toJSON();}`,
  );
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: nextFooter.x + 30,
    y: nextFooter.y + 15,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: viewport.width - 1,
    y: viewport.height - 1,
    buttons: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: viewport.width - 1,
    y: viewport.height - 1,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  const clamped = await paletteCall(
    `function(){return this.getBoundingClientRect().toJSON();}`,
  );
  assert.ok(
    clamped.right <= viewport.width - 15 &&
      clamped.bottom <= viewport.height - 15,
    "drag must keep the palette on screen",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 500,
    height: 350,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,50))");
  const resized = await paletteCall(
    `function(){return this.getBoundingClientRect().toJSON();}`,
  );
  assert.ok(
    resized.x >= 15 &&
      resized.y >= 15 &&
      resized.right <= 485 &&
      resized.bottom <= 335,
    "resize must keep the moved palette visible",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    ...viewport,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await key("0", "Digit0", "", 3);
  assert.deepEqual(
    await evaluate("messages"),
    [],
    "moving the palette must not navigate or reorder tabs",
  );
  const resizeRect = await paletteCall(
    `function(){return this.querySelector('#resize').getBoundingClientRect().toJSON();}`,
  );
  const beforeResize = await paletteCall(
    `function(){return this.getBoundingClientRect().toJSON();}`,
  );
  const rx = resizeRect.x + resizeRect.width / 2,
    ry = resizeRect.y + resizeRect.height / 2;
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: rx,
    y: ry,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: rx + 40,
    y: ry + 40,
    buttons: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: rx + 40,
    y: ry + 40,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  const afterResize = await paletteCall(
    `function(){return this.getBoundingClientRect().toJSON();}`,
  );
  assert.equal(Math.round(afterResize.width - beforeResize.width), 40);
  assert.ok(
    afterResize.height >= beforeResize.height + 39,
    "corner drag should resize height",
  );
  await key("Tab", "Tab", undefined, 8);
  assert.equal(
    await paletteCall(
      `function(){return this.getRootNode().activeElement.id;}`,
    ),
    "resize",
  );
  for (let index = 0; index < 15; index++)
    await key("ArrowLeft", "ArrowLeft", undefined, 8);
  for (let index = 0; index < 15; index++)
    await key("ArrowUp", "ArrowUp", undefined, 8);
  const minimumSize = await paletteCall(
    `function(){return this.getBoundingClientRect().toJSON();}`,
  );
  assert.equal(Math.round(minimumSize.width), 360);
  assert.equal(Math.round(minimumSize.height), 220);
  for (let index = 0; index < 20; index++)
    await key("ArrowRight", "ArrowRight", undefined, 8);
  for (let index = 0; index < 20; index++)
    await key("ArrowDown", "ArrowDown", undefined, 8);
  const maximumSize = await paletteCall(
    `function(){return this.getBoundingClientRect().toJSON();}`,
  );
  assert.ok(
    maximumSize.width <= Math.min(1000, viewport.width - 32) + 1 &&
      maximumSize.height <= Math.min(800, viewport.height - 32) + 1,
  );
  // Popup-like viewport changes while an explicit size is active used to feed geometry back into ResizeObserver.
  for (const dimensions of [
    { width: 680, height: 560 },
    { width: 500, height: 350 },
    viewport,
  ]) {
    await send("Emulation.setDeviceMetricsOverride", {
      ...dimensions,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await evaluate("new Promise(resolve=>setTimeout(resolve,70))");
  }

  await key("0", "Digit0", "", 3);
  await key("Tab", "Tab", undefined, 8);
  await key("Tab", "Tab", undefined, 8);
  await evaluate("new Promise(resolve=>setTimeout(resolve,100))");
  assert.deepEqual(
    await evaluate("paletteErrors"),
    [],
    "resize/clamping must not produce ResizeObserver feedback errors",
  );

  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "dark" }],
  });
  const dark = await paletteStyles();
  assert.equal(dark.color, dark.canvasText);
  assert.notEqual(
    dark.background,
    light.background,
    "open palette should react to theme changes",
  );
  await screenshot("dark");
  const larger = await paletteStyles("24px");
  assert.ok(
    larger.fontSize > dark.fontSize * 1.4,
    "browser base-font changes should scale search text",
  );
  await paletteStyles("medium");
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "light" }],
  });
  await key("f", "KeyF", "f");
  await key(" ", "Space", " ");
  await key("ArrowDown", "ArrowDown");
  assert.deepEqual(
    await evaluate("pageKeys"),
    [],
    "page capture listeners must not receive palette keys",
  );
  await key("Escape", "Escape");
  assert.equal(
    await evaluate(
      "document.querySelector('[data-arc-command-palette]') === null",
    ),
    true,
  );
  assert.equal(
    await evaluate("document.activeElement.id"),
    "page-input",
    "page focus should be restored",
  );
  await key("k", "KeyK", "k");
  assert.ok(
    (await evaluate("pageKeys")).includes("keydown:k"),
    "page shortcuts should resume after close",
  );
  await evaluate("pageKeys=[]");
  await mount([]);
  await key("x", "KeyX", "x");
  await key("Enter", "Enter");
  assert.deepEqual(
    await evaluate("messages"),
    [{ type: "palette:navigate", query: "x" }],
    "typing and Enter must still work",
  );
  assert.deepEqual(await evaluate("pageKeys"), []);
  await mount([{ id: 7, title: "Existing", url: "https://existing.example" }]);
  await key("ArrowDown", "ArrowDown");
  await key("Enter", "Enter");
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:activate",
    tabId: 7,
    selectionQuery: "",
  });
  assert.deepEqual(
    await evaluate("pageKeys"),
    [],
    "selection keyup must not leak to the page",
  );
  await mount([]);
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "k",
    code: "KeyK",
    text: "k",
  });
  await mount([]);
  assert.equal(
    await evaluate("!!document.querySelector('[data-arc-command-palette]')"),
    true,
    "dismissal waits for held keys",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "k",
    code: "KeyK",
  });
  assert.equal(
    await evaluate("!!document.querySelector('[data-arc-command-palette]')"),
    false,
  );
  assert.deepEqual(
    await evaluate("pageKeys"),
    [],
    "toggle dismissal must contain final keyup",
  );
  await evaluate(`globalThis.chrome.runtime.sendMessage=async message=>{
    if(message.type!=='palette:suggest'){messages.push(message);return {ok:true};}
    await new Promise(resolve=>setTimeout(resolve,message.query==='a'?400:10));
    return {ok:true,suggestions:message.query?[{kind:'bookmark',sources:['bookmark'],title:message.query+' saved',url:'https://saved.example/'+message.query}]:[],warnings:[]};
  }`);
  await mount([]);
  await key("a", "KeyA", "a");
  await evaluate("new Promise(resolve=>setTimeout(resolve,180))");
  await key("b", "KeyB", "b");
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await evaluate("new Promise(resolve=>setTimeout(resolve,250))");
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages")).at(-1),
    { type: "palette:navigate", query: "https://saved.example/ab" },
    "Enter must open the first suggestion URL; stale responses must not replace new results",
  );
  assert.deepEqual(
    await evaluate("pageKeys"),
    [],
    "suggestion interactions stay isolated",
  );
  await evaluate(`chrome.runtime.connect=()=>{let receive, disconnect;return {
    onMessage:{addListener:listener=>{receive=listener;}},
    onDisconnect:{addListener:listener=>{disconnect=listener;}},
    disconnect:()=>disconnect(),
    postMessage:()=>receive({ok:true,suggestions:[{kind:'history',sources:['history'],title:'Project',url:'https://github.com/org/project'}],
      domains:[{kind:'domain',sources:['domain'],title:'Open github.com',url:'https://github.com/'}],warnings:[]})
  };}`);
  await mount([]);
  await key("g", "KeyG", "g");
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  assert.deepEqual(
    await paletteCall(
      `function(){return [...this.querySelectorAll('.result .title')].slice(0,2).map(row=>row.textContent);}`,
    ),
    ["Open github.com", "Project"],
    "streamed history and homepage should appear without scrolling",
  );
  const beforeCompletion = await evaluate("messages.length");
  await key("Tab", "Tab");
  assert.equal(
    await evaluate("messages.length"),
    beforeCompletion,
    "Tab must not navigate",
  );
  await key("Enter", "Enter");
  assert.equal(
    (await evaluate("messages")).findLast(
      (message) => message.type === "palette:navigate",
    ).query,
    "https://github.com/",
    "Tab must complete the initially selected homepage",
  );
  await mount([]);
  await key("g", "KeyG", "g");
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("ArrowDown", "ArrowDown");
  await key("Tab", "Tab");
  await key("Enter", "Enter");
  assert.equal(
    (await evaluate("messages")).findLast(
      (message) => message.type === "palette:navigate",
    ).query,
    "https://github.com/org/project",
    "ArrowDown must select the history page before Tab completes it",
  );
  assert.deepEqual(
    await evaluate("pageKeys"),
    [],
    "completion and homepage selection must stay isolated",
  );
  await evaluate("delete chrome.runtime.connect");
  await evaluate(`globalThis.commandRows=${JSON.stringify(commandSuggestions(""))};globalThis.chrome.runtime.sendMessage=async message=>{
    if(message.type!=='palette:suggest'){messages.push(message);return {ok:true};}
    if(message.mode==='commands')return {ok:true,suggestions:commandRows.filter(row=>row.title.toLowerCase().includes(message.query.toLowerCase())),warnings:[]};
    if(message.mode==='closed')return {ok:true,suggestions:[{kind:'closed',sessionId:'closed-7',title:'Closed page',url:'https://closed.example'}],warnings:[]};
    return {ok:true,suggestions:(mockTabs||[]).filter(tab=>(tab.title+' '+tab.url).toLowerCase().includes(message.query.toLowerCase())).map(tab=>({...tab,kind:'tab',sources:['tab']})),warnings:[]};
  }`);
  const context = {
    sites: DISCOVERED_SITES,
    sourceUrl: "https://current.example/page",
  };
  await mount([], context);
  await send("Input.insertText", { text: "yt cats & dogs" });
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages"))
      .filter((message) => message.type !== "palette:remember-site")
      .at(-1),
    {
      type: "palette:site",
      site: "auto:https://www.youtube.com",
      query: "cats & dogs",
    },
    "inline shortcut + query must search its site without Tab",
  );
  const lastAction = async () =>
    (await evaluate("messages"))
      .filter((message) => message.type !== "palette:remember-site")
      .at(-1);
  const providerContext = {
    ...context,
    sites: [...context.sites, ...BUILTIN_SITES],
  };
  for (const [alias, provider] of [
    ["g", "google"],
    ["я", "yandex"],
    ["gpt", "chatgpt"],
    ["gem", "gemini"],
    ["claude", "claude"],
    ["grok", "grok"],
    ["pplx", "perplexity"],
  ]) {
    await mount([], providerContext);
    await send("Input.insertText", { text: `${alias} Привет & + second line` });
    await key("Enter", "Enter");
    assert.deepEqual(await lastAction(), {
      type: "palette:site",
      site: `provider:${provider}`,
      query: "Привет & + second line",
    });
  }
  await mount([], providerContext);
  await send("Input.insertText", { text: "GEM   explain closures" });
  await key("Enter", "Enter", undefined, 8);
  assert.deepEqual(await lastAction(), {
    type: "palette:site",
    site: "provider:gemini",
    query: "explain closures",
    target: "background",
  });
  await mount([], providerContext);
  await send("Input.insertText", { text: "g explain closures" });
  await key("Tab", "Tab");
  assert.equal(
    await paletteCall(`function(){return this.querySelector('input').value;}`),
    "explain closures",
  );
  await key("Enter", "Enter");
  assert.deepEqual(await lastAction(), {
    type: "palette:site",
    site: "provider:google",
    query: "explain closures",
  });
  await mount([], providerContext);
  await send("Input.insertText", { text: "unknownalias plain request" });
  await key("Enter", "Enter");
  assert.deepEqual(await lastAction(), {
    type: "palette:navigate",
    query: "unknownalias plain request",
  });
  const shared = [
    {
      key: "first",
      name: "First",
      aliases: ["same"],
      template: "https://one.example/?q=%s",
    },
    {
      key: "second",
      name: "Second",
      aliases: ["same"],
      template: "https://two.example/?q=%s",
    },
  ];
  await mount([], { ...context, sites: shared });
  await send("Input.insertText", { text: "same query" });
  await key("Enter", "Enter");
  assert.deepEqual(
    await lastAction(),
    { type: "palette:navigate", query: "same query" },
    "shared exact shortcuts must not silently pick a provider",
  );
  await mount([], { ...context, sites: shared });
  await send("Input.insertText", { text: "same query" });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("ArrowDown", "ArrowDown");
  await key("Enter", "Enter");
  assert.deepEqual(await lastAction(), {
    type: "palette:site",
    site: "first",
    query: "query",
  });

  await evaluate(`const previousSend=chrome.runtime.sendMessage;chrome.runtime.sendMessage=async message=>{
    if(message.type==='palette:suggest' && message.mode==='drafts')return {ok:true,suggestions:[{kind:'ai-draft',draftId:'saved-1',title:'Gemini: Original prompt',url:'Recover prompt'}],warnings:[]};
    if(message.type==='palette:recover'){messages.push(message);return {ok:true,alias:'gem',query:'Original prompt',learnedProvider:'provider:claude'};}
    return previousSend(message);
  };`);
  await mount([], providerContext);
  await send("Input.insertText", { text: "?" });
  await key("Enter", "Enter");
  assert.equal(
    await paletteCall(`function(){return this.querySelector('input').value;}`),
    "gem Original prompt",
  );
  assert.deepEqual(
    await lastAction(),
    { type: "palette:recover", draftId: "saved-1" },
    "recovery must not immediately navigate or resubmit",
  );
  // Only the shortcut is selected so another AI can be chosen without losing the prompt.
  await send("Input.insertText", { text: "gpt" });
  await key("Enter", "Enter");
  assert.deepEqual(await lastAction(), {
    type: "palette:site",
    site: "provider:chatgpt",
    query: "Original prompt",
  });
  await mount([], context);
  await key("Tab", "Tab");
  await send("Input.insertText", { text: "reload" });
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages")).at(-1),
    {
      type: "palette:command",
      command: "reload",
      selectionQuery: "reload",
      selectionIndex: 0,
      suggestedCommand: "reload",
    },
    "empty Tab enters explicit commands",
  );
  await mount([], context);
  await send("Input.insertText", { text: "yt" });
  await key("Tab", "Tab");
  await send("Input.insertText", { text: "cats & dogs" });
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages")).at(-1),
    {
      type: "palette:site",
      site: "auto:https://www.youtube.com",
      query: "cats & dogs",
    },
    "keyword Tab scopes an automatically discovered site",
  );
  await mount([], { ...context, mode: "edit" });
  await send("Input.insertText", { text: "new.example" });
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages")).at(-1),
    { type: "palette:navigate", query: "new.example", target: "current" },
    "edit mode replaces only source tab",
  );
  await mount([], context);
  await send("Input.insertText", { text: "background.example" });
  await key("Enter", "Enter", undefined, 8);
  assert.deepEqual(
    (await evaluate("messages")).at(-1),
    {
      type: "palette:navigate",
      query: "background.example",
      target: "background",
    },
    "Shift+Enter opens in background",
  );
  await mount([], context);
  await send("Input.insertText", { text: "replace.example" });
  await key("Enter", "Enter", undefined, 1);
  assert.deepEqual(
    (await evaluate("messages")).at(-1),
    { type: "palette:navigate", query: "replace.example", target: "current" },
    "Alt+Enter explicitly replaces current page",
  );
  await mount([], context);
  await send("Input.insertText", { text: "<" });
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages")).at(-1),
    { type: "palette:restore", sessionId: "closed-7" },
    "closed mode restores session",
  );
  assert.deepEqual(
    await evaluate("pageKeys"),
    [],
    "all command-bar modes must isolate keyboard events",
  );
  await evaluate(`globalThis.chrome.runtime.sendMessage=async message=>{
    if(message.type!=='palette:suggest'){messages.push(message);return {ok:true};}
    await new Promise(resolve=>setTimeout(resolve,200));
    return {ok:true,suggestions:message.query==='fast'?[{kind:'bookmark',title:'Fast destination',url:'https://fast.example/'}]:[],warnings:[]};
  }`);
  await mount([], context);
  await send("Input.insertText", { text: "fast" });
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages")).at(-1),
    { type: "palette:navigate", query: "https://fast.example/" },
    "early Enter must wait for final suggestions, not provisional raw navigation",
  );
  await mount([], context);
  await send("Input.insertText", { text: "reload" });
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages")).at(-1),
    { type: "palette:navigate", query: "reload" },
    "ordinary searches must not execute commands",
  );
  // Mark multiple results, group them, then manage groups without a toolbar.
  const groupApi = {
    tabGroups: {
      query: async () => [
        { id: 7, windowId: 2, title: "Work", color: "blue", collapsed: false },
      ],
      get: async () => ({
        id: 7,
        windowId: 2,
        title: "Work",
        color: "blue",
        collapsed: false,
      }),
    },
  };
  const groupContext = {
    ...context,
    sourceTabId: 81,
    groupColors: GROUP_COLORS,
  };
  const groupRows = await groupSuggestions(groupApi, 2, "");
  const workRows = await groupSuggestions(groupApi, 2, "Work");
  const manageRows = await manageGroupSuggestions(groupApi, 2, "");
  const actionRows = await groupActionSuggestions(groupApi, 2, 7, "");
  await evaluate(`globalThis.workRows=${JSON.stringify(workRows)};globalThis.groupRows=${JSON.stringify(groupRows)};globalThis.manageRows=${JSON.stringify(manageRows)};globalThis.groupActionRows=${JSON.stringify(actionRows)};globalThis.groupFails=false;
    chrome.runtime.sendMessage=async message=>{
      if(message.type!=='palette:suggest'){messages.push(message);if(message.type==='palette:group' && groupFails)return {ok:false,error:'Selected tab was closed'};return {ok:true};}
      if(message.mode==='groups' && message.query==='Work')return {ok:true,suggestions:workRows,warnings:[]};
      if(message.mode==='groups')return {ok:true,suggestions:[{...groupRows[0],name:message.query || 'New group',title:'Create group'},...groupRows.slice(1).filter(row=>row.title.toLowerCase().includes(message.query.toLowerCase()))],warnings:[]};
      if(message.mode==='group-manage')return {ok:true,suggestions:manageRows.filter(row=>row.title.toLowerCase().includes(message.query.toLowerCase())),warnings:[]};
      if(message.mode==='group-actions')return {ok:true,suggestions:groupActionRows.filter(row=>row.title.toLowerCase().includes(message.query.toLowerCase())),warnings:[]};
      return {ok:true,suggestions:mockTabs.map(tab=>({...tab,kind:'tab',sources:['tab']})),warnings:[]};
    };`);
  const selectableTabs = [
    {
      id: 81,
      title: "Alpha",
      url: "https://alpha.example",
      groupTitle: "Work",
      groupColor: "purple",
    },
    { id: 82, title: "Beta", url: "https://beta.example" },
  ];
  await mount(selectableTabs, groupContext);
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('.group-badge').textContent;}`,
    ),
    "Work",
  );
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('[data-group-color]').dataset.groupColor;}`,
    ),
    "purple",
  );
  await key(" ", "Space", " ", 8);
  await key("ArrowDown", "ArrowDown");
  await key(" ", "Space", " ", 8);
  assert.equal(
    await paletteCall(
      `function(){return this.querySelectorAll('[aria-checked="true"]').length;}`,
    ),
    2,
  );
  await key("g", "KeyG", "", 4);
  await send("Input.insertText", { text: "Research" });
  await key("Enter", "Enter");
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:group",
    action: "create",
    tabIds: [81, 82],
    title: "Research",
  });
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('input').isConnected;}`,
    ),
    "grouping must keep the palette open",
  );
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("g", "KeyG", "", 2);
  await send("Input.insertText", { text: "Work" });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("Enter", "Enter");
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:group",
    action: "add",
    tabIds: [81],
    groupId: 7,
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("g", "KeyG", "", 12);
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:group",
    action: "remove",
    tabIds: [81],
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("g", "KeyG", "", 5);
  await key("Enter", "Enter");
  await key("Enter", "Enter");
  await send("Input.insertText", { text: "Renamed" });
  await key("Enter", "Enter");
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:group",
    action: "rename",
    groupId: 7,
    title: "Renamed",
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("g", "KeyG", "", 3);
  await key("Enter", "Enter");
  await send("Input.insertText", { text: "color" });
  await key("Enter", "Enter");
  await send("Input.insertText", { text: "purple" });
  await key("Enter", "Enter");
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:group",
    action: "color",
    groupId: 7,
    color: "purple",
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("g", "KeyG", "", 5);
  await key("Enter", "Enter");
  await send("Input.insertText", { text: "ungroup" });
  await key("Enter", "Enter");
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:group",
    action: "dissolve",
    groupId: 7,
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await send("Input.insertText", { text: "#Broken" });
  await evaluate("groupFails=true");
  await key("Enter", "Enter");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('#error').textContent;}`,
    ),
    "Selected tab was closed",
  );
  await key("Escape", "Escape");
  await key("Escape", "Escape");
  assert.deepEqual(
    await evaluate("pageKeys"),
    [],
    "group keys must remain isolated from the page",
  );
  // Folder-scoped bookmarking reuses marked selection and keeps the palette open.
  await evaluate(`globalThis.bookmarkFails=false;chrome.runtime.sendMessage=async message=>{
    if(message.type==='palette:suggest') {
      if(message.mode==='bookmark-folders')return {ok:true,suggestions:[{kind:'bookmark-folder',folderId:'work',title:'Bookmarks bar / Work',url:message.operation==='remove'?'Remove 2 matching bookmarks here':'Save selected tabs here'}],warnings:[]};
      if(message.mode==='commands')return {ok:true,suggestions:commandRows.filter(row=>row.title.toLowerCase().includes(message.query.toLowerCase())),warnings:[]};
      return {ok:true,suggestions:mockTabs.map(tab=>({...tab,kind:'tab',sources:['tab']})),warnings:[]};
    }
    messages.push(message);
    if(message.type==='palette:bookmark' && bookmarkFails)return {ok:false,error:'Folder was removed'};
    if(message.type==='palette:bookmark')return {ok:true,changed:message.tabIds.length,skipped:0,folderPath:'Bookmarks bar / Work'};
    return {ok:true};
  };`);
  await mount(selectableTabs, groupContext);
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key(" ", "Space", " ", 8);
  await key("ArrowDown", "ArrowDown");
  await key(" ", "Space", " ", 8);
  await key("d", "KeyD", "", 4);
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('[data-source=bookmark-folder]').textContent;}`,
    ),
    "Bookmark folder",
  );
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('input').placeholder;}`,
    ),
    "Choose a folder to save bookmarks…",
  );
  await send("Input.insertText", { text: "Work" });
  await key("Enter", "Enter");
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:bookmark",
    operation: "add",
    tabIds: [81, 82],
    folderId: "work",
  });
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('footer').textContent.includes('Saved 2');}`,
    ),
  );
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("d", "KeyD", "", 10);
  await key("Enter", "Enter");
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:bookmark",
    operation: "remove",
    tabIds: [81],
    folderId: "work",
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("ArrowDown", "ArrowDown");
  await key("d", "KeyD", "", 2);
  await key("d", "KeyD", "", 10);
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages")).at(-1),
    {
      type: "palette:bookmark",
      operation: "remove",
      tabIds: [82],
      folderId: "work",
    },
    "switching save/remove must keep the original chosen tab",
  );
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await evaluate("bookmarkFails=true");
  await key("d", "KeyD", "", 4);
  await key("Enter", "Enter");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('#error').textContent;}`,
    ),
    "Folder was removed",
  );
  await evaluate("bookmarkFails=false");
  await key("Enter", "Enter");

  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await send("Input.insertText", { text: "*Work" });
  await key("Enter", "Enter");
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:bookmark",
    operation: "add",
    tabIds: [81],
    folderId: "work",
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("Tab", "Tab");
  await send("Input.insertText", { text: "bookmark selected" });
  await key("Enter", "Enter");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('input').placeholder;}`,
    ),
    "Choose a folder to save bookmarks…",
  );
  await key("Escape", "Escape");
  await key("Escape", "Escape");
  assert.deepEqual(
    await evaluate("pageKeys"),
    [],
    "bookmark keys must not reach the host page",
  );
  // Browser sections participate in ordinary Search and URL completion.
  const chromeRows = browserPageSuggestions("расширения");
  const openChromeRows = mergeBrowserPages(
    [],
    [{ id: 71, title: "Localized Chrome page", url: "chrome://extensions/" }],
    "расширения",
  );
  await evaluate(`globalThis.chromeRows=${JSON.stringify(chromeRows)};globalThis.openChromeRows=${JSON.stringify(openChromeRows)};globalThis.useOpenChrome=false;
    globalThis.chrome.runtime.sendMessage=async message=>{
      if(message.type==='palette:suggest')return {ok:true,suggestions:useOpenChrome?openChromeRows:chromeRows,warnings:[]};
      messages.push(message);return {ok:true};
    };`);
  await mount([], context);
  await send("Input.insertText", { text: "расширения" });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('#results').textContent.includes('Chrome page');}`,
    ),
  );
  await key("Tab", "Tab");
  assert.equal(
    await paletteCall(`function(){return this.querySelector('input').value;}`),
    "chrome://extensions/",
  );
  await key("Enter", "Enter");
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:navigate",
    query: "chrome://extensions/",
  });
  await evaluate("useOpenChrome=true");
  await mount([], context);
  await send("Input.insertText", { text: "расширения" });
  await key("Enter", "Enter");
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:activate",
    tabId: 71,
    selectionQuery: "расширения",
  });
  assert.deepEqual(
    await evaluate("pageKeys"),
    [],
    "Chrome page search must isolate host shortcuts",
  );
  // Arrange is a two-step action: choosing a tab never activates/navigates it.
  const arrangeApi = {
    tabs: {
      query: async () => [
        {
          id: 41,
          windowId: 2,
          index: 0,
          title: "Alpha",
          url: "https://alpha.example",
        },
        {
          id: 42,
          windowId: 2,
          index: 1,
          title: "Beta",
          url: "https://beta.example",
        },
      ],
    },
  };
  const arrangeRows = await orderSuggestions(arrangeApi, 2, "");
  const moveRows = await orderSuggestions(arrangeApi, 2, "", 41);
  await evaluate(`globalThis.arrangeRows=${JSON.stringify(arrangeRows)};globalThis.moveRows=${JSON.stringify(moveRows)};globalThis.failMove=true;
    globalThis.chrome.runtime.sendMessage=async message=>{
      if(message.type==='palette:suggest') {
        const rows=message.mode==='order'?(message.tabId===undefined?arrangeRows:moveRows):message.mode==='commands'?commandRows:arrangeRows.map(row=>({...row,kind:'tab',id:row.tabId}));
        return {ok:true,suggestions:rows.filter(row=>(row.title+' '+row.url).toLowerCase().includes(message.query.toLowerCase())),warnings:[]};
      }
      messages.push(message);
      if(message.type==='palette:move' && failMove)return {ok:false,error:'Tab changed; choose again'};
      return {ok:true};
    };`);
  await mount([], context);
  await key("Tab", "Tab");
  await send("Input.insertText", { text: "arrange" });
  await key("Enter", "Enter");
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('footer').textContent.startsWith('Arrange tabs');}`,
    ),
  );
  await key("Tab", "Tab");
  assert.equal(
    await paletteCall(`function(){return this.querySelector('input').value;}`),
    "",
    "Tab in Arrange must keep input focus, never insert a position label",
  );
  await key("Tab", "Tab", undefined, 8);
  await key("Enter", "Enter");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('input').placeholder;}`,
    ),
    "Choose a position or a destination tab…",
  );
  await key("Escape", "Escape");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('input').placeholder;}`,
    ),
    "Choose a tab to move…",
  );
  await key("Enter", "Enter");
  await send("Input.insertText", { text: "before Beta" });
  await key("k", "KeyK", "", 4);
  await key("Enter", "Enter");
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:move",
    tabId: 41,
    placement: "before",
    beforeTabId: 42,
  });
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('#error').textContent;}`,
    ),
    "Tab changed; choose again",
  );
  assert.equal(
    await paletteCall(`function(){return this.querySelector('input').value;}`),
    "before Beta",
    "failed contextual placement restores its source input",
  );
  await evaluate("failMove=false");
  await key("Enter", "Enter");
  assert.equal(
    await evaluate(
      "document.querySelector('[data-arc-command-palette]') === null",
    ),
    true,
  );
  assert.deepEqual(
    await evaluate("pageKeys"),
    [],
    "arrange mode must also isolate page shortcuts",
  );
  // Prefixes and immediate moves keep the selected tab after refreshing the list.
  await mount([], context);
  await send("Input.insertText", { text: "@" });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("ArrowDown", "ArrowDown");
  await evaluate(`const baseSend=chrome.runtime.sendMessage;chrome.runtime.sendMessage=async message=>{
    const response=await baseSend(message);
    if(message.type==='palette:move' && response.ok)arrangeRows.reverse();
    return response;
  };`);
  await key("ArrowLeft", "ArrowLeft", undefined, 1);
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:move",
    tabId: 42,
    placement: "left",
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('[aria-selected="true"]').textContent.includes('Beta');}`,
    ),
  );
  const beforeBurst = (await evaluate("messages")).filter(
    (message) => message.type === "palette:move",
  ).length;
  await evaluate(`const quickSend=chrome.runtime.sendMessage;globalThis.movesInFlight=0;globalThis.maxMovesInFlight=0;chrome.runtime.sendMessage=async message=>{
    if(message.type!=='palette:move')return quickSend(message);
    movesInFlight++;maxMovesInFlight=Math.max(maxMovesInFlight,movesInFlight);
    await new Promise(resolve=>setTimeout(resolve,80));
    try{return await quickSend(message);}finally{movesInFlight--;}
  };`);
  for (let index = 0; index < 4; index++)
    await key("ArrowLeft", "ArrowLeft", undefined, 1);
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('#results').children.length>0;}`,
    ),
    "list must not disappear while movement is in flight",
  );
  await evaluate("new Promise(resolve=>setTimeout(resolve,800))");
  const burst = (await evaluate("messages"))
    .filter((message) => message.type === "palette:move")
    .slice(beforeBurst);
  assert.equal(burst.length, 4, "every repeated move must be retained");
  assert.ok(burst.every((message) => message.tabId === 42));
  assert.equal(await evaluate("maxMovesInFlight"), 1);
  await evaluate("chrome.runtime.sendMessage=quickSend");
  await key("ArrowUp", "ArrowUp", undefined, 1);
  assert.deepEqual(
    (await evaluate("messages")).at(-1),
    { type: "palette:move", tabId: 42, placement: "left" },
    "Alt+Up must move to the previous vertical position",
  );
  await key("ArrowDown", "ArrowDown", undefined, 1);
  assert.deepEqual(
    (await evaluate("messages")).at(-1),
    { type: "palette:move", tabId: 42, placement: "right" },
    "Alt+Down must move to the next vertical position",
  );
  await key("ArrowUp", "ArrowUp", undefined, 9);
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:move",
    tabId: 42,
    placement: "start",
  });
  await key("ArrowDown", "ArrowDown", undefined, 9);
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:move",
    tabId: 42,
    placement: "end",
  });

  await key("ArrowRight", "ArrowRight", undefined, 9);
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:move",
    tabId: 42,
    placement: "end",
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("Escape", "Escape");
  await key("Escape", "Escape");
  await mount([], context);
  await send("Input.insertText", { text: "@Beta" });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  assert.equal(
    await paletteCall(`function(){return this.querySelector('input').value;}`),
    "Beta",
  );
  await key("Escape", "Escape");
  await key("Escape", "Escape");
  await mount([], context);
  await send("Input.insertText", { text: "Beta" });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("ArrowRight", "ArrowRight", undefined, 1);
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:move",
    tabId: 42,
    placement: "right",
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('footer').textContent.startsWith('Arrange tabs');}`,
    ),
  );
  await key("Escape", "Escape");
  await key("Escape", "Escape");
  await mount([], context);
  await send("Input.insertText", { text: "> settings" });
  await key("Enter", "Enter");
  assert.deepEqual((await evaluate("messages")).at(-1), {
    type: "palette:command",
    command: "settings",
    selectionQuery: "settings",
    selectionIndex: 0,
    suggestedCommand: "settings",
  });
  await mount([], context);
  await send("Input.insertText", { text: "> edit current url" });
  await key("Enter", "Enter");
  assert.equal(
    await paletteCall(`function(){return this.querySelector('input').value;}`),
    context.sourceUrl,
  );
  await key("Escape", "Escape");
  await key("Escape", "Escape");

  // Contextual actions, frozen provider queries, quicklinks and calculator clipboard flow.
  await evaluate(`globalThis.savedLinks=[];globalThis.copiedValues=[];
    chrome.runtime.sendMessage=async message=>{
      if(message.type==='palette:suggest') {
        if(message.mode==='commands')return {ok:true,suggestions:commandRows.filter(row=>row.title.toLowerCase().includes(message.query.toLowerCase())),warnings:[]};
        if(message.mode==='quicklinks')return {ok:true,suggestions:savedLinks,warnings:[]};
        if(message.query==='1250 * 0.18')return {ok:true,suggestions:[{kind:'calculator',title:'225',url:message.query,copyText:'225',sources:['calculator']}],warnings:[]};
        if(message.mode==='bookmark-folders')return {ok:true,suggestions:[{kind:'bookmark-folder',folderId:'work',title:'Bookmarks bar / Work',url:'Save selected tabs here'}],warnings:[]};
        return {ok:true,suggestions:mockTabs.filter(tab=>(tab.title+' '+tab.url).toLowerCase().includes(message.query.toLowerCase())).map(tab=>({...tab,kind:'tab',sources:['tab']})),warnings:[]};
      }
      if(message.type==='palette:icons')return {ok:true,images:message.urls.map(()=> 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')};
      messages.push(message);
      if(message.type==='palette:quicklink' && message.operation==='save')savedLinks=[{kind:'quicklink',linkId:'quicklink:demo',title:message.name,url:'https://alpha.example/',sources:['quicklink']}];
      if(message.type==='palette:quicklink' && message.operation==='remove')savedLinks=[];
      if(message.type==='palette:bookmark')return {ok:true,changed:message.tabIds.length,skipped:0,folderPath:'Bookmarks bar / Work'};
      return {ok:true};
    };`);
  await mount(selectableTabs, {
    ...groupContext,
    sites: BUILTIN_SITES,
    favicons: true,
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('.icon img')!==null;}`,
    ),
    "browser-cache images decorate results without replacing selection controls",
  );
  await key("ArrowDown", "ArrowDown");
  await key("k", "KeyK", "", 4);
  assert.match(
    await paletteCall(
      `function(){return this.querySelector('input').placeholder;}`,
    ),
    /Actions.*Beta/,
  );
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('#results').textContent.includes('Save in a bookmark folder');}`,
    ),
  );
  await key("Escape", "Escape");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('[aria-selected=true] .title').textContent;}`,
    ),
    "Beta",
    "Esc restores the selected result",
  );
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "duplicate" });
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages")).findLast(
      (message) => message.type === "palette:tab-action",
    ),
    { type: "palette:tab-action", action: "duplicate", tabId: 82 },
  );
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key(" ", "Space", " ", 8);
  await key("ArrowDown", "ArrowDown");
  await key(" ", "Space", " ", 8);
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "save in a bookmark" });
  await key("Enter", "Enter");
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages")).findLast(
      (message) => message.type === "palette:bookmark",
    ).tabIds,
    [81, 82],
  );
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "save as quicklink" });
  await key("Enter", "Enter");
  await send("Input.insertText", { text: "Work portal" });
  await key("Enter", "Enter");
  assert.equal(
    (await evaluate("messages")).findLast(
      (message) => message.type === "palette:quicklink",
    ).name,
    "Work portal",
  );
  await send("Input.insertText", { text: "$" });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('.title').textContent;}`,
    ),
    "Work portal",
  );
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "rename quicklink" });
  await key("Enter", "Enter");
  await send("Input.insertText", { text: "Renamed portal" });
  await key("Enter", "Enter");
  assert.equal(
    (await evaluate("messages")).findLast(
      (message) => message.type === "palette:quicklink",
    ).id,
    "quicklink:demo",
    "renaming updates the existing entry",
  );
  await send("Input.insertText", { text: "$" });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "remove quicklink" });
  await key("Enter", "Enter");
  assert.equal(await evaluate("savedLinks.length"), 0);
  await key("Escape", "Escape");
  await send("Input.insertText", { text: "explain CSS grid" });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  assert.ok(
    await paletteCall(
      `function(){const text=this.querySelector('#results').textContent;return text.includes('Search the web') && !text.includes('Search Google AI Mode');}`,
    ),
    "ordinary search offers one web fallback",
  );
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "search this query" });
  await key("Enter", "Enter");
  await key("Escape", "Escape");
  assert.equal(
    await paletteCall(`function(){return this.querySelector('input').value;}`),
    "explain CSS grid",
    "cancel provider selection keeps the original query",
  );
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "search this query" });
  await key("Enter", "Enter");
  await send("Input.insertText", { text: "claude" });
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages")).findLast(
      (message) => message.type === "palette:site",
    ),
    {
      type: "palette:site",
      site: "provider:claude",
      query: "explain CSS grid",
    },
  );
  await mount([], { sites: BUILTIN_SITES });
  await send("Input.insertText", { text: "1250 * 0.18" });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await paletteCall(
    `function(){Object.defineProperty(this.ownerDocument.defaultView.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{this.dataset.copied=text;}}});}`,
  );
  await key("Enter", "Enter");
  assert.equal(
    await paletteCall(`function(){return this.dataset.copied;}`),
    "225",
  );
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('footer').textContent.includes('Copied 225');}`,
    ),
  );
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "copy result" });
  await key("Enter", "Enter");
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('.title').textContent;}`,
    ),
    "225",
    "calculator primary action restores the calculator list after copying",
  );
  await key("Escape", "Escape");
  await mount(selectableTabs, { ...groupContext, sites: BUILTIN_SITES });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("ArrowDown", "ArrowDown");
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "no-such-action" });
  await key("k", "KeyK", "", 4);
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('[aria-selected=true] .title').textContent;}`,
    ),
    "Beta",
    "action toggle returns even when its filter has no results",
  );
  await key("k", "KeyK", "", 4);
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages")).findLast(
      (message) => message.type === "palette:activate",
    ),
    { type: "palette:activate", tabId: 82, selectionQuery: "" },
    "menu primary action uses the frozen selected result",
  );
  await mount([], { sites: BUILTIN_SITES });
  await send("Input.insertText", { text: "gpt keep this prompt" });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "search this query" });
  await key("Enter", "Enter");
  await send("Input.insertText", { text: "google ai mode" });
  await key("Enter", "Enter");
  assert.deepEqual(
    (await evaluate("messages")).findLast(
      (message) => message.type === "palette:site",
    ),
    {
      type: "palette:site",
      site: "provider:gemini",
      query: "keep this prompt",
    },
    "redirect drops only the recognized provider alias",
  );

  await mount([], { sites: BUILTIN_SITES });
  await send("Input.insertText", { text: ">search current query" });
  await key("Enter", "Enter");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('#error').textContent;}`,
    ),
    "Type a query first",
    "command prefix is not a search query",
  );
  await key("Escape", "Escape");
  await key("Escape", "Escape");

  // Notes CRUD, multiline editing and the complete searchable shortcut menu.
  await evaluate(`globalThis.mockNotes=[];globalThis.noteFails=false;
    chrome.runtime.sendMessage=async message=>{
      if(message.type==='palette:suggest') {
        if(message.mode==='notes' || !message.mode)return {ok:true,suggestions:mockNotes.filter(note=>(note.title+' '+note.body).toLowerCase().includes(message.query.toLowerCase())).map(note=>({kind:'note',noteId:note.id,revision:note.revision,title:note.title,url:'',description:note.body,sources:['note']})),warnings:[]};
        if(message.mode==='commands')return {ok:true,suggestions:commandRows.filter(row=>row.title.toLowerCase().includes(message.query.toLowerCase())),warnings:[]};
        return {ok:true,suggestions:[],warnings:[]};
      }
      messages.push(message);
      if(message.type==='palette:note') {
        if(message.operation==='get')return {ok:true,note:mockNotes.find(note=>note.id===message.id)};
        if(noteFails)return {ok:false,error:'Note changed elsewhere'};
        if(message.operation==='remove'){mockNotes=mockNotes.filter(note=>note.id!==message.id);return {ok:true};}
        const note={id:message.id || 'note:demo',title:message.title,body:message.body,revision:(mockNotes.find(note=>note.id===message.id)?.revision || 0)+1};
        mockNotes=[note];return {ok:true,note};
      }
      return {ok:true};
    };`);
  await mount([], {
    ...context,
    shortcuts: PALETTE_CATALOG.shortcuts.map((row) =>
      row.global === "open-search" ? { ...row, shortcut: "Alt+Q" } : row,
    ),
  });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("k", "KeyK", "", 4);
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('#results').textContent.includes('New note');}`,
    ),
    "actions work even without a selected result",
  );
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('#results').textContent.includes('Move Spotlight in larger steps');}`,
    ),
    "geometry hotkeys are discoverable in the main action menu",
  );
  await send("Input.insertText", { text: "open / close spotlight" });
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('#results kbd').textContent.replace('⌥','Alt');}`,
    ),
    "Alt+Q",
    "shows configured global binding",
  );
  await key("Escape", "Escape");
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "new note" });
  await key("Enter", "Enter");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('#note-body').hidden;}`,
    ),
    false,
  );
  await send("Input.insertText", { text: "Meeting" });
  await key("Tab", "Tab");
  await send("Input.insertText", { text: "First line" });
  await key("Enter", "Enter", "\r");
  await send("Input.insertText", { text: "Обсудить проект <b>literal</b>" });
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('#note-body').value;}`,
    ),
    "First line\nОбсудить проект <b>literal</b>",
  );
  await key("Enter", "Enter", "", 4);
  assert.equal(await evaluate("mockNotes[0].title"), "Meeting");
  assert.equal(
    await evaluate("mockNotes[0].body"),
    "First line\nОбсудить проект <b>literal</b>",
  );
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('footer').textContent.includes('Note saved');}`,
    ),
  );
  await paletteCall(
    `function(){Object.defineProperty(this.ownerDocument.defaultView.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{this.dataset.copied=text;}}});}`,
  );
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "copy note text" });
  await key("Enter", "Enter");
  assert.equal(
    await paletteCall(`function(){return this.dataset.copied;}`),
    "First line\nОбсудить проект <b>literal</b>",
  );
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  await key("k", "KeyK", "", 4);
  await key("Enter", "Enter");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('#note-body').hidden;}`,
    ),
    false,
    "primary note action opens the editor",
  );
  await key("Tab", "Tab");
  await key("Tab", "Tab");
  await key("Tab", "Tab");
  await key("Enter", "Enter");
  assert.match(
    await paletteCall(
      `function(){return this.querySelector('input').placeholder;}`,
    ),
    /Actions/,
    "Enter on editor Actions opens its menu rather than saving",
  );
  await key("Escape", "Escape");
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "all keyboard shortcuts" });
  await key("Enter", "Enter");
  await send("Input.insertText", { text: "save note" });
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('#results').textContent.includes('Note editor only');}`,
    ),
    "shortcut entries explain their scope",
  );
  await key("Escape", "Escape");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('#note-body').value;}`,
    ),
    "First line\nОбсудить проект <b>literal</b>",
    "help round trip preserves editor text",
  );
  await key("Tab", "Tab");
  await send("Input.insertText", { text: " + update" });
  await evaluate("noteFails=true");
  await key("Enter", "Enter", "", 4);
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('#error').textContent;}`,
    ),
    "Note changed elsewhere",
  );
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('#note-body').value.endsWith(' + update');}`,
    ),
    "save failure keeps edited text",
  );
  await evaluate("noteFails=false");
  await key("Enter", "Enter", "", 4);
  assert.equal(await evaluate("mockNotes[0].revision"), 2);
  await key("Escape", "Escape");
  await key("Escape", "Escape");
  await mount([], context);
  await send("Input.insertText", { text: ":проект" });
  await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
  assert.equal(
    await paletteCall(
      `function(){return this.querySelector('.title').textContent;}`,
    ),
    "Meeting",
    "notes can be found by body text after reopening",
  );
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "delete note" });
  await key("Enter", "Enter");
  assert.equal(await evaluate("mockNotes.length"), 0);
  await key("k", "KeyK", "", 4);
  await send("Input.insertText", { text: "reset spotlight position" });
  await key("Enter", "Enter");
  assert.ok(
    await paletteCall(
      `function(){return this.querySelector('footer').textContent.includes('Shortcut copied');}`,
    ),
    "informational hotkeys can be copied without executing an unrelated action",
  );
  await key("Escape", "Escape");
  await key("Escape", "Escape");
  await key("Escape", "Escape");

  // Optional documentation demo: real palette DOM, fictional tabs, disposable profile.
  if (process.env.PALETTE_SCREENSHOT_DIR) {
    await key("Escape", "Escape");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1120,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await evaluate(`document.body.innerHTML='<main><small>DEMO WORKSPACE</small><h1>A little more focus.</h1><p>Your page stays right here while you find your next destination.</p><section><article>Reading list<br><span>Ideas worth coming back to</span></article><article>Current project<br><span>One good thing at a time</span></article></section></main>';document.body.style.cssText='margin:0;background:#edf1f7;color:#243048;font:16px system-ui';const style=document.createElement('style');style.textContent='main{max-width:900px;margin:80px auto}small{letter-spacing:.18em;color:#687892}h1{font-size:48px;letter-spacing:-2px;margin:18px 0}p{color:#687892}section{display:flex;gap:20px;margin-top:60px}article{background:#ffffffaa;border:1px solid #dbe2ed;border-radius:18px;padding:28px;width:40%;font-weight:600}article span{display:block;color:#7b879b;font-size:14px;font-weight:400;margin-top:12px}';document.head.append(style);
      globalThis.chrome.runtime.sendMessage=async message=>{if(message.type!=='palette:suggest')return {ok:true};if(message.mode==='commands')return {ok:true,suggestions:commandRows,warnings:[]};return {ok:true,suggestions:(mockTabs||[]).filter(tab=>(tab.title+' '+tab.url).toLowerCase().includes(message.query.toLowerCase())).map(tab=>({...tab,kind:'tab',sources:['tab']})),warnings:[]};};`);
    const demoContext = {
      ...context,
      sites: [...BUILTIN_SITES, ...(context.sites || [])],
    };
    const demoTabs = [
      {
        id: 101,
        title: "GitHub · Arc for Chrome",
        url: "https://github.com/example/arc-for-chrome",
        groupTitle: "Development",
        groupColor: "blue",
      },
      {
        id: 102,
        title: "Chrome Extensions · Documentation",
        url: "https://developer.chrome.com/docs/extensions",
        groupTitle: "Development",
        groupColor: "blue",
      },
      {
        id: 103,
        title: "YouTube · Design inspiration",
        url: "https://www.youtube.com/",
        groupTitle: "Inspiration",
        groupColor: "purple",
      },
    ];
    await mount(demoTabs, demoContext);
    await screenshot("demo-01");
    await key("k", "KeyK", "", 4);
    await screenshot("actions");
    await key("Escape", "Escape");

    await send("Input.insertText", { text: "github" });
    await evaluate("new Promise(resolve=>setTimeout(resolve,300))");
    await screenshot("demo-02");
    await key("Escape", "Escape");
    await mount([], demoContext);
    await send("Input.insertText", { text: "yt minimal interface design" });
    await evaluate("new Promise(resolve=>setTimeout(resolve,300))");
    await screenshot("demo-03");
    await key("Escape", "Escape");
    await key("Escape", "Escape");
    await mount(demoTabs, demoContext);
    await key("Tab", "Tab");
    await evaluate("new Promise(resolve=>setTimeout(resolve,300))");
    await screenshot("demo-04");
    await key("Escape", "Escape");
    await key("Escape", "Escape");
    await evaluate(`chrome.runtime.sendMessage=async message=>{
      if(message.type!=='palette:suggest')return {ok:true};
      const rows=message.mode==='bookmark-folders'?[{kind:'bookmark-folder',folderId:'work',title:'Bookmarks bar / Work / Research',url:'Save selected tabs here'},{kind:'bookmark-folder',folderId:'reading',title:'Bookmarks bar / Reading list',url:'Save selected tabs here'}]:message.mode==='groups'?workRows:mockTabs.map(tab=>({...tab,kind:'tab',sources:['tab']}));
      return {ok:true,suggestions:rows,warnings:[]};
    };`);
    await mount(demoTabs, demoContext);
    await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
    await key(" ", "Space", " ", 8);
    await key("ArrowDown", "ArrowDown");
    await key(" ", "Space", " ", 8);
    await screenshot("selection");
    await key("g", "KeyG", "", 4);
    await send("Input.insertText", { text: "Work" });
    await evaluate("new Promise(resolve=>setTimeout(resolve,300))");
    await screenshot("groups");
    await key("Escape", "Escape");
    await key("Escape", "Escape");
    await key("Escape", "Escape");
    await mount(demoTabs, demoContext);
    await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
    await key(" ", "Space", " ", 8);
    await key("ArrowDown", "ArrowDown");
    await key(" ", "Space", " ", 8);
    await key("d", "KeyD", "", 4);
    await evaluate("new Promise(resolve=>setTimeout(resolve,300))");
    await screenshot("bookmarks");
    await key("Escape", "Escape");
    await key("Escape", "Escape");
    await key("Escape", "Escape");
    await mount([], demoContext);
    await send("Input.insertText", { text: "design a calmer browser" });
    await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
    await key("k", "KeyK", "", 4);
    await send("Input.insertText", { text: "search this query" });
    await key("Enter", "Enter");
    await screenshot("providers");
    await key("Escape", "Escape");
    await key("Escape", "Escape");
    await evaluate(
      `chrome.runtime.sendMessage=async message=>message.type==='palette:suggest'?{ok:true,suggestions:message.mode==='quicklinks'?[{kind:'quicklink',linkId:'quicklink:demo',title:'Work portal',url:'https://example.com/work',sources:['quicklink']}]:[{kind:'calculator',title:'225',url:'1250 × 0.18',copyText:'225',sources:['calculator']}],warnings:[]}:{ok:true};`,
    );
    await mount([], demoContext);
    await send("Input.insertText", { text: "1250 * 0.18" });
    await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
    await screenshot("calculator");
    await key("Escape", "Escape");
    await mount([], demoContext);
    await send("Input.insertText", { text: "$" });
    await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
    await screenshot("quicklinks");
    await key("Escape", "Escape");
    await key("Escape", "Escape");

    await evaluate(
      `globalThis.demoNote={id:'note:fictional',title:'Project notes',body:'Keep the command bar small.\\nReview tabs, links and next steps.',revision:1};chrome.runtime.sendMessage=async message=>message.type==='palette:note'?{ok:true,note:demoNote}:message.type==='palette:suggest'?{ok:true,suggestions:message.mode==='notes'?[{kind:'note',noteId:demoNote.id,revision:1,title:demoNote.title,url:'',description:demoNote.body,sources:['note']}]:[],warnings:[]}:{ok:true};`,
    );
    await mount([], demoContext);
    await send("Input.insertText", { text: ":" });
    await evaluate("new Promise(resolve=>setTimeout(resolve,220))");
    await screenshot("notes");
    await key("Enter", "Enter");
    await screenshot("note-editor");
    await key("k", "KeyK", "", 4);
    await send("Input.insertText", { text: "all keyboard shortcuts" });
    await key("Enter", "Enter");
    await screenshot("shortcuts");
    await key("Escape", "Escape");
    await key("Escape", "Escape");
    await key("Escape", "Escape");
    await key("Escape", "Escape");
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: "dark" }],
    });
    await mount(demoTabs, demoContext);
    await screenshot("demo-dark");
    await key("Escape", "Escape");
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: "light" }],
    });
  }
  // Serve the actual settings files; only Chrome APIs are stubbed, not form logic.
  const allowed = new Set([
    "options.html",
    "options.js",
    "options.css",
    "site-search.js",
    "site-discovery.js",
    "search-providers.js",
    "activity.html",
    "activity.js",
    "activity.css",
    "activity-store.js",
    "design-tokens.css",
    "page.css",
    "ai-learning/embeddings.js",
    "icons/icon-32.png",
    "icons/icon-48.png",
  ]);
  server = createServer(async (request, response) => {
    const path = new URL(request.url, "http://localhost").pathname.slice(1);
    if (!allowed.has(path)) {
      response.writeHead(404);
      response.end();
      return;
    }
    try {
      const content = await readFile(
        new URL(`../extension/${path}`, import.meta.url),
      );
      const type = path.endsWith(".js")
        ? "text/javascript"
        : path.endsWith(".css")
          ? "text/css"
          : path.endsWith(".png")
            ? "image/png"
            : "text/html";
      response.writeHead(200, { "Content-Type": type });
      response.end(content);
    } catch {
      response.writeHead(500);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `globalThis.chrome={storage:{local:{get:async()=>({}),set:async value=>{globalThis.savedSites=value.sites;}}},tabs:{create:async()=>{}}};`,
  });
  await send("Page.enable");
  const loaded = new Promise((resolve) => {
    const listener = (event) => {
      if (JSON.parse(event.data).method === "Page.loadEventFired") {
        socket.removeEventListener("message", listener);
        resolve();
      }
    };
    socket.addEventListener("message", listener);
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${server.address().port}/options.html`,
  });
  await loaded;
  assert.equal(
    await evaluate("document.querySelectorAll('.site').length"),
    0,
    "manual setup is optional and starts empty",
  );
  await evaluate("document.querySelector('#add').click()");
  await evaluate(
    `const row=document.querySelector('.site');row.querySelector('[name=name]').value='My docs';row.querySelector('[name=key]').value='docs';row.querySelector('[name=template]').value='https://docs.example/?q=%s';document.querySelector('[type=submit]').click();`,
  );
  await evaluate("new Promise(resolve=>setTimeout(resolve,20))");
  assert.deepEqual((await evaluate("savedSites"))[0], {
    key: "docs",
    name: "My docs",
    template: "https://docs.example/?q=%s",
  });
  await evaluate(
    `document.querySelector('[name=template]').value='javascript:%s';document.querySelector('[type=submit]').click();`,
  );
  await evaluate("new Promise(resolve=>setTimeout(resolve,20))");
  assert.match(
    await evaluate("document.querySelector('#status').textContent"),
    /HTTP/,
    "settings reject unsafe templates",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 900,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await screenshot("options");
  // Real activity page: limits, filtering, privacy setting and manual deletion.
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `globalThis.activityData={
    'activity:entry:first':{time:Date.now()-60000,action:'command',label:'Open Extensions',status:'ok'},
    'activity:entry:second':{time:Date.now(),action:'site',label:'Search Gemini',status:'error'}};
    globalThis.chrome={storage:{local:{get:async()=>({...activityData}),set:async rows=>Object.assign(activityData,rows),remove:async keys=>keys.forEach(key=>delete activityData[key])},onChanged:{addListener:()=>{}}}};`,
  });
  const activityLoaded = new Promise((resolve) => {
    const listener = (event) => {
      if (JSON.parse(event.data).method === "Page.loadEventFired") {
        socket.removeEventListener("message", listener);
        resolve();
      }
    };
    socket.addEventListener("message", listener);
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${server.address().port}/activity.html`,
  });
  await activityLoaded;
  assert.equal(
    await evaluate("document.querySelectorAll('#entries li').length"),
    2,
  );
  assert.equal(
    await evaluate("document.querySelector('[name=includeText]').checked"),
    false,
  );
  assert.equal(
    await evaluate("document.querySelector('[name=learn]').checked"),
    true,
  );
  await screenshot("activity");
  await evaluate(
    "const field=document.querySelector('#filter');field.value='gemini';field.dispatchEvent(new Event('input'));",
  );
  assert.equal(
    await evaluate("document.querySelectorAll('#entries li').length"),
    1,
  );
  await evaluate(
    "document.querySelector('[name=maxEntries]').value=1;document.querySelector('[name=includeText]').checked=true;document.querySelector('[name=learn]').checked=false;document.querySelector('button[type=submit]').click();",
  );
  await evaluate("new Promise(resolve=>setTimeout(resolve,20))");
  assert.equal(
    await evaluate("activityData['activity:settings'].includeText"),
    true,
  );
  assert.equal(
    await evaluate("activityData['activity:settings'].learn"),
    false,
  );
  assert.equal(
    await evaluate(
      "Object.keys(activityData).filter(key=>key.startsWith('activity:entry:')).length",
    ),
    1,
  );
  await evaluate("document.querySelector('#clear').click()");
  await evaluate("new Promise(resolve=>setTimeout(resolve,20))");
  assert.equal(
    await evaluate("document.querySelectorAll('#entries li').length"),
    0,
  );
  console.log(
    "PASS: local notes multiline create/edit/copy/delete and save retry, complete scoped shortcut reference and configured global bindings; contextual action selection/return, provider redirect/cancel, quicklink save/rename/remove, calculator copy and favicon rendering; real Chrome capture listeners isolated; palette dragging/position keys/clamping, text, Space, arrows, Escape, Enter focus restoration, suggestion selection, stale replies, Tab completion, homepage navigation, live theme changes and font scaling, command mode, Chrome section search, tab ordering, native tab-group marking/create/add/manage, folder-scoped bookmark save/removal, inline provider prompts, prompt recovery, activity-history form, site search, URL editing, modifiers session restoration and real settings-form validation verified.",
  );
} finally {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  socket?.close();
  if (processChrome.exitCode === null && processChrome.signalCode === null) {
    const exited = new Promise((resolve) =>
      processChrome.once("exit", resolve),
    );
    processChrome.kill();
    await exited;
  }
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
