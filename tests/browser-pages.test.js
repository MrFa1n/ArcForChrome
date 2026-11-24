import { test } from "node:test";
import assert from "node:assert/strict";
import {
  browserPageSuggestions,
  browserPageUrl,
  mergeBrowserPages,
} from "../extension/browser-pages.js";
import { destination } from "../extension/model.js";
test("Chrome sections are found in English, Russian and the wrong keyboard layout", () => {
  for (const [query, url] of [
    ["расширения", "chrome://extensions/"],
    ["extensions", "chrome://extensions/"],
    ["settings", "chrome://settings/"],
    ["настройки", "chrome://settings/"],
    ["загрузки", "chrome://downloads/"],
    ["закладки", "chrome://bookmarks/"],
    ["пароли", "chrome://password-manager/passwords"],
  ]) {
    assert.equal(browserPageSuggestions(query)[0].url, url);
  }
  assert.equal(
    browserPageSuggestions("yfcnhjqrb")[0].url,
    "chrome://settings/",
  );
  assert.equal(
    browserPageSuggestions("extensons")[0].url,
    "chrome://extensions/",
  );
});
test("empty and unrelated queries do not clutter ordinary search", () => {
  assert.deepEqual(browserPageSuggestions(""), []);
  assert.deepEqual(browserPageSuggestions("project pineapple"), []);
  assert.ok(browserPageSuggestions("chrome").length <= 5);
});
test("only catalogued internal routes open directly, never arbitrary Chrome actions", () => {
  for (const input of [
    "chrome://settings",
    "chrome://settings/",
    "chrome://extensions/",
  ])
    assert.equal(destination(input).type, "url");
  for (const input of [
    "chrome://quit",
    "chrome://restart",
    "chrome://settings/?token=secret",
    "chrome://settings.evil/",
    "chrome://settings/unknown",
    "javascript:alert(1)",
  ]) {
    assert.equal(browserPageUrl(input), null);
    assert.equal(destination(input).type, "search");
  }
});
test("an already open section matches translated aliases and avoids a duplicate destination", () => {
  const tabs = [
    { id: 5, title: "Different localized title", url: "chrome://extensions/" },
  ];
  const rows = mergeBrowserPages([], tabs, "расширения");
  assert.equal(rows[0].kind, "tab");
  assert.equal(rows[0].id, 5);
  assert.equal(
    rows.filter((row) => row.url === "chrome://extensions/").length,
    1,
  );
  assert.equal(
    mergeBrowserPages(rows, tabs, "расширения").filter(
      (row) => row.url === "chrome://extensions/",
    ).length,
    1,
  );
});
