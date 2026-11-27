import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearActivity,
  DEFAULT_ACTIVITY_SETTINGS,
  listActivity,
  saveActivitySettings,
} from "../extension/activity-store.js";
import { openPalette, paletteAction } from "../extension/palette-service.js";
function browser() {
  const calls = [];
  return {
    calls,
    runtime: {
      id: "test",
      getURL: (path) => `chrome-extension://test/${path}`,
    },
    tabs: {
      query: async () => [{ id: 5, windowId: 2, title: "Current" }],
      get: async (id) => ({ id, windowId: 2 }),
      create: async (options) => {
        calls.push(["create", options]);
        return { id: 99 };
      },
      update: async (...args) => {
        calls.push(["update", ...args]);
      },
    },
    search: { query: async (options) => calls.push(["search", options]) },
    scripting: {
      executeScript: async (options) => {
        calls.push(["inject", options.target]);
      },
    },
    windows: {
      update: async () => {},
      create: async (options) => calls.push(["popup", options]),
    },
  };
}
const sender = { id: "test", tab: { id: 5, windowId: 2 } };
test("opening search injects an overlay without changing or creating tabs", async () => {
  const api = browser();
  await openPalette(api, () => {});
  assert.deepEqual(api.calls, [["inject", { tabId: 5 }]]);
});
test("restricted pages fall back to a separate popup without navigating the current tab", async () => {
  const api = browser();
  api.scripting.executeScript = async () => {
    throw Error("Restricted");
  };
  await openPalette(api, () => {});
  assert.equal(api.calls[0][0], "popup");
  assert.equal(api.calls[0][1].type, "popup");
  assert.match(api.calls[0][1].url, /window=2/);
});
test("submitting search creates a new tab and leaves the current tab untouched", async () => {
  const api = browser();
  await paletteAction(api, { type: "palette:navigate", query: "cats" }, sender);
  assert.deepEqual(api.calls, [
    ["create", { windowId: 2, active: true }],
    ["search", { text: "cats", tabId: 99 }],
  ]);
});
test("selecting a result activates an existing tab", async () => {
  const api = browser();
  await paletteAction(api, { type: "palette:activate", tabId: 8 }, sender);
  assert.deepEqual(api.calls, [["update", 8, { active: true }]]);
});
test("foreign senders, malformed queries and tabs from other windows are rejected", async () => {
  const api = browser();
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:navigate", query: "x" },
      { id: "other" },
    ),
  );
  await assert.rejects(() =>
    paletteAction(api, { type: "palette:navigate", query: 12 }, sender),
  );
  api.tabs.get = async () => ({ windowId: 9 });
  await assert.rejects(() =>
    paletteAction(api, { type: "palette:activate", tabId: 8 }, sender),
  );
  assert.deepEqual(api.calls, []);
});
test("blank navigation does not create tabs", async () => {
  const api = browser();
  await paletteAction(api, { type: "palette:navigate", query: "  " }, sender);
  assert.deepEqual(api.calls, []);
});
test("fallback popup routes results to its original window", async () => {
  const api = browser();
  await paletteAction(
    api,
    { type: "palette:navigate", query: "example.com" },
    { id: "test", url: "chrome-extension://test/palette.html?window=2" },
  );
  assert.deepEqual(api.calls, [
    ["create", { windowId: 2, active: true, url: "https://example.com/" }],
  ]);
});
test("other extension pages cannot forge popup requests", async () => {
  const api = browser();
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:navigate", query: "x" },
      { id: "test", url: "chrome-extension://other/palette.html?window=2" },
    ),
  );
});
test("suggestion requests use the validated source window", async () => {
  const api = browser();
  let scoped;
  api.tabs.query = async (options) => {
    scoped = options;
    return [{ id: 8, title: "Saved page", url: "https://example.com" }];
  };
  api.bookmarks = { search: async () => [] };
  api.history = { search: async () => [] };
  const response = await paletteAction(
    api,
    { type: "palette:suggest", query: "saved" },
    sender,
  );
  assert.deepEqual(scoped, { windowId: 2 });
  assert.equal(response.suggestions[0].id, 8);
});
test("background URL navigation keeps the source window and does not activate the new tab", async () => {
  const api = browser();
  await paletteAction(
    api,
    { type: "palette:navigate", query: "example.com", target: "background" },
    sender,
  );
  assert.deepEqual(api.calls, [
    ["create", { windowId: 2, active: false, url: "https://example.com/" }],
  ]);
});
test("edit mode changes only the validated source tab", async () => {
  const api = browser();
  await paletteAction(
    api,
    { type: "palette:navigate", query: "example.com", target: "current" },
    sender,
  );
  assert.deepEqual(api.calls, [["update", 5, { url: "https://example.com/" }]]);
  api.tabs.get = async () => ({ id: 5, windowId: 9 });
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:navigate", query: "example.com", target: "current" },
      sender,
    ),
  );
});
test("re-submitting the unchanged current URL reloads the page", async () => {
  const api = browser();
  api.tabs.get = async () => ({
    id: 5,
    windowId: 2,
    url: "https://example.com/",
  });
  api.tabs.reload = async (id) => api.calls.push(["reload", id]);
  await paletteAction(
    api,
    {
      type: "palette:navigate",
      query: "https://example.com/",
      target: "current",
    },
    sender,
  );
  assert.deepEqual(api.calls, [["reload", 5]]);
});
test("site search navigates with the configured encoded template", async () => {
  const api = browser();
  api.history = {
    search: async () => [
      { title: "Example Docs", url: "https://docs.example.com/search?q=old" },
    ],
  };
  await paletteAction(
    api,
    {
      type: "palette:site",
      site: "auto:https://docs.example.com",
      query: "my project",
    },
    sender,
  );
  assert.deepEqual(api.calls, [
    [
      "create",
      {
        windowId: 2,
        active: true,
        url: "https://docs.example.com/search?q=my%20project",
      },
    ],
  ]);
});
test("command mode is explicit and unknown commands cannot execute", async () => {
  const api = browser();
  const response = await paletteAction(
    api,
    { type: "palette:suggest", query: "reload", mode: "commands" },
    sender,
  );
  assert.equal(response.suggestions[0].command, "reload");
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:command", command: "delete-all-tabs" },
      sender,
    ),
  );
});
test("closed suggestions and restoration preserve a real browser session", async () => {
  const api = browser();
  api.sessions = {
    getRecentlyClosed: async () => [
      {
        tab: {
          sessionId: "closed-1",
          title: "Project",
          url: "https://example.com",
        },
      },
    ],
    restore: async (id) => {
      api.calls.push(["restore", id]);
      return { tab: { windowId: 2 } };
    },
  };
  const response = await paletteAction(
    api,
    { type: "palette:suggest", query: "project", mode: "closed" },
    sender,
  );
  assert.equal(response.suggestions[0].sessionId, "closed-1");
  await paletteAction(
    api,
    { type: "palette:restore", sessionId: "closed-1" },
    sender,
  );
  assert.deepEqual(api.calls, [["restore", "closed-1"]]);
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:restore", sessionId: "missing" },
      sender,
    ),
  );
});
test("copy URL returns the validated source page URL", async () => {
  const api = browser();
  api.tabs.get = async () => ({
    id: 5,
    windowId: 2,
    url: "https://example.com/private",
  });
  assert.deepEqual(
    await paletteAction(
      api,
      { type: "palette:command", command: "copy-url" },
      sender,
    ),
    { copyText: "https://example.com/private" },
  );
});
test("unknown navigation targets and forged source tabs cannot replace another page", async () => {
  const api = browser();
  await assert.rejects(() =>
    paletteAction(
      api,
      {
        type: "palette:navigate",
        query: "example.com",
        target: "other-window",
      },
      sender,
    ),
  );
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:navigate", query: "example.com", target: "current" },
      { id: "test", url: "chrome-extension://test/palette.html?window=2" },
    ),
  );
  assert.deepEqual(api.calls, []);
});
test("custom saved Site Search definitions are used rather than hard-coded providers", async () => {
  const api = browser();
  api.storage = {
    local: {
      get: async () => ({
        sites: [
          {
            key: "docs",
            name: "Docs",
            template: "https://docs.example/find/%s",
          },
        ],
      }),
    },
  };
  await paletteAction(
    api,
    {
      type: "palette:site",
      site: "docs",
      query: "two words",
      target: "background",
    },
    sender,
  );
  assert.deepEqual(api.calls, [
    [
      "create",
      {
        windowId: 2,
        active: false,
        url: "https://docs.example/find/two%20words",
      },
    ],
  ]);
});
test("arranging uses validated source-window tabs and does not activate or navigate", async () => {
  const api = browser();
  const moves = [];
  api.tabs.query = async ({ windowId }) => [
    { id: 7, windowId, index: 0 },
    { id: 8, windowId, index: 1 },
  ];
  api.tabs.move = async (...args) => moves.push(args);
  const response = await paletteAction(
    api,
    { type: "palette:suggest", mode: "order", query: "" },
    sender,
  );
  assert.deepEqual(
    response.suggestions.map((row) => row.tabId),
    [7, 8],
  );
  await paletteAction(
    api,
    { type: "palette:move", tabId: 8, placement: "start" },
    sender,
  );
  assert.deepEqual(moves, [[8, { index: 0 }]]);
  assert.deepEqual(api.calls, []);
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:move", tabId: 8, placement: "end" },
      { id: "foreign" },
    ),
  );
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:move", tabId: 99, placement: "end" },
      sender,
    ),
  );
});
test("browser page suggestions open internal destinations instead of submitting web searches", async () => {
  const api = browser();
  api.tabs.query = async () => [];
  const result = await paletteAction(
    api,
    { type: "palette:suggest", query: "расширения" },
    sender,
  );
  assert.equal(
    result.suggestions.find((row) => row.kind === "browser-page").url,
    "chrome://extensions/",
  );
  await paletteAction(
    api,
    { type: "palette:navigate", query: "chrome://extensions/" },
    sender,
  );
  assert.deepEqual(api.calls, [
    ["create", { windowId: 2, active: true, url: "chrome://extensions/" }],
  ]);
});
test("known Chrome addresses retain background/current navigation behavior", async () => {
  const api = browser();
  await paletteAction(
    api,
    {
      type: "palette:navigate",
      query: "chrome://settings",
      target: "background",
    },
    sender,
  );
  await paletteAction(
    api,
    {
      type: "palette:navigate",
      query: "chrome://extensions",
      target: "current",
    },
    sender,
  );
  assert.deepEqual(api.calls, [
    ["create", { windowId: 2, active: false, url: "chrome://settings/" }],
    ["update", 5, { url: "chrome://extensions/" }],
  ]);
});

