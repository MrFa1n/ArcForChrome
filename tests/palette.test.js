import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPalette, paletteAction } from '../extension/palette-service.js';
function browser() {
  const calls = [];
  return { calls, runtime: { id:'test', getURL: path => `chrome-extension://test/${path}` },
    tabs: { query: async () => [{id:5,windowId:2,title:'Current'}], get: async id => ({id,windowId:2}),
      create: async options => {calls.push(['create', options]);},
      update: async (...args) => {calls.push(['update',...args]);} },
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
  assert.deepEqual(api.calls,[['create',{windowId:2,url:'https://www.google.com/search?q=cats'}]]);
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
  assert.deepEqual(api.calls,[['create',{windowId:2,url:'https://example.com/'}]]);
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
