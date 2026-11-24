import { test } from "node:test";
import assert from "node:assert/strict";
import { orderSuggestions, moveTab } from "../extension/tab-order.js";
const tabs = [
  { id: 1, index: 0, windowId: 2, pinned: true, groupId: -1, title: "Pinned" },
  { id: 2, index: 1, windowId: 2, pinned: false, groupId: -1, title: "Alpha" },
  { id: 3, index: 2, windowId: 2, pinned: false, groupId: 7, title: "Grouped" },
  {
    id: 4,
    index: 3,
    windowId: 2,
    pinned: false,
    groupId: 7,
    title: "Also grouped",
  },
  { id: 5, index: 4, windowId: 2, pinned: false, groupId: -1, title: "Beta" },
  { id: 6, index: 5, windowId: 2, pinned: false, groupId: -1, title: "Gamma" },
];
function browser() {
  const calls = [];
  return {
    calls,
    tabs: {
      query: async (options) => {
        assert.deepEqual(options, { windowId: 2 });
        return tabs;
      },
      move: async (...args) => calls.push(args),
    },
  };
}
test("arrange lists every matching tab in actual strip order with positions", async () => {
  const rows = await orderSuggestions(browser(), 2, "group");
  assert.deepEqual(
    rows.map((row) => [row.tabId, row.kind]),
    [
      [3, "order-tab"],
      [4, "order-tab"],
    ],
  );
  assert.match(rows[0].url, /3/);
});
test("before moves account for source removal in both directions", async () => {
  const api = browser();
  await moveTab(api, 2, { tabId: 2, placement: "before", beforeTabId: 6 });
  await moveTab(api, 2, { tabId: 6, placement: "before", beforeTabId: 2 });
  assert.deepEqual(api.calls, [
    [2, { index: 4 }],
    [6, { index: 1 }],
  ]);
});
test("start/end and neighbor moves preserve pin/group membership", async () => {
  const api = browser();
  await moveTab(api, 2, { tabId: 2, placement: "end" });
  await moveTab(api, 2, { tabId: 6, placement: "start" });
  await moveTab(api, 2, { tabId: 3, placement: "right" });
  await moveTab(api, 2, { tabId: 4, placement: "start" });
  assert.deepEqual(api.calls, [
    [2, { index: 5 }],
    [6, { index: 1 }],
    [3, { index: 3 }],
    [4, { index: 2 }],
  ]);
});
test("adjacent moves cannot jump across a group; edges are safe no-ops", async () => {
  const api = browser();
  await assert.rejects(
    () => moveTab(api, 2, { tabId: 2, placement: "right" }),
    /group/i,
  );
  await moveTab(api, 2, { tabId: 1, placement: "left" });
  assert.deepEqual(api.calls, []);
});
test("rejects foreign/missing tabs, changed group boundaries and malformed moves", async () => {
  const api = browser();
  for (const message of [
    { tabId: 99, placement: "start" },
    { tabId: 2, placement: "before", beforeTabId: 3 },
    { tabId: 2, placement: "before", beforeTabId: 1 },
    { tabId: "2", placement: "end" },
    { tabId: 2, placement: "unknown" },
    { tabId: 2, placement: "before", beforeTabId: 2 },
  ])
    await assert.rejects(() => moveTab(api, 2, message));
  assert.deepEqual(api.calls, []);
});
test("destination suggestions exclude other pin/group sections and keep query filtering", async () => {
  const rows = await orderSuggestions(browser(), 2, "gamma", 2);
  assert.deepEqual(
    rows.map((row) => [row.placement, row.beforeTabId]),
    [["before", 6]],
  );
  await assert.rejects(() => orderSuggestions(browser(), 2, "", 99));
});
test("arrange carries native group name/color and keeps its actual tab order", async () => {
  const api = browser();
  api.tabGroups = {
    query: async () => [
      { id: 7, windowId: 2, title: "Research", color: "purple" },
    ],
  };
  const rows = await orderSuggestions(api, 2, "");
  assert.equal(rows.find((row) => row.tabId === 3).groupTitle, "Research");
  assert.equal(rows.find((row) => row.tabId === 4).groupColor, "purple");
  assert.deepEqual(
    rows.map((row) => row.tabId),
    [1, 2, 3, 4, 5, 6],
  );
});