test("Chrome settings command is distinct from extension Search settings", async () => {
  const api = browser();
  const response = await paletteAction(
    api,
    { type: "palette:suggest", query: "настройки", mode: "commands" },
    sender,
  );
  assert.ok(
    response.suggestions.some((row) => row.command === "browser:settings"),
  );
  await paletteAction(
    api,
    { type: "palette:command", command: "browser:settings" },
    sender,
  );
  assert.deepEqual(api.calls, [
    ["create", { windowId: 2, active: true, url: "chrome://settings/" }],
  ]);
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:command", command: "browser:quit" },
      sender,
    ),
  );
});

test("an AI prompt is recoverable even when destination navigation fails", async () => {
  const api = browser();
  const saved = {};
  api.storage = {
    session: {
      get: async () => ({ ...saved }),
      set: async (value) => Object.assign(saved, value),
      remove: async (keys) => keys.forEach((key) => delete saved[key]),
    },
  };
  api.tabs.create = async () => {
    assert.ok(
      Object.values(saved).some((row) => row.query === "Keep my prompt"),
    );
    throw Error("Could not open destination");
  };
  await assert.rejects(() =>
    paletteAction(
      api,
      {
        type: "palette:site",
        site: "provider:gemini",
        query: "Keep my prompt",
      },
      sender,
    ),
  );
  const result = await paletteAction(
    api,
    { type: "palette:suggest", mode: "drafts", query: "" },
    sender,
  );
  assert.equal(result.suggestions.length, 1);
  const recovered = await paletteAction(
    api,
    { type: "palette:recover", draftId: result.suggestions[0].draftId },
    sender,
  );
  assert.deepEqual(recovered, { query: "Keep my prompt", alias: "gem" });
  await paletteAction(
    api,
    { type: "palette:command", command: "clear-prompts" },
    sender,
  );
  assert.deepEqual(saved, {});
});
test("AI navigation stops if its recovery copy cannot be saved", async () => {
  const api = browser();
  await assert.rejects(
    () =>
      paletteAction(
        api,
        {
          type: "palette:site",
          site: "provider:claude",
          query: "Keep my prompt",
        },
        sender,
      ),
    /recovery/,
  );
  assert.deepEqual(api.calls, []);
});
test("executed actions log metadata without URL query/path content by default", async () => {
  const api = browser();
  const saved = {};
  api.storage = {
    local: {
      get: async () => ({ ...saved }),
      set: async (value) => Object.assign(saved, value),
      remove: async (keys) => keys.forEach((key) => delete saved[key]),
    },
  };
  await paletteAction(
    api,
    {
      type: "palette:navigate",
      query: "https://example.com/private?token=fixture",
    },
    sender,
  );
  const rows = Object.entries(saved)
    .filter(([key]) => key.startsWith("activity:entry:"))
    .map(([, row]) => row);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, "Open example.com");
  assert.equal(rows[0].status, "ok");
  assert.ok(!JSON.stringify(rows).includes("token"));
  assert.equal(rows[0].text, undefined);
});
test("restricted pages open a popup centered on the source window", async () => {
  const api = browser();
  api.scripting.executeScript = async () => {
    throw Error("Restricted");
  };
  api.windows.get = async (id) => {
    assert.equal(id, 2);
    return { left: 100, top: 60, width: 1200, height: 800 };
  };
  await openPalette(api, () => {});
  const [kind, popup] = api.calls[0];
  assert.equal(kind, "popup");
  assert.equal(popup.left, 460);
  assert.equal(popup.top, 250);
  assert.match(popup.url, /surface=window/);
});
test("group mutations stay in the validated source window and preserve native tabs", async () => {
  const api = browser();
  const changes = [];
  api.tabs.get = async (id) => ({
    id,
    windowId: id === 9 ? 9 : 2,
    pinned: false,
    groupId: 7,
  });
  api.tabs.group = async (options) => {
    changes.push(options);
    return 7;
  };
  api.tabGroups = {
    get: async () => ({ id: 7, windowId: 2 }),
    update: async () => {},
  };
  await paletteAction(
    api,
    { type: "palette:group", action: "add", tabIds: [5], groupId: 7 },
    sender,
  );
  assert.deepEqual(changes, [{ tabIds: [5], groupId: 7 }]);
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:group", action: "add", tabIds: [9], groupId: 7 },
      sender,
    ),
  );
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:group", action: "add", tabIds: [5], groupId: 7 },
      { id: "foreign" },
    ),
  );
  assert.equal(changes.length, 1);
  assert.deepEqual(api.calls, []);
});
test("bookmark mutation routes only selected source-window tabs to the requested folder", async () => {
  const api = browser();
  const created = [];
  api.tabs.get = async (id) => ({
    id,
    windowId: id === 9 ? 9 : 2,
    title: "Selected",
    url: "https://selected.example/",
  });
  api.bookmarks = {
    getTree: async () => [
      { id: "0", children: [{ id: "folder", parentId: "0", title: "Work" }] },
    ],
    getChildren: async () => [],
    create: async (data) => created.push(data),
  };
  await paletteAction(
    api,
    {
      type: "palette:bookmark",
      operation: "add",
      folderId: "folder",
      tabIds: [5],
    },
    sender,
  );
  assert.deepEqual(created, [
    { parentId: "folder", title: "Selected", url: "https://selected.example/" },
  ]);
  await assert.rejects(() =>
    paletteAction(
      api,
      {
        type: "palette:bookmark",
        operation: "add",
        folderId: "folder",
        tabIds: [9],
      },
      sender,
    ),
  );
  await assert.rejects(() =>
    paletteAction(
      api,
      {
        type: "palette:bookmark",
        operation: "add",
        folderId: "folder",
        tabIds: [5],
      },
      { id: "foreign" },
    ),
  );
  assert.equal(created.length, 1);
  assert.deepEqual(api.calls, []);
});

