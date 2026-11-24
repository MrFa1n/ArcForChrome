import { matchPage } from "./search-match.js";
const PREFIX = "quicklink:";
let writes = Promise.resolve();
function page(value) {
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.href.length > 8192
  )
    throw Error("Use a web URL without credentials");
  return url.href;
}
function valid(row) {
  try {
    return (
      row &&
      typeof row.name === "string" &&
      row.name.trim().length > 0 &&
      row.name.length <= 80 &&
      page(row.url) === row.url
    );
  } catch {
    return false;
  }
}
async function entries(api) {
  if (!api.storage?.local?.get) return [];
  const all = await api.storage.local.get(null);
  return Object.entries(all)
    .filter(([key, row]) => key.startsWith(PREFIX) && valid(row))
    .map(([id, row]) => ({ ...row, id }));
}
export async function quicklinks(api, query) {
  return (await entries(api))
    .map((row) => ({
      ...row,
      match: matchPage({ title: row.name, url: row.url }, query),
    }))
    .filter((row) => row.match)
    .sort(
      (a, b) => b.match.score - a.match.score || a.name.localeCompare(b.name),
    )
    .map((row) => ({
      kind: "quicklink",
      linkId: row.id,
      title: row.name,
      url: row.url,
      sources: ["quicklink"],
    }));
}
export function changeQuicklink(api, message) {
  const task = writes
    .catch(() => {})
    .then(async () => {
      const rows = await entries(api);
      if (
        message.id !== undefined &&
        (typeof message.id !== "string" ||
          !rows.some((row) => row.id === message.id))
      )
        throw Error("Quicklink no longer exists");
      if (message.operation === "remove") {
        if (!message.id) throw Error("Choose a quicklink");
        await api.storage.local.remove(message.id);
        return;
      }
      if (
        message.operation !== "save" ||
        typeof message.name !== "string" ||
        !message.name.trim() ||
        message.name.trim().length > 80
      )
        throw Error("Use a quicklink name of 1–80 characters");
      const url = page(message.url);
      if (!message.id && rows.length >= 100)
        throw Error("Keep at most 100 quicklinks; remove one first");
      const id = message.id || PREFIX + crypto.randomUUID();
      await api.storage.local.set({ [id]: { name: message.name.trim(), url } });
      return { id };
    });
  writes = task;
  return task;
}
