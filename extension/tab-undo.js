// Store one undo per window in memory. A changed tab strip invalidates the snapshot.
const entries = new Map();
const lifetime = 60_000;

async function snapshot(api, windowId) {
  return (await api.tabs.query({ windowId }))
    .map(({ id, index, groupId, pinned }) => ({ id, index, groupId, pinned }))
    .sort((a, b) => a.index - b.index);
}

export async function withTabUndo(api, windowId, action, ids, run) {
  entries.delete(windowId);
  const before = await snapshot(api, windowId).catch(() => null);
  const result = await run();
  if (!before) return result;
  const after = await snapshot(api, windowId).catch(() => null);
  if (!after || JSON.stringify(before) === JSON.stringify(after)) return result;
  const key = crypto.randomUUID();
  const entry = {
    key,
    before,
    after,
    action,
    ids,
    expires: Date.now() + lifetime,
  };
  entries.set(windowId, entry);
  return { ...result, undoKey: key };
}

export async function undoTabs(api, windowId, key) {
  const entry = entries.get(windowId);
  if (!entry || entry.key !== key || entry.expires < Date.now())
    throw new Error("Undo is no longer available");
  entries.delete(windowId);
  if (
    JSON.stringify(await snapshot(api, windowId)) !==
    JSON.stringify(entry.after)
  )
    throw new Error("Tabs changed. Undo is no longer available.");
  const targets = entry.before.filter((tab) => entry.ids.includes(tab.id));
  if (entry.action === "group") {
    const groups = new Set(
      (await api.tabGroups.query({ windowId })).map(({ id }) => id),
    );
    if (targets.some((tab) => tab.groupId >= 0 && !groups.has(tab.groupId)))
      throw new Error("The original group no longer exists");
    const ungrouped = targets
      .filter((tab) => tab.groupId < 0)
      .map(({ id }) => id);
    if (ungrouped.length) await api.tabs.ungroup(ungrouped);
    for (const tab of targets)
      if (tab.groupId >= 0)
        await api.tabs.group({ groupId: tab.groupId, tabIds: [tab.id] });
  }
  for (const tab of targets) await api.tabs.move(tab.id, { index: tab.index });
}
