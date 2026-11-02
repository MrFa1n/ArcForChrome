import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPalette, paletteAction } from '../extension/palette-service.js';
function browser() {
  const calls = [];
  return { calls, runtime: { id:'test', getURL: path => `chrome-extension://test/${path}` },
    tabs: { query: async () => [{id:5,windowId:2,title:'Current'}], get: async id => ({id,windowId:2}),
      create: async options => {calls.push(['create', options]);return {id:99};},
      update: async (...args) => {calls.push(['update',...args]);} },
    search:{query:async options=>calls.push(['search',options])},
    scripting: { executeScript: async options => { calls.push(['inject',options.target]); } },
    windows: { update: async () => {}, create: async options => calls.push(['popup',options]) } };
}
const sender = { id:'test',tab:{id:5,windowId:2} };
test('opening search injects an overlay without changing or creating tabs', async () => {
  const api=browser(); await openPalette(api,()=>{});
  assert.deepEqual(api.calls,[['inject',{tabId:5}]]);
});
test('restricted pages fall back to a separate popup without navigating the current tab', async () => {
  const api=browser();api.scripting.executeScript=async()=>{throw Error('Restricted');};
  await openPalette(api,()=>{});
  assert.equal(api.calls[0][0],'popup');
  assert.equal(api.calls[0][1].type,'popup');
  assert.match(api.calls[0][1].url,/window=2/);
});
test('submitting search creates a new tab and leaves the current tab untouched', async () => {
  const api=browser();await paletteAction(api,{type:'palette:navigate',query:'cats'},sender);
  assert.deepEqual(api.calls,[['create',{windowId:2,active:true}],['search',{text:'cats',tabId:99}]]);
});
test('selecting a result activates an existing tab', async () => {
  const api=browser();await paletteAction(api,{type:'palette:activate',tabId:8},sender);
  assert.deepEqual(api.calls,[['update',8,{active:true}]]);
});
test('foreign senders, malformed queries and tabs from other windows are rejected', async () => {
  const api=browser();
  await assert.rejects(()=>paletteAction(api,{type:'palette:navigate',query:'x'},{id:'other'}));
  await assert.rejects(()=>paletteAction(api,{type:'palette:navigate',query:12},sender));
  api.tabs.get=async()=>({windowId:9});
  await assert.rejects(()=>paletteAction(api,{type:'palette:activate',tabId:8},sender));
  assert.deepEqual(api.calls,[]);
});
test('blank navigation does not create tabs', async () => {
  const api=browser();await paletteAction(api,{type:'palette:navigate',query:'  '},sender);
  assert.deepEqual(api.calls,[]);
});
test('fallback popup routes results to its original window', async () => {
  const api=browser();await paletteAction(api,{type:'palette:navigate',query:'example.com'},
    {id:'test',url:'chrome-extension://test/palette.html?window=2'});
  assert.deepEqual(api.calls,[['create',{windowId:2,active:true,url:'https://example.com/'}]]);
});
test('other extension pages cannot forge popup requests', async () => {
  const api=browser();
  await assert.rejects(()=>paletteAction(api,{type:'palette:navigate',query:'x'},
    {id:'test',url:'chrome-extension://other/palette.html?window=2'}));
});
test('suggestion requests use the validated source window', async () => {
  const api=browser();let scoped;
  api.tabs.query=async options=>{scoped=options;return [{id:8,title:'Saved page',url:'https://example.com'}];};
  api.bookmarks={search:async()=>[]};api.history={search:async()=>[]};
  const response=await paletteAction(api,{type:'palette:suggest',query:'saved'},sender);
  assert.deepEqual(scoped,{windowId:2});
  assert.equal(response.suggestions[0].id,8);
});
test('background URL navigation keeps the source window and does not activate the new tab',async()=>{
  const api=browser();await paletteAction(api,{type:'palette:navigate',query:'example.com',target:'background'},sender);
  assert.deepEqual(api.calls,[['create',{windowId:2,active:false,url:'https://example.com/'}]]);
});
test('edit mode changes only the validated source tab',async()=>{
  const api=browser();await paletteAction(api,{type:'palette:navigate',query:'example.com',target:'current'},sender);
  assert.deepEqual(api.calls,[['update',5,{url:'https://example.com/'}]]);
  api.tabs.get=async()=>({id:5,windowId:9});
  await assert.rejects(()=>paletteAction(api,{type:'palette:navigate',query:'example.com',target:'current'},sender));
});
test('re-submitting the unchanged current URL reloads the page',async()=>{
  const api=browser();api.tabs.get=async()=>({id:5,windowId:2,url:'https://example.com/'});api.tabs.reload=async id=>api.calls.push(['reload',id]);
  await paletteAction(api,{type:'palette:navigate',query:'https://example.com/',target:'current'},sender);
  assert.deepEqual(api.calls,[['reload',5]]);
});
test('site search navigates with the configured encoded template',async()=>{
  const api=browser();api.history={search:async()=>[{title:'GitHub',url:'https://github.com/search?q=old'}]};await paletteAction(api,{type:'palette:site',site:'auto:https://github.com',query:'my project'},sender);
  assert.deepEqual(api.calls,[['create',{windowId:2,active:true,url:'https://github.com/search?q=my%20project'}]]);
});
test('command mode is explicit and unknown commands cannot execute',async()=>{
  const api=browser();const response=await paletteAction(api,{type:'palette:suggest',query:'reload',mode:'commands'},sender);
  assert.equal(response.suggestions[0].command,'reload');
  await assert.rejects(()=>paletteAction(api,{type:'palette:command',command:'delete-all-tabs'},sender));
});
test('closed suggestions and restoration preserve a real browser session',async()=>{
  const api=browser();api.sessions={getRecentlyClosed:async()=>[{tab:{sessionId:'closed-1',title:'Project',url:'https://example.com'}}],restore:async id=>{api.calls.push(['restore',id]);return {tab:{windowId:2}};}};
  const response=await paletteAction(api,{type:'palette:suggest',query:'project',mode:'closed'},sender);
  assert.equal(response.suggestions[0].sessionId,'closed-1');
  await paletteAction(api,{type:'palette:restore',sessionId:'closed-1'},sender);
  assert.deepEqual(api.calls,[['restore','closed-1']]);
  await assert.rejects(()=>paletteAction(api,{type:'palette:restore',sessionId:'missing'},sender));
});
test('copy URL returns the validated source page URL',async()=>{
  const api=browser();api.tabs.get=async()=>({id:5,windowId:2,url:'https://example.com/private'});
  assert.deepEqual(await paletteAction(api,{type:'palette:command',command:'copy-url'},sender),{copyText:'https://example.com/private'});
});
test('unknown navigation targets and forged source tabs cannot replace another page',async()=>{
  const api=browser();await assert.rejects(()=>paletteAction(api,{type:'palette:navigate',query:'example.com',target:'other-window'},sender));
  await assert.rejects(()=>paletteAction(api,{type:'palette:navigate',query:'example.com',target:'current'},{id:'test',url:'chrome-extension://test/palette.html?window=2'}));
  assert.deepEqual(api.calls,[]);
});
test('custom saved Site Search definitions are used rather than hard-coded providers',async()=>{
  const api=browser();api.storage={local:{get:async()=>({sites:[{key:'docs',name:'Docs',template:'https://docs.example/find/%s'}]})}};
  await paletteAction(api,{type:'palette:site',site:'docs',query:'two words',target:'background'},sender);
  assert.deepEqual(api.calls,[['create',{windowId:2,active:false,url:'https://docs.example/find/two%20words'}]]);
});
test('arranging uses validated source-window tabs and does not activate or navigate',async()=>{
 const api=browser();const moves=[];
 api.tabs.query=async({windowId})=>[{id:7,windowId,index:0},{id:8,windowId,index:1}];
 api.tabs.move=async(...args)=>moves.push(args);
 const response=await paletteAction(api,{type:'palette:suggest',mode:'order',query:''},sender);
 assert.deepEqual(response.suggestions.map(row=>row.tabId),[7,8]);
 await paletteAction(api,{type:'palette:move',tabId:8,placement:'start'},sender);
 assert.deepEqual(moves,[[8,{index:0}]]);assert.deepEqual(api.calls,[]);
 await assert.rejects(()=>paletteAction(api,{type:'palette:move',tabId:8,placement:'end'},{id:'foreign'}));
 await assert.rejects(()=>paletteAction(api,{type:'palette:move',tabId:99,placement:'end'},sender));
});
test('browser page suggestions open internal destinations instead of submitting web searches',async()=>{
 const api=browser();api.tabs.query=async()=>[];
 const result=await paletteAction(api,{type:'palette:suggest',query:'расширения'},sender);
 assert.equal(result.suggestions.find(row=>row.kind==='browser-page').url,'chrome://extensions/');
 await paletteAction(api,{type:'palette:navigate',query:'chrome://extensions/'},sender);
 assert.deepEqual(api.calls,[['create',{windowId:2,active:true,url:'chrome://extensions/'}]]);
});
test('known Chrome addresses retain background/current navigation behavior',async()=>{
 const api=browser();
 await paletteAction(api,{type:'palette:navigate',query:'chrome://settings',target:'background'},sender);
 await paletteAction(api,{type:'palette:navigate',query:'chrome://extensions',target:'current'},sender);
 assert.deepEqual(api.calls,[['create',{windowId:2,active:false,url:'chrome://settings/'}],['update',5,{url:'chrome://extensions/'}]]);
});

