import { matchPage } from "./search-match.js";
const PREFIX = "note:";
let writes = Promise.resolve();
function valid(row) {
  return (
    row &&
    typeof row.title === "string" &&
    row.title.length > 0 &&
    row.title.length <= 80 &&
    typeof row.body === "string" &&
    row.body.length <= 20000 &&
    Number.isInteger(row.revision) &&
    row.revision > 0 &&
    Number.isFinite(row.updatedAt)
  );
}
async function entries(api) {
  if (!api.storage?.local?.get) return [];
  const all = await api.storage.local.get(null);
  return Object.entries(all)
    .filter(([key, row]) => key.startsWith(PREFIX) && valid(row))
    .map(([id, row]) => ({ ...row, id }));
}
export async function noteSuggestions(api, query) {
  return (await entries(api))
    .map((note) => ({
      ...note,
      match: query.trim()
        ? matchPage(
            { title: note.title, search: `${note.title} ${note.body}` },
            query,
          )
        : { score: 0 },
    }))
    .filter((note) => note.match)
    .sort(
      (a, b) =>
        b.match.score - a.match.score ||
        b.updatedAt - a.updatedAt ||
        a.id.localeCompare(b.id),
    )
    .map((note) => ({
      kind: "note",
      noteId: note.id,
      revision: note.revision,
      title: note.title,
      url: "",
      description: note.body.replace(/\s+/g, " ").slice(0, 160),
      sources: ["note"],
    }));
}
export function noteAction(api, message) {
  const task = writes
    .catch(() => {})
    .then(async () => {
      const notes = await entries(api);
      const existing =
        message.id === undefined
          ? null
          : notes.find((note) => note.id === message.id);
      if (message.id !== undefined && !existing)
        throw Error("Note no longer exists");
      if (message.operation === "get") {
        if (!existing) throw Error("Choose a note");
        return { note: existing };
      }
      if (!["save", "remove"].includes(message.operation))
        throw Error("Unknown note operation");
      if (existing && existing.revision !== message.revision)
        throw Error(
          "This note changed in another editor. Reopen it before saving; your text is still here.",
        );
      if (message.operation === "remove") {
        if (!existing) throw Error("Choose a note");
        await api.storage.local.remove(existing.id);
        return;
      }
      if (
        typeof message.title !== "string" ||
        message.title.length > 80 ||
        typeof message.body !== "string" ||
        message.body.length > 20000 ||
        (!message.title.trim() && !message.body.trim())
      )
        throw Error(
          "Use a title up to 80 characters and text up to 20,000 characters",
        );
      if (!existing && notes.length >= 200)
        throw Error("Keep at most 200 notes; remove one first");
      const id = existing?.id || PREFIX + crypto.randomUUID();
      const row = {
        title:
          message.title.trim() ||
          message.body.trim().split(/\r?\n/)[0].slice(0, 80),
        body: message.body,
        revision: (existing?.revision || 0) + 1,
        updatedAt: Date.now(),
      };
      await api.storage.local.set({ [id]: row });
      return { note: { id, ...row } };
    });
  writes = task;
  return task;
}
