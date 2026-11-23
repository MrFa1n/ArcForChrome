import {loadDesignTokens} from './design-tokens.js';
import {launcherContext} from './launcher-catalog.js';
import {GROUP_COLORS} from './tab-groups.js';
import {mountPalette} from './palette.js';
import {loadSites} from './site-search.js';
const params=new URL(location.href).searchParams;
const actionPopup = ['action','window'].includes(params.get('surface'));
if(actionPopup)document.documentElement.classList.add('action-popup');
const newTab = document.documentElement.classList.contains('new-tab');

async function open() {
  const tab = newTab ? await chrome.tabs.getCurrent() : await chrome.tabs.get(Number(params.get('tab')));
  const windowId = newTab ? tab?.windowId : Number(params.get('window'));
  if (!tab || tab.windowId !== windowId) throw new Error('Source tab is unavailable');
  const [tabs,sites,launcher,designTokens] = await Promise.all([
    chrome.tabs.query({windowId}),loadSites(chrome,windowId),launcherContext(chrome),loadDesignTokens()
  ]);
  mountPalette(tabs.filter(row => !newTab || row.id !== tab.id),!newTab,{
    ...launcher,designTokens,actionPopup,newTab,sites,favicons:true,sourceUrl:tab.url || '',
    sourceTabId:tab.id,groupColors:GROUP_COLORS,mode:params.get('mode')==='edit'?'edit':'search'
  });
}

open().catch(error=>{document.body.textContent=`Search could not open: ${error.message}`;});
