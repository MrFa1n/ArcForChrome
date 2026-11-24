const STORAGE_KEY = "search-tab-preferences";
const MAX_ENTRIES = 100;
let pendingWrite = Promise.resolve();

async function digest(value) {
  const data = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(data), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function normalizedQuery(query) {
  if (typeof query !== "string" || query.length > 64) return "";
  return query.trim().toLocaleLowerCase();
}

export async function preferredTab(api, query) {
  const normalized = normalizedQuery(query);
  if (normalized.length < 2 || !api.storage?.local) return null;
  try {
    const id = await digest(normalized);
    const { [STORAGE_KEY]: entries } = await api.storage.local.get(STORAGE_KEY);
    return entries?.find((entry) => entry.query === id)?.url || null;
  } catch {
    return null;
  }
}

export function rememberTabChoice(api, query, url) {
  const normalized = normalizedQuery(query);
  if (
    normalized.length < 2 ||
    !/^https?:\/\//i.test(url || "") ||
    !api.storage?.local
  )
    return;
  pendingWrite = pendingWrite
    .catch(() => {})
    .then(async () => {
      const id = await digest(normalized);
      const { [STORAGE_KEY]: entries = [] } =
        await api.storage.local.get(STORAGE_KEY);
      await api.storage.local.set({
        [STORAGE_KEY]: [
          { query: id, url },
          ...entries.filter((entry) => entry.query !== id),
        ].slice(0, MAX_ENTRIES),
      });
    });
  return pendingWrite.catch(() => {});
}
