import { openPalette, paletteAction } from './palette-service.js';

export function registerSearch(api, mount) {
  const open = () => openPalette(api, mount).catch(error => console.error('Could not open search:', error));
  api.action.onClicked.addListener(open);
  api.commands.onCommand.addListener(command => {
    if (command === 'open-search') return open();
  });
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !['palette:activate','palette:navigate','palette:suggest'].includes(message.type)) return;
    paletteAction(api, message, sender).then(result => sendResponse({ok:true,...result}),
      error => sendResponse({ok:false,error:error.message}));
    return true;
  });
}