test("launcher tools offer calculator, named links and recent commands without leaking query text", async () => {
  const api = browser(),
    stored = {};
  api.storage = {
    local: {
      get: async () => ({ ...stored }),
      set: async (value) => Object.assign(stored, value),
      remove: async (keys) => {
        for (const key of Array.isArray(keys) ? keys : [keys])
          delete stored[key];
      },
    },
  };
  api.tabs.get = async (id) => ({
    id,
    windowId: 2,
    title: "Project",
    url: "https://example.com/work",
  });
  await paletteAction(
    api,
    { type: "palette:quicklink", operation: "save", name: "Work", tabId: 5 },
    sender,
  );
  const links = await paletteAction(
    api,
    { type: "palette:suggest", mode: "quicklinks", query: "work" },
    sender,
  );
  assert.equal(links.suggestions[0].url, "https://example.com/work");
  const calc = await paletteAction(
    api,
    { type: "palette:suggest", query: "1250 * 0.18" },
    sender,
  );
  assert.equal(
    calc.suggestions.find((row) => row.kind === "calculator").copyText,
    "225",
  );
  await paletteAction(
    api,
    { type: "palette:command", command: "copy-url" },
    sender,
  );
  const idle = await paletteAction(
    api,
    { type: "palette:suggest", query: "" },
    sender,
  );
  assert.ok(idle.suggestions.some((row) => row.kind === "quicklink"));
  assert.ok(idle.suggestions.some((row) => row.command === "copy-url"));
  assert.ok(
    idle.suggestions.some(
      (row) => row.kind === "activity" && row.title === "Copy current URL",
    ),
  );
  const duplicateCalls = api.calls.filter(
    (call) => call[0] === "update",
  ).length;
  assert.equal(
    duplicateCalls,
    0,
    "listing recent actions does not replay them",
  );
  await assert.rejects(() =>
    paletteAction(
      api,
      {
        type: "palette:quicklink",
        operation: "save",
        name: "Foreign",
        tabId: 9,
      },
      { ...sender, tab: { id: 5, windowId: 8 } },
    ),
  );
});

