import './background.js';
import { executeCommand } from './shortcuts.js';
import { openPalette, paletteAction } from './palette-service.js';
import { mountPalette } from './palette.js';
chrome.commands.onCommand.addListener(command => {
  const action = command === 'open-search' ? openPalette(chrome, mountPalette) : executeCommand(chrome, command);
  action.catch(error => console.error('Keyboard command failed:', error));
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !['palette:activate','palette:navigate'].includes(message.type)) return;
  paletteAction(chrome, message, sender).then(() => sendResponse({ok:true}),
    error => sendResponse({ok:false,error:error.message}));
  return true;
});
