import { destination } from './model.js';

export async function openPalette(api, mount) {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const tabs = await api.tabs.query({ windowId: tab.windowId });
  try {
    await api.scripting.executeScript({ target: { tabId: tab.id }, func: mount,
      args: [tabs.map(({id,title,url}) => ({id,title,url}))] });
  } catch {
    await api.windows.create({ type: 'popup', width: 680, height: 520,
      url: `${api.runtime.getURL('palette.html')}?window=${tab.windowId}` });
  }
}

function sourceWindow(api, sender) {
  if (sender.id !== api.runtime.id) throw new Error('Unknown sender');
  if (sender.tab) return sender.tab.windowId;
  const url = new URL(sender.url || 'about:blank');
  const expected = new URL(api.runtime.getURL('palette.html'));
  if (url.protocol !== expected.protocol || url.host !== expected.host ||
      url.pathname !== expected.pathname) throw new Error('Unknown search page');
  const id = Number(url.searchParams.get('window'));
  if (!url.searchParams.has('window') || !Number.isInteger(id) || id < 0) throw new Error('Invalid window');
  return id;
}

export async function paletteAction(api, message, sender) {
  const windowId = sourceWindow(api, sender);
  if (message.type === 'palette:activate') {
    if (!Number.isInteger(message.tabId)) throw new Error('Invalid tab');
    const tab = await api.tabs.get(message.tabId);
    if (tab.windowId !== windowId) throw new Error('Tab is outside this window');
    await api.tabs.update(message.tabId, { active: true });
    await api.windows.update(windowId, { focused: true });
  } else if (message.type === 'palette:navigate') {
    if (typeof message.query !== 'string' || message.query.length > 8192) throw new Error('Invalid query');
    const url = destination(message.query);
    if (url) await api.tabs.create({ windowId, url });
  } else throw new Error('Unknown search action');
}
