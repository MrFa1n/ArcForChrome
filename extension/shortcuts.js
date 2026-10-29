export async function executeCommand(api, command) {
  if (command === 'toggle-pin') {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab) await api.tabs.update(tab.id, { pinned: !tab.pinned });
    return;
  }
  if (!['next-tab', 'previous-tab'].includes(command)) return;
  const tabs = (await api.tabs.query({ currentWindow: true })).sort((a, b) => a.index - b.index);
  const index = tabs.findIndex(tab => tab.active);
  if (index < 0) return;
  const offset = command === 'next-tab' ? 1 : -1;
  await api.tabs.update(tabs[(index + offset + tabs.length) % tabs.length].id, { active: true });
}

export function cycleSpace(ids, current, offset) {
  return ids[(ids.indexOf(current) + offset + ids.length) % ids.length];
}