test("contextual duplicate validates selected tab and source window before mutation", async () => {
  const api = browser();
  api.tabs.duplicate = async (id) => api.calls.push(["duplicate", id]);
  await paletteAction(
    api,
    { type: "palette:tab-action", action: "duplicate", tabId: 8 },
    sender,
  );
  assert.deepEqual(api.calls, [["duplicate", 8]]);
  api.tabs.get = async (id) => ({ id, windowId: 9 });
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:tab-action", action: "duplicate", tabId: 8 },
      sender,
    ),
  );
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:tab-action", action: "close", tabId: 8 },
      sender,
    ),
  );
  assert.equal(api.calls.length, 1);
});

test("empty launcher labels starter commands accurately without history", async () => {
  const api = browser();
  const response = await paletteAction(
    api,
    { type: "palette:suggest", query: "" },
    sender,
  );
  const commands = response.suggestions.filter((row) => row.kind === "command");
  assert.equal(commands.length, 3);
  assert.ok(commands.every((row) => row.section === "Commands"));
});

test("notes use validated messages and keep text out of the action journal", async () => {
  const api = browser(),
    stored = {
      "activity:settings": {
        enabled: true,
        includeText: true,
        retentionHours: 168,
        maxEntries: 500,
      },
    };
  api.storage = {
    local: {
      get: async () => ({ ...stored }),
      set: async (value) => Object.assign(stored, value),
      remove: async (keys) => {
        for (const key of Array.isArray(keys) ? keys : [keys])
          delete stored[key];
      },
    },
  };
  const created = await paletteAction(
    api,
    {
      type: "palette:note",
      operation: "save",
      title: "Ideas",
      body: "Private fictional note content",
    },
    sender,
  );
  const result = await paletteAction(
    api,
    { type: "palette:suggest", mode: "notes", query: "fictional" },
    sender,
  );
  assert.equal(result.suggestions[0].noteId, created.note.id);
  const journal = Object.entries(stored).filter(([key]) =>
    key.startsWith("activity:entry:"),
  );
  assert.equal(journal.length, 1);
  assert.ok(!JSON.stringify(journal).includes("fictional"));
  await paletteAction(
    api,
    { type: "palette:note", operation: "get", id: created.note.id },
    sender,
  );
  assert.equal(
    Object.keys(stored).filter((key) => key.startsWith("activity:entry:"))
      .length,
    1,
    "reading a note is not an action-history write",
  );
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:note", operation: "get", id: created.note.id },
      { id: "foreign" },
    ),
  );
});

