import { openPalette, paletteAction } from './palette-service.js';

export function registerSearch(api, mount) {
  const open = (mode='search') => openPalette(api, mount,mode).catch(error => console.error('Could not open search:', error));
  api.action.onClicked.addListener(() => open());
  api.commands.onCommand.addListener(command => {
    if (command === 'open-search') return open();
    if (command === 'edit-address') return open('edit');
  });
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !['palette:activate','palette:navigate','palette:suggest','palette:site','palette:command','palette:restore'].includes(message.type)) return;
    paletteAction(api, message, sender).then(result => sendResponse({ok:true,...result}),
      error => sendResponse({ok:false,error:error.message}));
    return true;
  });
}
