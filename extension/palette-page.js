import {GROUP_COLORS} from './tab-groups.js';
import {mountPalette} from './palette.js';
import {loadSites} from './site-search.js';
const params=new URL(location.href).searchParams;
if(params.get('surface')==='action')document.documentElement.classList.add('action-popup');
const windowId=Number(params.get('window'));
const tabId=Number(params.get('tab'));
Promise.all([chrome.tabs.query({windowId}),chrome.tabs.get(tabId),loadSites(chrome,windowId)]).then(([tabs,tab,sites])=>{
  if(tab.windowId!==windowId) throw new Error('Source tab moved to another window');
  mountPalette(tabs,true,{sites,favicons:true,sourceUrl:tab.url || '',sourceTabId:tab.id,groupColors:GROUP_COLORS,mode:params.get('mode')==='edit'?'edit':'search'});
}).catch(error=>{document.body.textContent=`Search could not open: ${error.message}`;});
