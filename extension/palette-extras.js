const HIDDEN = "hidden-search-suggestions";
let hiddenWrite = Promise.resolve();

export function publicUrl(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}

export async function hiddenSuggestions(api) {
  const stored = await api.storage?.local?.get(HIDDEN);
  return Array.isArray(stored?.[HIDDEN]) ? stored[HIDDEN] : [];
}

export function editHidden(api, value) {
  const url = value === null ? null : publicUrl(value);
  if (value !== null && !url) throw new Error("Choose a web suggestion");
  hiddenWrite = hiddenWrite
    .catch(() => {})
    .then(async () => {
      if (url === null) {
        await api.storage.local.remove(HIDDEN);
        return;
      }
      const current = await hiddenSuggestions(api);
      await api.storage.local.set({
        [HIDDEN]: [
          url.href,
          ...current.filter((item) => item !== url.href),
        ].slice(0, 200),
      });
    });
  return hiddenWrite;
}

export async function copyTabs(api, windowId, ids, markdown) {
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 100 ||
    !ids.every(Number.isInteger)
  ) {
    throw new Error("Choose at least one open tab");
  }
  const tabs = await Promise.all(
    [...new Set(ids)].map((id) => api.tabs.get(id)),
  );
  if (tabs.some((tab) => tab.windowId !== windowId))
    throw new Error("A tab moved to another window");
  const lines = tabs.flatMap((tab) => {
    const url = publicUrl(tab.url);
    if (!url) return [];
    if (!markdown) return [url.href];
    const title = (tab.title || url.hostname)
      .replace(/[\r\n]+/g, " ")
      .replace(/[\\[\]\\]/g, "\\$&");
    return [`[${title}](<${url.href.replace(/>/g, "%3E")}>)`];
  });
  if (!lines.length) throw new Error("No web links in this selection");
  return { copyText: lines.join("\n") };
}