test("switching from the new tab dismisses only the temporary search tab", async () => {
  const api = browser();
  const url = api.runtime.getURL("newtab.html");
  api.tabs.get = async (id) => ({
    id,
    windowId: 2,
    url: id === 5 ? url : "https://example.com/",
  });
  api.tabs.remove = async (id) => api.calls.push(["remove", id]);
  const newTabSender = { ...sender, url };

  await paletteAction(
    api,
    { type: "palette:activate", tabId: 8 },
    newTabSender,
  );
  assert.deepEqual(api.calls, [
    ["update", 8, { active: true }],
    ["remove", 5],
  ]);

  api.calls.length = 0;
  api.tabs.get = async (id) => ({
    id,
    windowId: 2,
    url: "https://example.com/",
  });
  await paletteAction(
    api,
    { type: "palette:activate", tabId: 8 },
    newTabSender,
  );
  assert.deepEqual(api.calls, [["update", 8, { active: true }]]);
});
test("pin and mute only change tabs in the source window", async () => {
  const api = browser();
  await paletteAction(
    api,
    { type: "palette:tab-action", action: "pin-tab", tabIds: [8, 8] },
    sender,
  );
  assert.deepEqual(api.calls, [["update", 8, { pinned: true }]]);
  api.calls.length = 0;
  api.tabs.get = async (id) => ({ id, windowId: id === 9 ? 3 : 2 });
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:tab-action", action: "mute-tab", tabIds: [8, 9] },
      sender,
    ),
  );
  assert.deepEqual(api.calls, []);
});

