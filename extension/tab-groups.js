export const GROUP_COLORS=['grey','blue','red','yellow','green','pink','purple','cyan','orange'];
function title(value) {
  if(typeof value!=='string' || !value.trim() || value.trim().length>80)throw new Error('Use a group name of 1–80 characters');
  return value.trim();
}
function match(row,query) {
  return query.trim().toLocaleLowerCase().split(/\s+/).every(term=>`${row.title} ${row.url}`.toLocaleLowerCase().includes(term));
}
async function groups(api,windowId) {
  return (await api.tabGroups.query({windowId})).filter(group=>group.windowId===windowId);
}
async function group(api,windowId,id) {
  if(!Number.isInteger(id) || id<0)throw new Error('Invalid group');
  const found=await api.tabGroups.get(id);
  if(!found || found.windowId!==windowId)throw new Error('Group is no longer in this window');
  return found;
}
async function selection(api,windowId,ids,allowPinned=false) {
  if(!Array.isArray(ids) || !ids.length || ids.length>100 || new Set(ids).size!==ids.length || ids.some(id=>!Number.isInteger(id) || id<0))throw new Error('Select 1–100 distinct open tabs');
  const tabs=await Promise.all(ids.map(id=>api.tabs.get(id)));
  if(tabs.some(tab=>!tab || tab.windowId!==windowId))throw new Error('A selected tab is no longer in this window');
  if(!allowPinned && tabs.some(tab=>tab.pinned))throw new Error('Unpin selected tabs in Chrome before grouping');
  return tabs;
}
export async function groupSuggestions(api,windowId,query) {
  const existing=(await groups(api,windowId)).map(item=>({kind:'group-add',groupId:item.id,groupColor:item.color,title:item.title || 'Untitled group',url:`Add selected tabs · ${item.color}`})).filter(row=>match(row,query));
  const name=query.trim() || 'New group';
  const create=name.length<=80?[{kind:'group-create',title:`Create group “${name}”`,name,url:'Group selected tabs · Enter create'}]:[];
  const exact=existing.filter(row=>row.title.toLocaleLowerCase()===query.trim().toLocaleLowerCase());
  return [...exact,...create,...existing.filter(row=>!exact.includes(row))];
}
export async function manageGroupSuggestions(api,windowId,query) {
  return (await groups(api,windowId)).map(item=>({kind:'group-manage',groupId:item.id,groupColor:item.color,title:item.title || 'Untitled group',url:`${item.color} · ${item.collapsed?'Collapsed':'Expanded'}`})).filter(row=>match(row,query));
}
export async function groupActionSuggestions(api,windowId,id,query) {
  const item=await group(api,windowId,id);
  return [
    {kind:'group-rename',title:'Rename group',url:item.title || 'Untitled group',name:item.title || ''},
    {kind:'group-colors',title:'Change group color',url:item.color},
    {kind:'group-change',action:'toggle-collapse',title:item.collapsed?'Expand group':'Collapse group',url:item.title || 'Untitled group'},
    {kind:'group-change',action:'dissolve',title:'Ungroup · Keep all tabs open',url:item.title || 'Untitled group'}
  ].filter(row=>match(row,query));
}
export async function changeGroup(api,windowId,message) {
  if (message.action === 'switch') {
    const item = await group(api,windowId,message.groupId);
    const tabs = await api.tabs.query({windowId,groupId:item.id});
    const target = tabs.filter(tab => tab.windowId === windowId && tab.groupId === item.id)
      .sort((a,b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
    if (!target) throw new Error('This group has no open tabs');
    if (item.collapsed) await api.tabGroups.update(item.id,{collapsed:false});
    await api.tabs.update(target.id,{active:true});
    await api.windows.update(windowId,{focused:true});
    return;
  }
  if(['create','add','remove'].includes(message.action)) {
    const name=message.action==='create'?title(message.title):undefined;
    const tabs=await selection(api,windowId,message.tabIds,message.action==='remove');
    if(message.action==='remove') {
      const members=tabs.filter(tab=>tab.groupId>=0).map(tab=>tab.id);
      if(members.length)await api.tabs.ungroup(members);
      return;
    }
    if(message.action==='add') {
      await group(api,windowId,message.groupId);
      await api.tabs.group({tabIds:message.tabIds,groupId:message.groupId});return;
    }
    const id=await api.tabs.group({tabIds:message.tabIds,createProperties:{windowId}});
    try {await api.tabGroups.update(id,{title:name,color:'blue'});}
    catch {throw new Error('Tabs were grouped, but the name could not be applied. Use Manage tab groups to rename.');}
    return;
  }
  if(!['rename','color','toggle-collapse','dissolve'].includes(message.action))throw new Error('Unknown group action');
  const name=message.action==='rename'?title(message.title):undefined;
  if(message.action==='color' && !GROUP_COLORS.includes(message.color))throw new Error('Invalid group color');
  const item=await group(api,windowId,message.groupId);
  if(message.action==='dissolve') {
    const tabs=await api.tabs.query({windowId});
    const ids=tabs.filter(tab=>tab.windowId===windowId && tab.groupId===item.id).map(tab=>tab.id);
    if(ids.length)await api.tabs.ungroup(ids);
    return;
  }
  const update=message.action==='rename'?{title:name}:message.action==='color'?{color:message.color}:{collapsed:!item.collapsed};
  await api.tabGroups.update(item.id,update);
}

export async function groupMetadata(api,windowId) {
  try {
    const items=await api.tabGroups?.query({windowId}) || [];
    return new Map(items.filter(item=>item.windowId===windowId).map(item=>[item.id,{
      groupTitle:item.title || 'Untitled group',groupColor:GROUP_COLORS.includes(item.color)?item.color:'grey',groupCollapsed:Boolean(item.collapsed)
    }]));
  } catch {return new Map();}
}
export function decorateGroup(row,groupId,metadata) {
  return groupId>=0?{...row,...(metadata.get(groupId) || {groupTitle:'Grouped',groupColor:'grey'})}:row;
}
