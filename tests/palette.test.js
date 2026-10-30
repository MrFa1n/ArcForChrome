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
