import {groupMetadata,decorateGroup} from './tab-groups.js';
// Resolve positions from Chrome on every request; never trust a stale UI index.
function sameSection(a,b) {
  return Boolean(a.pinned)===Boolean(b.pinned) && (a.groupId ?? -1)===(b.groupId ?? -1);
}
async function windowTabs(api,windowId) {
  return (await api.tabs.query({windowId})).filter(tab=>tab.windowId===windowId).sort((a,b)=>a.index-b.index);
}
function selectedTab(tabs,id) {
  if(!Number.isInteger(id) || id<0) throw new Error('Invalid tab');
  const tab=tabs.find(tab=>tab.id===id);
  if(!tab) throw new Error('Tab is no longer in this window');
  return tab;
}
function matches(row,query) {
  return query.trim().toLocaleLowerCase().split(/\s+/).every(term=>`${row.title} ${row.url}`.toLocaleLowerCase().includes(term));
}
function position(tab) {
  return `Position ${tab.index+1}${tab.pinned?' · Pinned':''}${tab.groupId>=0?' · Grouped':''} · ${tab.url || ''}`;
}
export async function orderSuggestions(api,windowId,query,tabId) {
  const [tabs,metadata]=await Promise.all([windowTabs(api,windowId),groupMetadata(api,windowId)]);
  if(tabId===undefined) return tabs.map(tab=>decorateGroup({kind:'order-tab',tabId:tab.id,title:tab.title || 'Untitled tab',url:position(tab)},tab.groupId,metadata)).filter(row=>matches(row,query));
  const tab=selectedTab(tabs,tabId);
  const actions=[['left','Move one position left / up'],['right','Move one position right / down'],['start','Move to start'],['end','Move to end']]
    .map(([placement,title])=>({kind:'move',placement,title,url:`${tab.title || 'Selected tab'} · Within its pinned/group section`}));
  const destinations=tabs.filter(other=>other.id!==tabId && sameSection(tab,other))
    .map(other=>decorateGroup({kind:'move',placement:'before',beforeTabId:other.id,title:`Move before ${other.title || 'Untitled tab'}`,url:position(other)},other.groupId,metadata));
  return [...actions,...destinations].filter(row=>matches(row,query));
}
export async function moveTab(api,windowId,message) {
  if(!['left','right','start','end','before'].includes(message.placement)) throw new Error('Invalid move');
  const tabs=await windowTabs(api,windowId);
  const tab=selectedTab(tabs,message.tabId);
  let target;
  if(message.placement==='before') {
    const before=selectedTab(tabs,message.beforeTabId);
    if(before.id===tab.id) throw new Error('Choose another tab');
    if(!sameSection(tab,before)) throw new Error('Move only within the same pinned/group section');
    target=before.index-(tab.index<before.index?1:0);
  } else if(message.placement==='start' || message.placement==='end') {
    const section=tabs.filter(other=>sameSection(tab,other));
    target=message.placement==='start'?section[0].index:section.at(-1).index;
  } else {
    const neighbor=tabs.find(other=>other.index===tab.index+(message.placement==='left'?-1:1));
    if(!neighbor) return;
    if(!sameSection(tab,neighbor)) throw new Error('Cannot cross a pinned/group boundary with a one-position move');
    target=neighbor.index;
  }
  if(target!==tab.index) await api.tabs.move(tab.id,{index:target});
}
