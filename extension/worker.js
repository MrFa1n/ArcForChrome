import './background.js';
import { createRecentTabs } from './recent-tabs.js';
import { executeCommand } from './shortcuts.js';
import { openPalette, paletteAction } from './palette-service.js';
import { mountPalette } from './palette.js';
const recentTabs = createRecentTabs(chrome);
const reportRecentError = error => console.error('Recent tab tracking failed:', error);
chrome.tabs.onActivated.addListener(info => recentTabs.activated(info).catch(reportRecentError));
chrome.tabs.onRemoved.addListener((tabId,info) => recentTabs.removed(info.windowId,tabId).catch(reportRecentError));
chrome.tabs.onDetached.addListener((tabId,info) => recentTabs.removed(info.oldWindowId,tabId).catch(reportRecentError));
chrome.windows.onRemoved.addListener(windowId => recentTabs.removed(windowId).catch(reportRecentError));
chrome.commands.onCommand.addListener(command => {
  const action = command === 'open-search' ? openPalette(chrome, mountPalette)
    : command === 'recent-tab' ? recentTabs.cycle() : executeCommand(chrome, command);
  action.catch(error => console.error('Keyboard command failed:', error));
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !['palette:activate','palette:navigate','palette:suggest'].includes(message.type)) return;
  paletteAction(chrome, message, sender).then(result => sendResponse({ok:true,...result}),
    error => sendResponse({ok:false,error:error.message}));
  return true;
});
