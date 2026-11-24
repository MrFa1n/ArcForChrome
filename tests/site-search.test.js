import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSites, siteDestination } from "../extension/site-search.js";
test("site queries are encoded without changing the destination host", () => {
  assert.equal(
    siteDestination(
      [
        {
          key: "yt",
          name: "Video search",
          template: "https://www.youtube.com/results?search_query=%s",
        },
      ],
      "yt",
      "cats & dogs",
    ),
    "https://www.youtube.com/results?search_query=cats%20%26%20dogs",
  );
});
test("custom site templates reject unsafe schemes, duplicate keywords and ambiguous placeholders", () => {
  const site = {
    key: "docs",
    name: "Docs",
    template: "https://example.com/?q=%s",
  };
  assert.deepEqual(parseSites([site]), [site]);
  for (const template of [
    "javascript:%s",
    "https://user:pass@example.com/%s",
    "https://example.com/",
    "https://example.com/%s/%s",
  ])
    assert.throws(() => parseSites([{ ...site, template }]));
  assert.throws(() => parseSites([site, site]));
  assert.throws(() => siteDestination([], "unknown", "x"));
});
test("requested web and AI providers work without browsing history or manual setup", async () => {
  const { loadSites } = await import("../extension/site-search.js");
  const sites = await loadSites({});
  for (const [key, alias, url] of [
    ["provider:google", "g", "https://www.google.com/search?q="],
    ["provider:yandex", "ya", "https://yandex.ru/search/?text="],
    ["provider:chatgpt", "gpt", "https://chatgpt.com/?q="],
    ["provider:gemini", "gem", "https://www.google.com/search?udm=50&q="],
    ["provider:claude", "claude", "https://claude.ai/new?q="],
    ["provider:grok", "grok", "https://grok.com/?q="],
    ["provider:perplexity", "pplx", "https://www.perplexity.ai/search?q="],
  ]) {
    assert.ok(sites.find((site) => site.key === key)?.aliases.includes(alias));
    assert.equal(
      siteDestination(sites, key, "Привет & +\nworld"),
      url + encodeURIComponent("Привет & +\nworld"),
    );
  }
});
test("manual overrides replace built-in destinations and take ownership of matching shortcuts", async () => {
  const { loadSites } = await import("../extension/site-search.js");
  const sites = await loadSites({
    storage: {
      local: {
        get: async () => ({
          sites: [
            {
              key: "g",
              name: "My search",
              template: "https://custom.example/?q=%s",
            },
          ],
        }),
      },
    },
  });
  assert.ok(sites.find((site) => site.key === "g").aliases.includes("g"));
  assert.ok(
    !sites.find((site) => site.key === "provider:google").aliases.includes("g"),
  );
});

test("Google and gem retain separate destinations when a Google override is present", async () => {
  const { loadSites } = await import("../extension/site-search.js");
  const api = {
    storage: {
      local: {
        get: async () => ({
          sites: [
            {
              key: "g",
              name: "My Google",
              template: "https://www.google.com/search?q=%s&hl=ru",
            },
          ],
        }),
      },
    },
  };
  const sites = await loadSites(api);
  assert.equal(
    new URL(
      siteDestination(sites, "provider:gemini", "Привет & +"),
    ).searchParams.get("udm"),
    "50",
  );
  assert.equal(sites.find((site) => site.key === "g").ai, false);
});