test("Split View pairs adjacent tabs and rejects cross-window selections", async () => {
  const api = browser();
  api.tabs.get = async (id) => ({
    id,
    index: id,
    windowId: id === 10 ? 3 : 2,
    groupId: -1,
    pinned: false,
    splitViewId: -1,
  });
  api.tabs.createSplit = async (ids) => api.calls.push(["split", ids]);
  api.tabs.unsplit = async () => {};
  await paletteAction(
    api,
    { type: "palette:tab-action", action: "new-split", tabIds: [8, 9] },
    sender,
  );
  assert.deepEqual(api.calls, [["split", [8, 9]]]);
  await assert.rejects(() =>
    paletteAction(
      api,
      { type: "palette:tab-action", action: "new-split", tabIds: [9, 10] },
      sender,
    ),
  );
  assert.equal(api.calls.length, 1);
});

test("switching spaces opens the most recent tab in the group", async () => {
  const api = browser();
  api.tabGroups = {
    get: async (id) => ({ id, windowId: 2, collapsed: true }),
    update: async (...args) => api.calls.push(["group update", ...args]),
  };
  api.tabs.query = async () => [
    { id: 8, windowId: 2, groupId: 7, lastAccessed: 10 },
    { id: 9, windowId: 2, groupId: 7, lastAccessed: 30 },
  ];
  await paletteAction(
    api,
    { type: "palette:group", action: "switch", groupId: 7 },
    sender,
  );
  assert.deepEqual(api.calls, [
    ["group update", 7, { collapsed: false }],
    ["update", 9, { active: true }],
  ]);
});

