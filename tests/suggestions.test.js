import { test } from "node:test";
import assert from "node:assert/strict";
import { rankSuggestions, findSuggestions } from "../extension/suggestions.js";
const tab = {
  id: 1,
  title: "Project Design",
  url: "https://example.com/design",
};
test("stronger matches can outrank open tabs", () => {
  const results = rankSuggestions(
    [tab],
    [{ title: "Design", url: "https://design.com" }],
    [{ title: "Design archive", url: "https://history.example" }],
    "design",
  );
  assert.deepEqual(
    results.map((row) => row.kind),
    ["bookmark", "history", "tab"],
  );
});
test("search matches titles and addresses case-insensitively", () => {
  assert.equal(rankSuggestions([tab], [], [], "PROJECT")[0].id, 1);
  assert.equal(rankSuggestions([tab], [], [], "example.com")[0].id, 1);
  assert.equal(rankSuggestions([tab], [], [], "project example")[0].id, 1);
});
test("a URL shared by sources appears once and activates the open tab", () => {
  const results = rankSuggestions(
    [tab],
    [{ title: "Saved design", url: tab.url }],
    [{ title: "Visited design", url: tab.url }],
    "design",
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].kind, "tab");
  assert.equal(results[0].id, 1);
  assert.deepEqual(results[0].sources, ["tab", "bookmark", "history"]);
});
test("folders and unsafe bookmark/history URLs are omitted", () => {
  assert.deepEqual(
    rankSuggestions(
      [],
      [
        { title: "Design folder" },
        { title: "Design", url: "javascript:alert(1)" },
      ],
      [],
      "design",
    ),
    [],
  );
});
test("empty search returns only tabs; history API is not read", async () => {
  const api = {
    tabs: { query: async () => [tab] },
    bookmarks: {
      search: () => {
        throw Error("Unexpected");
      },
    },
    history: {
      search: () => {
        throw Error("Unexpected");
      },
    },
  };
  const response = await findSuggestions(api, 2, "");
  assert.equal(response.suggestions[0].id, 1);
});
test("history searches all time and partial source failures preserve available results", async () => {
  const parameters = [];
  const api = {
    tabs: { query: async () => [tab] },
    bookmarks: {
      search: async () => {
        throw Error("Denied");
      },
    },
    history: {
      search: async (options) => {
        parameters.push(options);
        return [{ title: "Design notes", url: "https://notes.example" }];
      },
    },
  };
  const response = await findSuggestions(api, 2, "design");
  assert.equal(parameters[0].startTime, 0);
  assert.equal(parameters[0].text, "design");
  assert.deepEqual(
    response.suggestions.map((row) => row.kind),
    ["history", "tab"],
  );
  assert.ok(response.warnings.includes("Bookmarks unavailable"));
});
test("malformed queries are rejected before API access", async () => {
  await assert.rejects(() => findSuggestions({}, 2, {}));
  await assert.rejects(() => findSuggestions({}, 2, "x".repeat(8193)));
});
test("matching a saved title still switches to the already open URL", () => {
  const results = rankSuggestions(
    [{ ...tab, title: "Unrelated live title" }],
    [{ title: "Saved project alias", url: tab.url }],
    [],
    "saved project",
  );
  assert.equal(results[0].kind, "tab");
  assert.equal(results[0].id, 1);
});
test("missing APIs do not discard open-tab results", async () => {
  const response = await findSuggestions(
    { tabs: { query: async () => [tab] } },
    2,
    "project",
  );
  assert.equal(response.suggestions[0].id, 1);
  assert.deepEqual(response.warnings, [
    "Bookmarks unavailable",
    "History unavailable",
  ]);
});
test("suggestions are bounded and canonical URLs are deduplicated", () => {
  const bookmarks = Array.from({ length: 12 }, (_, index) => ({
    title: "Saved project",
    url: `https://example${index}.com`,
  }));
  assert.equal(rankSuggestions([], bookmarks, [], "project").length, 8);
  assert.equal(
    rankSuggestions(
      [],
      [{ title: "Saved", url: "https://example.com" }],
      [{ title: "Saved", url: "https://example.com/" }],
      "saved",
    ).length,
    1,
  );
});
test("known deep pages provide a separate homepage action with no path, query or fragment", async () => {
  const api = {
    tabs: { query: async () => [] },
    bookmarks: {
      search: async () => [
        {
          title: "Project",
          url: "https://github.com/org/project?tab=readme#start",
        },
      ],
    },
    history: { search: async () => [] },
  };
  const result = await findSuggestions(api, 2, "github");
  assert.deepEqual(result.domains, [
    {
      kind: "domain",
      title: "Open github.com",
      url: "https://github.com/",
      sources: ["domain"],
    },
  ]);
  assert.equal(
    result.suggestions[0].url,
    "https://github.com/org/project?tab=readme#start",
  );
});
test("homepage actions merge same-origin pages and preserve ports and subdomains", async () => {
  const api = {
    tabs: { query: async () => [] },
    bookmarks: {
      search: async () => [
        { title: "Docs A", url: "http://docs.example.com:3000/a" },
        { title: "Docs B", url: "http://docs.example.com:3000/b" },
      ],
    },
    history: { search: async () => [] },
  };
  const result = await findSuggestions(api, 2, "docs");
  assert.equal(result.domains.length, 1);
  assert.equal(result.domains[0].url, "http://docs.example.com:3000/");
});
test("empty input and already suggested homepages add no duplicate domain action", async () => {
  const api = {
    tabs: {
      query: async () => [
        { id: 1, title: "Home", url: "https://example.com/" },
      ],
    },
    bookmarks: { search: async () => [] },
    history: { search: async () => [] },
  };
  assert.deepEqual((await findSuggestions(api, 2, "")).domains, []);
  assert.deepEqual((await findSuggestions(api, 2, "example")).domains, []);
});
test("native history/bookmark queries include the corrected keyboard layout", async () => {
  const queries = [];
  const api = {
    tabs: { query: async () => [] },
    bookmarks: {
      search: async (query) => {
        queries.push(query);
        return query === "github"
          ? [{ title: "GitHub", url: "https://github.com/" }]
          : [];
      },
    },
    history: { search: async () => [] },
  };
  const result = await findSuggestions(api, 2, "пшерги");
  assert.ok(queries.includes("github"));
  assert.equal(result.suggestions[0].match, "layout");
});
test("a typo with no native matches searches bounded recent records", async () => {
  const limits = [];
  const api = {
    tabs: { query: async () => [] },
    bookmarks: {
      search: async () => [],
      getRecent: async (limit) => {
        limits.push(limit);
        return [{ title: "GitHub", url: "https://github.com/" }];
      },
    },
    history: {
      search: async (options) => {
        if (!options.text) limits.push(options.maxResults);
        return [];
      },
    },
  };
  const result = await findSuggestions(api, 2, "githbu");
  assert.equal(result.suggestions[0].match, "typo");
  assert.deepEqual(limits, [100, 100]);
});
test("exact and corrected suggestions stay local and never trigger navigation", async () => {
  const api = {
    tabs: {
      query: async () => [
        { id: 1, title: "GitHub", url: "https://github.com/" },
      ],
    },
    bookmarks: { search: async () => [] },
    history: { search: async () => [] },
  };
  const result = await findSuggestions(api, 2, "githbu");
  assert.equal(result.suggestions[0].id, 1);
  assert.equal(result.suggestions[0].kind, "tab");
});

