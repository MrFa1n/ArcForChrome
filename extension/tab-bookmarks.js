import {browserPageUrl} from './browser-pages.js';
function canonical(value) {
  try {
    const internal=browserPageUrl(value);if(internal)return internal;
    const url=new URL(value);
    return ['http:','https:'].includes(url.protocol) && !url.username && !url.password?url.href:null;
  } catch {return null;}
}
function operation(value) {if(!['add','remove'].includes(value))throw new Error('Unknown bookmark action');}
async function selectedPages(api,windowId,ids) {
  if(!Array.isArray(ids) || !ids.length || ids.length>100 || new Set(ids).size!==ids.length || ids.some(id=>!Number.isInteger(id) || id<0))throw new Error('Select 1–100 distinct open tabs');
  const tabs=await Promise.all(ids.map(id=>api.tabs.get(id)));
  if(tabs.some(tab=>!tab || tab.windowId!==windowId))throw new Error('A selected tab is no longer in this window');
  const pages=new Map();
  for(const tab of tabs) {
    const url=canonical(tab.url);if(!url)throw new Error('Only web pages and supported Chrome sections can be bookmarked');
    if(!pages.has(url))pages.set(url,{url,title:tab.title || url});
  }
  return [...pages.values()];
}
function writableFolders(tree) {
  const folders=[];const stack=tree.slice().reverse().map(node=>({node,path:[]}));
  while(stack.length) {
    const {node,path}=stack.pop();
    if(node.url || node.unmodifiable || node.folderType==='managed')continue;
    const root=node.id==='0' || node.parentId===undefined;
    const location=node.parentId==='0' && typeof node.syncing==='boolean'?` (${node.syncing?'Account':'On device'})`:'';
    const next=root?path:[...path,(node.title || 'Unnamed folder')+location];
    if(!root)folders.push({id:node.id,path:next.join(' / '),children:node.children || []});
    for(const child of (node.children || []).slice().reverse())stack.push({node:child,path:next});
  }
  return folders;
}
export async function bookmarkFolders(api,windowId,query,action,ids) {
  operation(action);
  const [pages,tree]=await Promise.all([selectedPages(api,windowId,ids),api.bookmarks.getTree()]);
  const urls=new Set(pages.map(page=>page.url));
  const terms=query.trim().toLocaleLowerCase().split(/\s+/);
  return writableFolders(tree).filter(folder=>terms.every(term=>folder.path.toLocaleLowerCase().includes(term)))
    .map(folder=>({folder,count:folder.children.filter(child=>urls.has(canonical(child.url)) && !child.unmodifiable).length}))
    .filter(({count})=>action==='add' || count>0).slice(0,100)
    .map(({folder,count})=>({kind:'bookmark-folder',folderId:folder.id,title:folder.path,
      url:action==='add'?`Save ${pages.length} page(s) here · ${count} already saved`:`Remove ${count} matching bookmark(s) here · Other folders stay unchanged`}));
}
async function mutate(api,windowId,message) {
  operation(message.operation);
  if(typeof message.folderId!=='string' || !message.folderId || message.folderId.length>128)throw new Error('Choose a bookmark folder');
  const [pages,tree]=await Promise.all([selectedPages(api,windowId,message.tabIds),api.bookmarks.getTree()]);
  const folder=writableFolders(tree).find(folder=>folder.id===message.folderId);
  if(!folder)throw new Error('Folder is unavailable or read-only');
  const children=await api.bookmarks.getChildren(folder.id);
  const urls=new Set(pages.map(page=>page.url));
  const existing=new Set(children.map(child=>canonical(child.url)).filter(Boolean));
  const pending=message.operation==='add'?pages.filter(page=>!existing.has(page.url)):children.filter(child=>child.url && urls.has(canonical(child.url)));
  if(pending.some(child=>child.unmodifiable))throw new Error('A matching bookmark is managed and cannot be removed');
  let changed=0;
  try {
    for(const item of pending) {
      if(message.operation==='add')await api.bookmarks.create({parentId:folder.id,title:item.title,url:item.url});
      else await api.bookmarks.remove(item.id);
      changed++;
    }
  } catch {throw new Error(`${message.operation==='add'?'Saved':'Removed'} ${changed} of ${pending.length} bookmarks before Chrome failed. Refresh the folder list and retry; completed changes remain.`);}
  return {changed,skipped:message.operation==='add'?pages.length-pending.length:0,folderPath:folder.path};
}
// Serialize extension-originated mutations so two palettes cannot both create the same missing URL.
let mutations=Promise.resolve();
export function changeBookmarks(api,windowId,message) {
  const result=mutations.then(()=>mutate(api,windowId,message));
  mutations=result.catch(()=>{});return result;
}
