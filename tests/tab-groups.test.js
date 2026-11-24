import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupSuggestions,
  manageGroupSuggestions,
  changeGroup,
} from "../extension/tab-groups.js";
function browser() {
  const calls = [];
  const tabs = [
    { id: 1, windowId: 2, groupId: -1 },
    { id: 2, windowId: 2, groupId: 7 },
    { id: 3, windowId: 9, groupId: 9 },
    { id: 4, windowId: 2, pinned: true },
  ];
  return {
    calls,
    tabs: {
      get: async (id) => tabs.find((tab) => tab.id === id),
      query: async () => tabs.filter((tab) => tab.windowId === 2),
      group: async (options) => {
        calls.push(["group", options]);
        return 10;
      },
      ungroup: async (ids) => calls.push(["ungroup", ids]),
    },
    tabGroups: {
      query: async () => [
        { id: 7, windowId: 2, title: "Work", color: "blue", collapsed: false },
      ],
      get: async (id) => ({
        id,
        windowId: id === 7 ? 2 : 9,
        title: "Work",
        collapsed: false,
      }),
      update: async (...args) => calls.push(["update", ...args]),
    },
  };
}
test("group suggestions offer explicit creation and existing groups by name", async () => {
  const rows = await groupSuggestions(browser(), 2, "Work");
  assert.equal(rows[0].groupId, 7);
  assert.equal(rows[1].kind, "group-create");
  const managed = await manageGroupSuggestions(browser(), 2, "work");
  assert.equal(managed[0].groupId, 7);
});
test("create validates selection and assigns a name without navigation", async () => {
  const api = browser();
  await changeGroup(api, 2, {
    action: "create",
    tabIds: [1, 2],
    title: "Research",
  });
  assert.deepEqual(api.calls, [
    ["group", { tabIds: [1, 2], createProperties: { windowId: 2 } }],
    ["update", 10, { title: "Research", color: "blue" }],
  ]);
});
test("joining a group and removing selected members preserve other tabs", async () => {
  const api = browser();
  await changeGroup(api, 2, { action: "add", tabIds: [1], groupId: 7 });
  await changeGroup(api, 2, { action: "remove", tabIds: [1, 2] });
  assert.deepEqual(api.calls, [
    ["group", { tabIds: [1], groupId: 7 }],
    ["ungroup", [2]],
  ]);
});
test("dissolve ungroups only that group and never closes tabs", async () => {
  const api = browser();
  await changeGroup(api, 2, { action: "dissolve", groupId: 7 });
  assert.deepEqual(api.calls, [["ungroup", [2]]]);
});
test("rename, color and collapse operate on the validated group", async () => {
  const api = browser();
  await changeGroup(api, 2, { action: "rename", groupId: 7, title: "Docs" });
  await changeGroup(api, 2, { action: "color", groupId: 7, color: "purple" });
  await changeGroup(api, 2, { action: "toggle-collapse", groupId: 7 });
  assert.deepEqual(api.calls, [
    ["update", 7, { title: "Docs" }],
    ["update", 7, { color: "purple" }],
    ["update", 7, { collapsed: true }],
  ]);
});
test("foreign, stale, pinned or malformed targets fail before a mutation", async () => {
  const api = browser();
  for (const message of [
    { action: "create", tabIds: [1, 3], title: "X" },
    { action: "create", tabIds: [1, 4], title: "X" },
    { action: "create", tabIds: [99], title: "X" },
    { action: "create", tabIds: [1, 1], title: "X" },
    { action: "add", tabIds: [1], groupId: 9 },
    { action: "rename", groupId: 9, title: "X" },
    { action: "color", groupId: 7, color: "unknown" },
    { action: "create", tabIds: [1], title: "" },
    { action: "unknown" },
  ]) {
    await assert.rejects(() => changeGroup(api, 2, message));
  }
  assert.deepEqual(api.calls, []);
});
test("a naming failure reports the created group instead of pretending nothing changed", async () => {
  const api = browser();
  api.tabGroups.update = async () => {
    throw Error("Update denied");
  };
  await assert.rejects(
    () => changeGroup(api, 2, { action: "create", tabIds: [1], title: "Work" }),
    /Tabs were grouped/,
  );
  assert.deepEqual(api.calls, [
    ["group", { tabIds: [1], createProperties: { windowId: 2 } }],
  ]);
});