test("sidebar commands are scoped to the source window", async () => {
  const api = browser();
  api.sidePanel = {
    open: async (options) => api.calls.push(["open sidebar", options]),
    close: async (options) => api.calls.push(["close sidebar", options]),
  };
  await paletteAction(
    api,
    { type: "palette:command", command: "open-sidebar" },
    sender,
  );
  await paletteAction(
    api,
    { type: "palette:command", command: "close-sidebar" },
    sender,
  );
  assert.deepEqual(api.calls, [
    ["open sidebar", { windowId: 2 }],
    ["close sidebar", { windowId: 2 }],
  ]);
});

test("Super Copy formats marked tabs and validates the window", async () => {
  const api = browser();
  api.tabs.get = async (id) => ({
    id,
    windowId: id === 9 ? 3 : 2,
    url: `https://example.com/${id}`,
    title: `Tab [${id}]`,
  });
  const reply = await paletteAction(
    api,
    {
      type: "palette:extra",
      action: "copy-tabs",
      tabIds: [7, 8],
      markdown: true,
    },
    sender,
  );
  assert.equal(
    reply.copyText,
    "[Tab \\[7\\]](<https://example.com/7>)\n[Tab \\[8\\]](<https://example.com/8>)",
  );
  await assert.rejects(
    () =>
      paletteAction(
        api,
        { type: "palette:extra", action: "copy-tabs", tabIds: [7, 9] },
        sender,
      ),
    /another window/,
  );
});

test("group scope filters open tabs and routes new pages to a named group", async () => {
  const api = browser();
  api.tabs.get = async (id) => ({ id, windowId: 2, groupId: 4 });
  api.tabs.query = async () => [
    {
      id: 8,
      windowId: 2,
      groupId: 4,
      title: "Inside",
      url: "https://example.com/inside",
    },
    {
      id: 9,
      windowId: 2,
      groupId: 5,
      title: "Outside",
      url: "https://example.com/outside",
    },
  ];
  api.tabGroups = {
    query: async () => [{ windowId: 2, id: 5, title: "Work" }],
  };
  api.tabs.group = async (options) => api.calls.push(["group", options]);
  api.storage = {
    local: {
      get: async (key) =>
        key === "domain-group-routes"
          ? { [key]: [{ host: "example.com", group: "Work" }] }
          : {},
    },
  };
  const result = await paletteAction(
    api,
    { type: "palette:suggest", scope: "group", query: "" },
    sender,
  );
  assert.deepEqual(
    result.suggestions
      .filter((item) => item.kind === "tab")
      .map((item) => item.id),
    [8],
  );
  await paletteAction(
    api,
    {
      type: "palette:navigate",
      scope: "window",
      query: "https://example.com/page",
    },
    sender,
  );
  assert.deepEqual(api.calls.at(-1), ["group", { groupId: 5, tabIds: [99] }]);
});

test("Instant Link only sends an explicit query to DuckDuckGo", async () => {
  const api = browser();
  await paletteAction(
    api,
    { type: "palette:extra", action: "instant", query: "arc browser" },
    sender,
  );
  const url = new URL(api.calls[0][1].url);
  assert.equal(url.hostname, "duckduckgo.com");
  assert.equal(url.searchParams.get("q"), "\\arc browser");
});