test('Chrome settings command is distinct from extension Search settings',async()=>{
 const api=browser();
 const response=await paletteAction(api,{type:'palette:suggest',query:'настройки',mode:'commands'},sender);
 assert.ok(response.suggestions.some(row=>row.command==='browser:settings'));
 await paletteAction(api,{type:'palette:command',command:'browser:settings'},sender);
 assert.deepEqual(api.calls,[['create',{windowId:2,active:true,url:'chrome://settings/'}]]);
 await assert.rejects(()=>paletteAction(api,{type:'palette:command',command:'browser:quit'},sender));
});

test('an AI prompt is recoverable even when destination navigation fails',async()=>{
 const api=browser();const saved={};
 api.storage={session:{get:async()=>({...saved}),set:async value=>Object.assign(saved,value),remove:async keys=>keys.forEach(key=>delete saved[key])}};
 api.tabs.create=async()=>{assert.ok(Object.values(saved).some(row=>row.query==='Keep my prompt'));throw Error('Could not open destination');};
 await assert.rejects(()=>paletteAction(api,{type:'palette:site',site:'provider:gemini',query:'Keep my prompt'},sender));
 const result=await paletteAction(api,{type:'palette:suggest',mode:'drafts',query:''},sender);
 assert.equal(result.suggestions.length,1);
 const recovered=await paletteAction(api,{type:'palette:recover',draftId:result.suggestions[0].draftId},sender);
 assert.deepEqual(recovered,{query:'Keep my prompt',alias:'gem'});
 await paletteAction(api,{type:'palette:command',command:'clear-prompts'},sender);
 assert.deepEqual(saved,{});
});
test('AI navigation stops if its recovery copy cannot be saved',async()=>{
 const api=browser();
 await assert.rejects(()=>paletteAction(api,{type:'palette:site',site:'provider:claude',query:'Keep my prompt'},sender),/recovery/);
 assert.deepEqual(api.calls,[]);
});
test('executed actions log metadata without URL query/path content by default',async()=>{
 const api=browser();const saved={};
 api.storage={local:{get:async()=>({...saved}),set:async value=>Object.assign(saved,value),remove:async keys=>keys.forEach(key=>delete saved[key])}};
 await paletteAction(api,{type:'palette:navigate',query:'https://example.com/private?token=fixture'},sender);
 const rows=Object.entries(saved).filter(([key])=>key.startsWith('activity:entry:')).map(([,row])=>row);
 assert.equal(rows.length,1);assert.equal(rows[0].label,'Open example.com');assert.equal(rows[0].status,'ok');
 assert.ok(!JSON.stringify(rows).includes('token'));assert.equal(rows[0].text,undefined);
});
test('restricted pages prefer the toolbar popup inside the source browser window',async()=>{
 const api=browser();api.scripting.executeScript=async()=>{throw Error('Restricted');};
 api.action={setPopup:async options=>api.calls.push(['setPopup',options]),openPopup:async options=>api.calls.push(['openPopup',options])};
 await openPalette(api,()=>{});
 assert.equal(api.calls[0][0],'setPopup');assert.match(api.calls[0][1].popup,/surface=action/);
 assert.deepEqual(api.calls[1],['openPopup',{windowId:2}]);
 assert.deepEqual(api.calls[2],['setPopup',{tabId:5,popup:''}]);
 assert.ok(!api.calls.some(call=>call[0]==='popup'));
});
test('native popup failure restores toolbar behavior before legacy fallback',async()=>{
 const api=browser();api.scripting.executeScript=async()=>{throw Error('Restricted');};
 api.action={setPopup:async options=>api.calls.push(['setPopup',options]),openPopup:async()=>{throw Error('Unavailable');}};
 await openPalette(api,()=>{});
 assert.deepEqual(api.calls[1],['setPopup',{tabId:5,popup:''}]);
 assert.equal(api.calls[2][0],'popup');
});
test('group mutations stay in the validated source window and preserve native tabs',async()=>{
 const api=browser();const changes=[];
 api.tabs.get=async id=>({id,windowId:id===9?9:2,pinned:false,groupId:7});
 api.tabs.group=async options=>{changes.push(options);return 7;};
 api.tabGroups={get:async()=>({id:7,windowId:2}),update:async()=>{}};
 await paletteAction(api,{type:'palette:group',action:'add',tabIds:[5],groupId:7},sender);
 assert.deepEqual(changes,[{tabIds:[5],groupId:7}]);
 await assert.rejects(()=>paletteAction(api,{type:'palette:group',action:'add',tabIds:[9],groupId:7},sender));
 await assert.rejects(()=>paletteAction(api,{type:'palette:group',action:'add',tabIds:[5],groupId:7},{id:'foreign'}));
 assert.equal(changes.length,1);assert.deepEqual(api.calls,[]);
});
test('bookmark mutation routes only selected source-window tabs to the requested folder',async()=>{
 const api=browser();const created=[];
 api.tabs.get=async id=>({id,windowId:id===9?9:2,title:'Selected',url:'https://selected.example/'});
 api.bookmarks={getTree:async()=>[{id:'0',children:[{id:'folder',parentId:'0',title:'Work'}]}],getChildren:async()=>[],create:async data=>created.push(data)};
 await paletteAction(api,{type:'palette:bookmark',operation:'add',folderId:'folder',tabIds:[5]},sender);
 assert.deepEqual(created,[{parentId:'folder',title:'Selected',url:'https://selected.example/'}]);
 await assert.rejects(()=>paletteAction(api,{type:'palette:bookmark',operation:'add',folderId:'folder',tabIds:[9]},sender));
 await assert.rejects(()=>paletteAction(api,{type:'palette:bookmark',operation:'add',folderId:'folder',tabIds:[5]},{id:'foreign'}));
 assert.equal(created.length,1);assert.deepEqual(api.calls,[]);
});

