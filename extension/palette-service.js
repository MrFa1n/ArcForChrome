import { destination } from './model.js';
import { findSuggestions } from './suggestions.js';
import { loadSites,siteDestination } from './site-search.js';
import { COMMANDS,commandSuggestions } from './command-catalog.js';

export async function openPalette(api,mount,mode='search') {
  const [tab]=await api.tabs.query({active:true,currentWindow:true});
  if(!tab) return;
  const [tabs,sites]=await Promise.all([api.tabs.query({windowId:tab.windowId}),loadSites(api)]);
  const context={mode,sourceUrl:tab.url || '',sites};
  try {
    await api.scripting.executeScript({target:{tabId:tab.id},func:mount,args:[tabs.map(({id,title,url})=>({id,title,url})),false,context]});
  } catch {
    await api.windows.create({type:'popup',width:680,height:620,
      url:`${api.runtime.getURL('palette.html')}?window=${tab.windowId}&tab=${tab.id}&mode=${mode}`});
  }
}

function sourceContext(api,sender) {
  if(sender.id!==api.runtime.id) throw new Error('Unknown sender');
  if(sender.tab) return {windowId:sender.tab.windowId,tabId:sender.tab.id};
  const url=new URL(sender.url || 'about:blank');
  const expected=new URL(api.runtime.getURL('palette.html'));
  if(url.protocol!==expected.protocol || url.host!==expected.host || url.pathname!==expected.pathname) throw new Error('Unknown search page');
  const windowId=Number(url.searchParams.get('window'));
  if(!url.searchParams.has('window') || !Number.isInteger(windowId) || windowId<0) throw new Error('Invalid window');
  const tabId=url.searchParams.has('tab')?Number(url.searchParams.get('tab')):undefined;
  return {windowId,tabId};
}

async function sourceTab(api,context) {
  if(!Number.isInteger(context.tabId)) throw new Error('Source tab is unavailable');
  const tab=await api.tabs.get(context.tabId);
  if(tab.windowId!==context.windowId) throw new Error('Source tab moved to another window');
  return tab;
}

async function navigate(api,context,input,target='new') {
  if(!['new','background','current'].includes(target)) throw new Error('Invalid navigation target');
  const parsed=destination(input);
  if(!parsed) return;
  if(target==='current') {
    const tab=await sourceTab(api,context);
    if(input.trim()===tab.url) {await api.tabs.reload(tab.id);return;}
    if(parsed.type==='url') {
      if(parsed.url===tab.url) await api.tabs.reload(tab.id);
      else await api.tabs.update(tab.id,{url:parsed.url});
    } else await api.search.query({text:parsed.text,tabId:tab.id});
    return;
  }
  const tab=await api.tabs.create({windowId:context.windowId,active:target!=='background',...(parsed.type==='url'?{url:parsed.url}:{})});
  if(parsed.type==='search') await api.search.query({text:parsed.text,tabId:tab.id});
}

async function closedSuggestions(api,query) {
  const sessions=await api.sessions.getRecentlyClosed({maxResults:25});
  const terms=query.trim().toLocaleLowerCase().split(/\s+/);
  return sessions.filter(item=>item.tab?.sessionId && terms.every(term=>`${item.tab.title || ''} ${item.tab.url || ''}`.toLocaleLowerCase().includes(term)))
    .slice(0,8).map(({tab})=>({kind:'closed',sessionId:tab.sessionId,title:tab.title || tab.url || 'Closed tab',url:tab.url || '',sources:['closed']}));
}

async function restore(api,sessionId) {
  const available=await api.sessions.getRecentlyClosed({maxResults:25});
  const item=available.find(item=>item.tab?.sessionId && (!sessionId || item.tab.sessionId===sessionId));
  if(!item) throw new Error('Closed tab is no longer available');
  const restored=await api.sessions.restore(item.tab.sessionId);
  if(restored?.tab?.windowId!==undefined) await api.windows.update(restored.tab.windowId,{focused:true});
}

async function executeAction(api,context,id) {
  if(!COMMANDS.some(item=>item.command===id)) throw new Error('Unknown command');
  if(id==='reopen') return restore(api);
  if(id==='settings') return api.runtime.openOptionsPage();
  if(id==='new-window') return api.windows.create({type:'normal'});
  if(id==='history' || id==='downloads') return api.tabs.create({windowId:context.windowId,url:`chrome://${id}/`});
  const tab=await sourceTab(api,context);
  if(id==='reload') await api.tabs.reload(tab.id);
  if(id==='duplicate') await api.tabs.duplicate(tab.id);
  if(id==='copy-url') return {copyText:tab.url || ''};
}

export async function paletteAction(api,message,sender) {
  const context=sourceContext(api,sender);
  if(message.type==='palette:suggest') {
    if(typeof message.query!=='string' || message.query.length>8192) throw new Error('Invalid query');
    if(message.mode==='commands') return {suggestions:commandSuggestions(message.query),domains:[],warnings:[]};
    if(message.mode==='closed') return {suggestions:await closedSuggestions(api,message.query),domains:[],warnings:[]};
    return findSuggestions(api,context.windowId,message.query);
  }
  if(message.type==='palette:activate') {
    if(!Number.isInteger(message.tabId)) throw new Error('Invalid tab');
    const tab=await api.tabs.get(message.tabId);
    if(tab.windowId!==context.windowId) throw new Error('Tab is outside this window');
    await api.tabs.update(tab.id,{active:true});await api.windows.update(context.windowId,{focused:true});return;
  }
  if(message.type==='palette:navigate') return navigate(api,context,message.query,message.target);
  if(message.type==='palette:site') return navigate(api,context,siteDestination(await loadSites(api),message.site,message.query),message.target);
  if(message.type==='palette:command') return executeAction(api,context,message.command);
  if(message.type==='palette:restore') {
    if(typeof message.sessionId!=='string' || !message.sessionId) throw new Error('Invalid closed tab');
    return restore(api,message.sessionId);
  }
  throw new Error('Unknown search action');
}