test("local learning connects provider selection, cross-language recovery and history reset", async () => {
  const api = browser();
  const storage = () => {
    const data = {};
    return {
      get: async () => ({ ...data }),
      set: async (value) => Object.assign(data, value),
      remove: async (keys) => keys.forEach((key) => delete data[key]),
    };
  };
  api.storage = { local: storage(), session: storage() };
  const choose = (site, query, source = sender) =>
    paletteAction(
      api,
      { type: "palette:site", site: `provider:${site}`, query },
      source,
    );
  const suggest = (query, mode, source = sender) =>
    paletteAction(api, { type: "palette:suggest", query, mode }, source);

  const prompt = "explain closures project-secret";
  await saveActivitySettings(api, {
    ...DEFAULT_ACTIVITY_SETTINGS,
    learn: false,
  });
  await choose("gemini", prompt);
  assert.equal((await suggest("объясни замыкания")).learnedProvider, undefined);

  await saveActivitySettings(api, {
    ...DEFAULT_ACTIVITY_SETTINGS,
    learn: true,
  });
  await choose("claude", prompt);
  await choose("claude", prompt, {
    ...sender,
    tab: { ...sender.tab, incognito: true },
  });
  const entries = await listActivity(api);
  assert.equal(entries.filter((entry) => entry.learning).length, 1);
  assert.ok(!JSON.stringify(entries).includes("project-secret"));
  assert.equal(
    (await suggest("объясни замыкания")).learnedProvider,
    "provider:claude",
  );
  assert.equal((await suggest("переведи письмо")).learnedProvider, undefined);
  assert.equal(
    (
      await suggest("объясни замыкания", undefined, {
        ...sender,
        tab: { ...sender.tab, incognito: true },
      })
    ).learnedProvider,
    undefined,
  );

  const drafts = await suggest("объясни замыкания", "drafts");
  const original = drafts.suggestions.find((row) =>
    row.title.startsWith("Google AI Mode:"),
  );
  const before = api.calls.length;
  assert.deepEqual(
    await paletteAction(
      api,
      { type: "palette:recover", draftId: original.draftId },
      sender,
    ),
    { query: prompt, alias: "gem", learnedProvider: "provider:claude" },
  );
  assert.equal(api.calls.length, before);

  const create = api.tabs.create;
  api.tabs.create = async () => {
    throw Error("Chrome could not create the tab");
  };
  await assert.rejects(() => choose("claude", prompt), /could not create/);
  assert.equal((await suggest("объясни замыкания")).learnedProvider, undefined);
  api.tabs.create = create;
  await choose("claude", prompt);
  await saveActivitySettings(api, {
    ...DEFAULT_ACTIVITY_SETTINGS,
    learn: false,
  });
  assert.equal((await suggest("объясни замыкания")).learnedProvider, undefined);
  await saveActivitySettings(api, {
    ...DEFAULT_ACTIVITY_SETTINGS,
    learn: true,
  });
  assert.equal(
    (await suggest("объясни замыкания")).learnedProvider,
    "provider:claude",
  );
  await clearActivity(api);
  assert.equal((await suggest("объясни замыкания")).learnedProvider, undefined);
  assert.ok((await suggest("объясни замыкания", "drafts")).suggestions.length);
});

test("command learning boosts the selected result within existing matches", async () => {
  const api = browser();
  const data = {};
  api.storage = {
    local: {
      get: async () => ({ ...data }),
      set: async (value) => Object.assign(data, value),
      remove: async (keys) => keys.forEach((key) => delete data[key]),
    },
  };
  api.tabs.duplicate = async () => {};
  const request = {
    type: "palette:suggest",
    mode: "commands",
    query: "current",
  };
  const { suggestions: initial } = await paletteAction(api, request, sender);
  const index = initial.findIndex((row) => row.command === "duplicate");
  assert.ok(index > 0);
  await paletteAction(
    api,
    {
      type: "palette:command",
      command: "duplicate",
      selectionQuery: request.query,
      selectionIndex: index,
      suggestedCommand: initial[0].command,
    },
    sender,
  );
  const { suggestions: ranked } = await paletteAction(api, request, sender);
  assert.equal(ranked[0].command, "duplicate");
  assert.deepEqual(
    new Set(ranked.map((row) => row.command)),
    new Set(initial.map((row) => row.command)),
  );
  const [entry] = await listActivity(api);
  assert.equal(entry.learning.index, index);
  assert.equal(entry.learning.skipped, initial[0].command);
});
