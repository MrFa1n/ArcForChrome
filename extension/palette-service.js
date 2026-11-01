import {faviconImages} from './favicons.js';
import {calculate} from './calculator.js';
import {quicklinks,changeQuicklink} from './quicklinks.js';
import {listActivity} from './activity-store.js';
import {bookmarkFolders,changeBookmarks} from './tab-bookmarks.js';
import {GROUP_COLORS,groupSuggestions,manageGroupSuggestions,groupActionSuggestions,changeGroup} from './tab-groups.js';
import {recordActivity} from './activity-store.js';
import {BUILTIN_SITES} from './search-providers.js';
import {savePrompt,listPrompts,recoverPrompt,clearPrompts} from './prompt-recovery.js';
import {browserCommandUrl} from './browser-pages.js';
import {orderSuggestions,moveTab} from './tab-order.js';
import { destination } from './model.js';
import { findSuggestions } from './suggestions.js';
import { loadSites,siteDestination,rememberSite } from './site-search.js';
import { COMMANDS,commandSuggestions } from './command-catalog.js';

export async function openPalette(api,mount,mode='search') {
  const [tab]=await api.tabs.query({active:true,currentWindow:true});
  if(!tab) return;
  const [tabs,sites]=await Promise.all([api.tabs.query({windowId:tab.windowId}),loadSites(api,tab.windowId)]);
  const context={mode,sourceUrl:tab.url || '',sourceTabId:tab.id,groupColors:GROUP_COLORS,sites,favicons:true};
  try {
    await api.scripting.executeScript({target:{tabId:tab.id},func:mount,args:[tabs.map(({id,title,url})=>({id,title,url})),false,context]});
  } catch {
    const url=`${api.runtime.getURL('palette.html')}?window=${tab.windowId}&tab=${tab.id}&mode=${mode}`;
    if(api.action?.openPopup && api.action?.setPopup) {
      try {
        await api.action.setPopup({tabId:tab.id,popup:`${url}&surface=action`});
        await api.action.openPopup({windowId:tab.windowId});
        return;
      } catch { /* Older Chrome or a rejected native popup uses the legacy window. */ }
      finally {await api.action.setPopup({tabId:tab.id,popup:''}).catch(()=>{});}
    }
    await api.windows.create({type:'popup',width:680,height:620,url});
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
  const browserUrl=browserCommandUrl(id);
  if(browserUrl) return navigate(api,context,browserUrl);
  if(id==='activity') return api.tabs.create({windowId:context.windowId,url:api.runtime.getURL('activity.html')});
  if(id==='clear-prompts') return clearPrompts(api);
  if(['quicklinks','save-quicklink','search-with','order-tabs','closed-tabs','edit-url','recover-prompts','group-tabs','manage-groups','ungroup-tabs','bookmark-tabs','remove-bookmarks'].includes(id)) throw new Error('Choose this mode in the command bar');
  if(id==='reopen') return restore(api);
  if(id==='settings') return api.runtime.openOptionsPage();
  if(id==='new-window') return api.windows.create({type:'normal'});
  if(id==='history' || id==='downloads') return api.tabs.create({windowId:context.windowId,url:`chrome://${id}/`});
  const tab=await sourceTab(api,context);
  if(id==='reload') await api.tabs.reload(tab.id);
  if(id==='duplicate') await api.tabs.duplicate(tab.id);
  if(id==='copy-url') return {copyText:tab.url || ''};
}

async function performAction(api,message,context) {
  if(message.type==='palette:icons')return {images:await faviconImages(api,message.urls)};
  if(message.type==='palette:suggest') {
    if(typeof message.query!=='string' || message.query.length>8192) throw new Error('Invalid query');
    if(message.mode==='quicklinks')return {suggestions:await quicklinks(api,message.query),domains:[],warnings:[]};
    if(message.mode==='bookmark-folders') {
      const suggestions=await bookmarkFolders(api,context.windowId,message.query,message.operation,message.tabIds);
      return {suggestions,domains:[],warnings:suggestions.length?[]:[message.operation==='remove'?'No matching bookmarks in writable folders':'No matching writable folders']};
    }
    if(message.mode==='groups')return {suggestions:await groupSuggestions(api,context.windowId,message.query),domains:[],warnings:[]};
    if(message.mode==='group-manage')return {suggestions:await manageGroupSuggestions(api,context.windowId,message.query),domains:[],warnings:[]};
    if(message.mode==='group-actions')return {suggestions:await groupActionSuggestions(api,context.windowId,message.groupId,message.query),domains:[],warnings:[]};
    if(message.mode==='drafts') return {suggestions:await listPrompts(api,message.query),domains:[],warnings:[]};
    if(message.mode==='order') return {suggestions:await orderSuggestions(api,context.windowId,message.query,message.tabId),domains:[],warnings:[]};
    if(message.mode==='commands') return {suggestions:commandSuggestions(message.query),domains:[],warnings:[]};
    if(message.mode==='closed') return {suggestions:await closedSuggestions(api,message.query),domains:[],warnings:[]};
    const [found,links]=await Promise.all([findSuggestions(api,context.windowId,message.query),quicklinks(api,message.query).catch(()=>[])]);
    const calculation=calculate(message.query);
    const extra=calculation?[{kind:'calculator',title:calculation.result,url:calculation.expression,copyText:calculation.result,sources:['calculator']}]:[];
    let recent=[],recentActions=[];
    if(!message.query.trim()) {
      const history=await listActivity(api).catch(()=>[]);
      recentActions=history.slice(0,3).map(row=>({kind:'activity',activityId:row.id,title:row.label,url:`View history · ${new Date(row.time).toLocaleString()}`,sources:['activity'],section:'Recent actions'}));
      const counts=new Map();
      for(const row of history.filter(row=>row.action==='command' && row.status==='ok'))counts.set(row.label,(counts.get(row.label) || 0)+1);
      recent=commandSuggestions('').filter(row=>counts.has(row.title)).sort((a,b)=>counts.get(b.title)-counts.get(a.title)).slice(0,3);
      if(!recent.length)recent=commandSuggestions('').filter(row=>['quicklinks','save-quicklink','search-with','order-tabs','closed-tabs','settings'].includes(row.command));
    }
    const rows=found.suggestions.slice(),remaining=[];
    for(const link of links.slice(0,8)) {
      const index=rows.findIndex(row=>row.url===link.url);
      if(index<0)remaining.push(link);
      else rows[index]={...rows[index],linkId:link.linkId,linkName:link.title,sources:[...new Set([...(rows[index].sources || [rows[index].kind]),'quicklink'])]};
    }
    return {...found,suggestions:[...extra,...rows,...remaining,...recentActions,...recent]};
  }
  if(message.type==='palette:quicklink') {
    let request=message;
    if(message.operation==='save' && message.tabId!==undefined) {
      if(!Number.isInteger(message.tabId))throw Error('Invalid tab');
      const tab=await api.tabs.get(message.tabId);
      if(tab.windowId!==context.windowId)throw Error('Tab is outside this window');
      request={...message,url:tab.url};
    }
    return changeQuicklink(api,request);
  }
  if(message.type==='palette:tab-action') {
    if(!Number.isInteger(message.tabId) || message.action!=='duplicate')throw Error('Invalid tab action');
    const tab=await api.tabs.get(message.tabId);
    if(tab.windowId!==context.windowId)throw Error('Tab is outside this window');
    await api.tabs.duplicate(tab.id);return;
  }
  if(message.type==='palette:bookmark')return changeBookmarks(api,context.windowId,message);
  if(message.type==='palette:group')return changeGroup(api,context.windowId,message);
  if(message.type==='palette:move') {
    await moveTab(api,context.windowId,message);
    return {suggestions:await orderSuggestions(api,context.windowId,'')};
  }
  if(message.type==='palette:activate') {
    if(!Number.isInteger(message.tabId)) throw new Error('Invalid tab');
    const tab=await api.tabs.get(message.tabId);
    if(tab.windowId!==context.windowId) throw new Error('Tab is outside this window');
    await api.tabs.update(tab.id,{active:true});await api.windows.update(context.windowId,{focused:true});return;
  }
  if(message.type==='palette:navigate') return navigate(api,context,message.query,message.target);
  if(message.type==='palette:site') {
    const sites=await loadSites(api,context.windowId);
    const url=siteDestination(sites,message.site,message.query);
    if(!['new','background','current',undefined].includes(message.target))throw new Error('Invalid navigation target');
    const site=sites.find(site=>site.key===message.site);
    if(site.ai)await savePrompt(api,site,message.query);
    return navigate(api,context,url,message.target);
  }
  if(message.type==='palette:recover') return recoverPrompt(api,message.draftId,await loadSites(api,context.windowId));
  if(message.type==='palette:remember-site') return rememberSite(api,context.windowId,message.site,message.alias);
  if(message.type==='palette:command') return executeAction(api,context,message.command);
  if(message.type==='palette:restore') {
    if(typeof message.sessionId!=='string' || !message.sessionId) throw new Error('Invalid closed tab');
    return restore(api,message.sessionId);
  }
  throw new Error('Unknown search action');
}

function activityEvent(message,status) {
  const action=message.type.slice(8);
  const provider=BUILTIN_SITES.find(site=>site.key===message.site);
  let label=action;
  if(action==='site')label=`Search ${provider?.name || message.site}`;
  if(action==='navigate') {
    const parsed=destination(message.query);
    label=parsed?.type==='url'?`Open ${new URL(parsed.url).hostname}`:'Web search';
  }
  if(action==='command')label=COMMANDS.find(item=>item.command===message.command)?.title || 'Browser command';
  if(action==='move')label=`Move tab ${message.tabId} · ${message.placement}`;
  if(action==='activate')label=`Activate tab ${message.tabId}`;
  if(action==='restore')label='Restore closed tab';
  if(action==='bookmark')label=`Bookmarks · ${message.operation} · ${message.tabIds?.length || 0} tabs`;
  if(action==='group')label=`Tab group · ${message.action}${message.tabIds?` · ${message.tabIds.length} tabs`:''}`;
  if(action==='recover')label='Recover AI prompt';
  if(action==='quicklink')label=`Quicklink · ${message.operation}`;
  if(action==='tab-action')label=`Tab · ${message.action}`;
  return {action,label,status,text:typeof message.query==='string'?message.query:undefined};
}
export async function paletteAction(api,message,sender) {
  const context=sourceContext(api,sender);
  const logged=!['palette:suggest','palette:icons','palette:remember-site'].includes(message.type) && message.command!=='activity';
  try {
    const result=await performAction(api,message,context);
    if(logged) {
      const recording=recordActivity(api,activityEvent(message,'ok')).catch(()=>{});
      if(message.type!=='palette:move')await recording;
    }
    return result;
  } catch(error) {
    if(logged)await Promise.resolve().then(()=>recordActivity(api,activityEvent(message,'error'))).catch(()=>{});
    throw error;
  }
}
