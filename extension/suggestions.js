import { preferredTab } from "./search-preferences.js";
import { groupMetadata, decorateGroup } from "./tab-groups.js";
import { mergeBrowserPages } from "./browser-pages.js";
import { matchPage, queryVariants } from "./search-match.js";

const LIMIT = 8;
const SOURCE_BOOST = { tab: 25, bookmark: 8, history: 0 };

// Some sites expose multiple addresses for the same titled page.
const TITLE_DEDUP_HOSTS = new Set([
  "figma.com",
  "maps.google.com",
  "notion.so",
  "app.notion.com",
  "zoom.us",
  "opentable.com",
  "zillow.com",
  "github.com",
  "app.mode.com",
  "console.cloud.google.com",
]);

function titleHostKey({ title, url }) {
  if (!title?.trim() || !url) return null;
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (!TITLE_DEDUP_HOSTS.has(host)) return null;
  return JSON.stringify([
    host,
    title.trim().replace(/\s+/g, " ").toLocaleLowerCase(),
  ]);
}

function candidateUrl(item, kind) {
  try {
    const url = new URL(item.url);
    if (kind !== "tab" && !["https:", "http:"].includes(url.protocol))
      return null;
    return url.href;
  } catch {
    return kind === "tab" ? "" : null;
  }
}

export function rankSuggestions(tabs, bookmarks, history, input, preferredUrl) {
  const query = input.trim().toLocaleLowerCase();
  const unique = new Map();
  for (const [kind, items] of [
    ["tab", tabs],
    ["bookmark", bookmarks],
    ["history", history],
  ]) {
    for (const item of items) {
      const url = candidateUrl(item, kind);
      if (url === null) continue;
      const key = url || `tab:${item.id}`;
      const text = `${item.title || ""} ${url}`.toLocaleLowerCase();
      const previous = unique.get(key);
      if (previous) {
        previous.lastVisitTime = Math.max(
          previous.lastVisitTime,
          item.lastVisitTime || item.lastAccessed || 0,
        );
        previous.visitCount = Math.max(
          previous.visitCount,
          item.visitCount || 0,
        );
        previous.search += ` ${text}`;
        if (!previous.sources.includes(kind)) previous.sources.push(kind);
      } else
        unique.set(key, {
          kind,
          ...(kind === "tab" ? { id: item.id } : {}),
          title: item.title || url || "Untitled tab",
          url,
          sources: [kind],
          search: text,
          lastVisitTime: item.lastVisitTime || item.lastAccessed || 0,
          visitCount: item.visitCount || 0,
        });
    }
  }
  const score = (row) =>
    row.match.score +
    SOURCE_BOOST[row.kind] +
    (row.kind === "tab" && row.url === preferredUrl ? 24 : 0);
  const ranked = [...unique.values()]
    .map((item) => ({ ...item, match: matchPage(item, query) }))
    .filter((item) => item.match)
    .sort(
      (a, b) =>
        score(b) - score(a) ||
        Math.min(b.visitCount, 10) - Math.min(a.visitCount, 10) ||
        b.lastVisitTime - a.lastVisitTime,
    );
  const seen = new Set(
    ranked.filter((item) => item.kind !== "history").map(titleHostKey),
  );
  return ranked
    .filter((item) => {
      if (item.kind !== "history") return true;
      const key = titleHostKey(item);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, query ? LIMIT : 5)
    .map(({ search, lastVisitTime, visitCount, match, ...item }) => ({
      ...item,
      ...(match.kind === "exact" ? {} : { match: match.kind }),
    }));
}

function domainSuggestions(suggestions, query) {
  if (!query) return [];
  const hosts = queryVariants(query).map(
    (variant) =>
      variant
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split(/[/?#]/, 1)[0],
  );
  for (const item of suggestions) {
    try {
      const url = new URL(item.url);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        continue;
      const host = url.host.replace(/^www\./, "");
      if (!hosts.some((prefix) => prefix && host.startsWith(prefix))) continue;
      const home = `${url.origin}/`;
      const existing = suggestions.find((row) => row.url === home);
      return [
        existing || {
          kind: "domain",
          title: `Open ${url.host}`,
          url: home,
          sources: ["domain"],
        },
      ];
    } catch {
      /* Browser-internal tabs have no web homepage action. */
    }
  }
  return [];
}

async function sourceCandidates(api, source, query) {
  const variants = queryVariants(query);
  const address = query.match(/^(?:https?:\/\/)?(?:www\.)?([^/\s]+)\/\S*$/i);
  if (address && !variants.includes(address[1].toLocaleLowerCase()))
    variants.push(address[1].toLocaleLowerCase());
  const results = await Promise.allSettled(
    variants.map((text) =>
      Promise.resolve().then(() =>
        source === "bookmarks"
          ? api.bookmarks.search(text)
          : api.history.search({ text, startTime: 0, maxResults: 50 }),
      ),
    ),
  );
  if (results.every((result) => result.status === "rejected"))
    throw new Error("Source unavailable");
  return results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}

export async function findSuggestions(
  api,
  windowId,
  input,
  publish,
  excludedTabId,
  groupId = null,
) {
  if (typeof input !== "string" || input.length > 8192)
    throw new Error("Invalid query");
  const query = input.trim();
  const groups = groupMetadata(api, windowId);
  const preference = preferredTab(api, query);
  const requests = [
    async () =>
      (await api.tabs.query({ windowId })).filter(
        (tab) =>
          tab.id !== excludedTabId &&
          (groupId === null || tab.groupId === groupId),
      ),
  ];
  if (query)
    requests.push(
      () => sourceCandidates(api, "bookmarks", query),
      () => sourceCandidates(api, "history", query),
    );
  const candidates = [[], [], []];
  const pending = requests.map((request) => Promise.resolve().then(request));
  const results = await Promise.allSettled(
    pending.map(async (request, index) => {
      candidates[index] = await request;
      if (publish && query && index !== 0) {
        await pending[0].catch(() => {});
        const rows = rankSuggestions(...candidates, query, await preference);
        publish({
          suggestions: mergeBrowserPages(rows, candidates[0], query),
          domains: domainSuggestions(rows, query),
        });
      }
      return candidates[index];
    }),
  );
  const names = ["Open tabs", "Bookmarks", "History"];
  const warnings = results.flatMap((result, index) =>
    result.status === "rejected" ? [`${names[index]} unavailable`] : [],
  );
  const [tabs = [], bookmarks = [], history = []] = results.map((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  let suggestions = rankSuggestions(
    tabs,
    bookmarks,
    history,
    query,
    await preference,
  );
  // Native text search cannot retrieve misspelled records; try a bounded recent sample only when there are no matches.
  if (!suggestions.length && query.length >= 4 && query.length <= 128) {
    const recent = await Promise.allSettled([
      Promise.resolve().then(() => api.bookmarks.getRecent(100)),
      Promise.resolve().then(() =>
        api.history.search({ text: "", startTime: 0, maxResults: 100 }),
      ),
    ]);
    const [saved, visited] = recent.map((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    suggestions = rankSuggestions(
      tabs,
      [...bookmarks, ...saved],
      [...history, ...visited],
      query,
      await preference,
    );
  }
  const metadata = await groups;
  const rows = mergeBrowserPages(suggestions, tabs, query).map((row) => {
    const tab =
      row.kind === "tab" ? tabs.find((tab) => tab.id === row.id) : null;
    return decorateGroup(row, tab?.groupId, metadata);
  });
  return {
    suggestions: rows,
    domains: domainSuggestions(suggestions, query),
    warnings,
  };
}
