const PREFIX = "ai-prompt:";
const LIMIT = 20;
const MAX_AGE = 24 * 60 * 60 * 1000;
async function records(api) {
  if (!api.storage?.session)
    throw new Error("Prompt recovery storage is unavailable");
  const saved = await api.storage.session.get(null);
  return Object.entries(saved)
    .filter(
      ([key, row]) =>
        key.startsWith(PREFIX) &&
        row &&
        typeof row.query === "string" &&
        row.query.length <= 8192 &&
        typeof row.siteKey === "string" &&
        typeof row.name === "string" &&
        Number.isFinite(row.time) &&
        row.time > Date.now() - MAX_AGE,
    )
    .map(([key, row]) => ({ ...row, key }))
    .sort((a, b) => b.time - a.time || b.key.localeCompare(a.key));
}
export async function savePrompt(api, site, query) {
  if (!api.storage?.session)
    throw new Error("Prompt recovery storage is unavailable");
  const key = PREFIX + crypto.randomUUID();
  await api.storage.session.set({
    [key]: {
      siteKey: site.key,
      name: site.name,
      query: query.trim(),
      time: Date.now(),
    },
  });
  // Independent keys avoid shared read-modify-write state across windows.
  const all = await api.storage.session.get(null);
  const snapshot = Object.entries(all)
    .filter(([key]) => key.startsWith(PREFIX))
    .sort(
      (a, b) =>
        (b[1]?.time || 0) - (a[1]?.time || 0) || b[0].localeCompare(a[0]),
    );
  const expired = snapshot
    .filter(
      ([, row], index) =>
        index >= LIMIT || !row || row.time <= Date.now() - MAX_AGE,
    )
    .map(([key]) => key);
  if (expired.length) await api.storage.session.remove(expired);
}
export async function listPrompts(api, input) {
  const terms = input.trim().toLocaleLowerCase().split(/\s+/);
  return (await records(api))
    .slice(0, LIMIT)
    .filter((row) =>
      terms.every((term) =>
        `${row.name} ${row.query}`.toLocaleLowerCase().includes(term),
      ),
    )
    .map((row) => ({
      kind: "ai-draft",
      draftId: row.key,
      title: `${row.name}: ${row.query}`,
      url: "Recover prompt · This browser session",
    }));
}
export async function recoverPrompt(api, id, sites) {
  if (typeof id !== "string" || !id.startsWith(PREFIX) || id.length > 100)
    throw new Error("Invalid saved prompt");
  const row = (await records(api)).find((row) => row.key === id);
  if (!row) throw new Error("Saved prompt is no longer available");
  const site = sites.find((site) => site.key === row.siteKey);
  return {
    query: row.query,
    alias:
      site?.aliases?.find((alias) => /^[\p{L}\d.-]{1,32}$/u.test(alias)) || "",
  };
}
export async function clearPrompts(api) {
  const all = await api.storage.session.get(null);
  await api.storage.session.remove(
    Object.keys(all).filter((key) => key.startsWith(PREFIX)),
  );
}