test('launcher tools offer calculator, named links and recent commands without leaking query text',async()=>{
  const api=browser(),stored={};
  api.storage={local:{get:async()=>({...stored}),set:async value=>Object.assign(stored,value),remove:async keys=>{for(const key of Array.isArray(keys)?keys:[keys])delete stored[key];}}};
  api.tabs.get=async id=>({id,windowId:2,title:'Project',url:'https://example.com/work'});
  await paletteAction(api,{type:'palette:quicklink',operation:'save',name:'Work',tabId:5},sender);
  const links=await paletteAction(api,{type:'palette:suggest',mode:'quicklinks',query:'work'},sender);
  assert.equal(links.suggestions[0].url,'https://example.com/work');
  const calc=await paletteAction(api,{type:'palette:suggest',query:'1250 * 0.18'},sender);
  assert.equal(calc.suggestions.find(row=>row.kind==='calculator').copyText,'225');
  await paletteAction(api,{type:'palette:command',command:'copy-url'},sender);
  const idle=await paletteAction(api,{type:'palette:suggest',query:''},sender);
  assert.ok(idle.suggestions.some(row=>row.kind==='quicklink'));
  assert.ok(idle.suggestions.some(row=>row.command==='copy-url'));
  assert.ok(idle.suggestions.some(row=>row.kind==='activity' && row.title==='Copy current URL'));
  const duplicateCalls=api.calls.filter(call=>call[0]==='update').length;
  assert.equal(duplicateCalls,0,'listing recent actions does not replay them');
  await assert.rejects(()=>paletteAction(api,{type:'palette:quicklink',operation:'save',name:'Foreign',tabId:9},{...sender,tab:{id:5,windowId:8}}));
});

