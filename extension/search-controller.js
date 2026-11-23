import { openPalette, paletteAction } from './palette-service.js';

export function registerSearch(api, mount) {
  const open = (mode='search') => openPalette(api, mount,mode).catch(error => console.error('Could not open search:', error));
  api.action.onClicked.addListener(() => open());
  api.commands.onCommand.addListener(command => {
    if (command === 'open-search') return open();
    if (command === 'edit-address') return open('edit');
  });
  api.runtime.onConnect?.addListener(port => {
    if (port.name !== 'palette-search') return;
    let connected = true;
    port.onDisconnect.addListener(() => { connected = false; });
    const send = message => { if (connected) port.postMessage(message); };
    const search = ({query}) => {
      port.onMessage.removeListener(search);
      paletteAction(api, {type:'palette:suggest',query}, port.sender,
        result => send({...result,ok:true,partial:true}))
        .then(result => send({...result,ok:true}), error => send({ok:false,error:error.message}));
    };
    port.onMessage.addListener(search);
  });
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !['palette:activate','palette:navigate','palette:suggest','palette:site','palette:command','palette:restore','palette:remember-site','palette:move','palette:recover','palette:group','palette:bookmark','palette:quicklink','palette:tab-action','palette:icons','palette:note'].includes(message.type)) return;
    paletteAction(api, message, sender).then(result => sendResponse({ok:true,...result}),
      error => sendResponse({ok:false,error:error.message}));
    return true;
  });
}
