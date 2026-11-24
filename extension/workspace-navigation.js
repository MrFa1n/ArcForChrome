import {publicUrl} from './palette-extras.js';

const ROUTES = 'domain-group-routes';
let routeWrite = Promise.resolve();

export async function destinationGroup(api,windowId,sourceId,temporary,url,preferSource = true) {
  if (!api.tabGroups?.query) return null;
  const site = publicUrl(url);
  if (site) {
    const stored = await api.storage?.local?.get(ROUTES).catch(()=>null);
    const route = stored?.[ROUTES]?.find(row => row.host === site.hostname);
    if (route) {
      const groups = (await api.tabGroups.query({windowId})).filter(group =>
        group.windowId === windowId && group.title === route.group);
      if (groups.length === 1) return groups[0].id;
    }
  }
  if (!preferSource) return null;
  const source = temporary
    ? (await api.tabs.query({windowId})).filter(tab => tab.id !== sourceId && tab.url &&
        !['chrome://newtab/',api.runtime.getURL('newtab.html')].includes(tab.url))
        .sort((a,b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0]
    : await api.tabs.get(sourceId);
  return source?.windowId === windowId && source.groupId >= 0 ? source.groupId : null;
}

export async function saveDomainRoute(api,windowId,value,groupId) {
  const site = publicUrl(value);
  if (!site) throw new Error('Choose a web address to route');
  let group;
  if (groupId !== null) {
    if (!Number.isInteger(groupId)) throw new Error('Choose a group');
    group = await api.tabGroups.get(groupId);
    if (group.windowId !== windowId || !group.title?.trim()) throw new Error('Choose a named group in this window');
    const sameName = (await api.tabGroups.query({windowId})).filter(row => row.title === group.title);
    if (sameName.length !== 1) throw new Error('Use a unique group name for domain routing');
  }
  const write = routeWrite.catch(()=>{}).then(async () => {
    const previous = (await api.storage.local.get(ROUTES))[ROUTES] || [];
    const remaining = previous.filter(row => row.host !== site.hostname);
    await api.storage.local.set({[ROUTES]:(group ? [{host:site.hostname,group:group.title},...remaining] : remaining).slice(0,100)});
  });
  routeWrite = write;
  return write;
}

export async function openPreview(api,context,value) {
  const url = publicUrl(value);
  if (!url) throw new Error('Choose a web link to preview');
  const origin = context.newTab ? (await api.tabs.query({windowId:context.windowId}))
    .filter(item => item.id !== context.tabId && publicUrl(item.url))
    .sort((a,b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] : null;
  const preview = await api.windows.create({type:'popup',width:960,height:700,url:url.href,focused:true});
  const [tab] = await api.tabs.query({windowId:preview.id});
  if (tab) await api.storage.session.set({[`preview:${tab.id}`]:{windowId:context.windowId,tabId:origin?.id ?? context.tabId,previewId:preview.id}});
}

export async function promotePreview(api,context,split) {
  const key = `preview:${context.tabId}`;
  const origin = (await api.storage.session.get(key))[key];
  if (!origin || origin.previewId !== context.windowId) throw new Error('Open a link with Temporary preview first');
  if (split && typeof api.tabs.createSplit !== 'function') throw new Error('Split View requires Chrome 155 or later');
  const target = split ? await api.tabs.get(origin.tabId) : null;
  if (split && (target.windowId !== origin.windowId || target.splitViewId >= 0 || target.pinned || target.groupId >= 0)) {
    throw new Error('Split requires an unpinned, ungrouped source tab');
  }
  await api.windows.get(origin.windowId);
  await api.tabs.move(context.tabId,{windowId:origin.windowId,index:split ? target.index + 1 : -1});
  await api.storage.session.remove(key);
  if (split) await api.tabs.createSplit([target.id,context.tabId]);
  await api.tabs.update(context.tabId,{active:true});
  await api.windows.update(origin.windowId,{focused:true});
}