test('contextual duplicate validates selected tab and source window before mutation',async()=>{
  const api=browser();api.tabs.duplicate=async id=>api.calls.push(['duplicate',id]);
  await paletteAction(api,{type:'palette:tab-action',action:'duplicate',tabId:8},sender);
  assert.deepEqual(api.calls,[['duplicate',8]]);
  api.tabs.get=async id=>({id,windowId:9});
  await assert.rejects(()=>paletteAction(api,{type:'palette:tab-action',action:'duplicate',tabId:8},sender));
  await assert.rejects(()=>paletteAction(api,{type:'palette:tab-action',action:'close',tabId:8},sender));
  assert.equal(api.calls.length,1);
});


test('empty launcher labels starter commands accurately without history',async()=>{
  const api=browser();const response=await paletteAction(api,{type:'palette:suggest',query:''},sender);
  const commands=response.suggestions.filter(row=>row.kind==='command');
  assert.equal(commands.length,3);assert.ok(commands.every(row=>row.section==='Commands'));
});

test('notes use validated messages and keep text out of the action journal',async()=>{
  const api=browser(),stored={'activity:settings':{enabled:true,includeText:true,retentionHours:168,maxEntries:500}};
  api.storage={local:{get:async()=>({...stored}),set:async value=>Object.assign(stored,value),remove:async keys=>{for(const key of Array.isArray(keys)?keys:[keys])delete stored[key];}}};
  const created=await paletteAction(api,{type:'palette:note',operation:'save',title:'Ideas',body:'Private fictional note content'},sender);
  const result=await paletteAction(api,{type:'palette:suggest',mode:'notes',query:'fictional'},sender);
  assert.equal(result.suggestions[0].noteId,created.note.id);
  const journal=Object.entries(stored).filter(([key])=>key.startsWith('activity:entry:'));
  assert.equal(journal.length,1);assert.ok(!JSON.stringify(journal).includes('fictional'));
  await paletteAction(api,{type:'palette:note',operation:'get',id:created.note.id},sender);
  assert.equal(Object.keys(stored).filter(key=>key.startsWith('activity:entry:')).length,1,'reading a note is not an action-history write');
  await assert.rejects(()=>paletteAction(api,{type:'palette:note',operation:'get',id:created.note.id},{id:'foreign'}));
});