test("bookmarks are published while history is still loading", async () => {
  let finishHistory;
  const history = new Promise((resolve) => {
    finishHistory = resolve;
  });
  const bookmark = { title: "Project guide", url: "https://guide.example/" };
  const api = {
    tabs: { query: async () => [tab] },
    bookmarks: { search: async () => [bookmark] },
    history: { search: () => history },
  };
  let publishFirst;
  const first = new Promise((resolve) => {
    publishFirst = resolve;
  });
  const final = findSuggestions(api, 2, "project", publishFirst);
  const partial = await first;
  assert.ok(partial.suggestions.some((row) => row.url === bookmark.url));
  assert.ok(partial.suggestions.some((row) => row.id === tab.id));
  finishHistory([{ title: "Project notes", url: "https://notes.example/" }]);
  assert.ok((await final).suggestions.some((row) => row.kind === "history"));
});

test("title and host collapse history duplicates while preserving separate tabs", () => {
  const tabs = [
    { id: 1, title: "Project · GitHub", url: "https://github.com/org/project" },
    {
      id: 2,
      title: "Project · GitHub",
      url: "https://github.com/org/project?view=readme",
    },
  ];
  const history = [
    {
      title: " project · github ",
      url: "https://github.com/org/project?tracking=1",
    },
    { title: "Project · GitHub", url: "https://example.org/project" },
    { title: "Project issues", url: "https://github.com/org/project/issues" },
  ];
  const rows = rankSuggestions(tabs, [], history, "project");
  assert.deepEqual(
    rows.filter((row) => row.kind === "tab").map((row) => row.id),
    [1, 2],
  );
  assert.deepEqual(
    rows
      .filter((row) => row.kind === "history")
      .map((row) => row.url)
      .sort(),
    ["https://example.org/project", "https://github.com/org/project/issues"],
  );
});

test("visit frequency breaks equally relevant history matches without displacing a stronger match", () => {
  const rows = rankSuggestions(
    [],
    [],
    [
      {
        title: "Project archive",
        url: "https://archive.example/",
        visitCount: 1,
        lastVisitTime: 900,
      },
      {
        title: "Project archive",
        url: "https://frequent.example/",
        visitCount: 6,
        lastVisitTime: 500,
      },
      {
        title: "Project",
        url: "https://exact.example/",
        visitCount: 0,
        lastVisitTime: 100,
      },
    ],
    "project",
  );
  assert.deepEqual(
    rows.map((row) => row.url),
    [
      "https://exact.example/",
      "https://frequent.example/",
      "https://archive.example/",
    ],
  );
});
