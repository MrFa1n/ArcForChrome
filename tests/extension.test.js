import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { registerSearch } from '../extension/search-controller.js';
const root = new URL('../extension/', import.meta.url);
test('command-bar manifest declares required permissions and entry points', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['tabs','activeTab','scripting','history','bookmarks','search','sessions','storage','clipboardWrite']);
  assert.equal(manifest.side_panel, undefined);
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(Object.keys(manifest.commands),['open-search','edit-address']);
  assert.equal(manifest.commands['open-search'].suggested_key.mac,'Command+T');
  await Promise.all([manifest.background.service_worker,'palette.html',manifest.options_ui.page].map(path => access(new URL(path, root))));
});
function browser() {
  const listeners={};const injected=[];
  return {listeners,injected,
    action:{onClicked:{addListener:fn=>{listeners.click=fn;}}},
    commands:{onCommand:{addListener:fn=>{listeners.command=fn;}}},
    runtime:{id:'test',onMessage:{addListener:fn=>{listeners.message=fn;}}},
    tabs:{query:async()=>[{id:3,windowId:7,title:'Page',url:'https://example.com'}]},
    scripting:{executeScript:async options=>injected.push(options)}
  };
}
test('toolbar click and search shortcut both open the palette; removed commands do nothing', async () => {
  const api=browser();const mount=()=>{};registerSearch(api,mount);
  await api.listeners.click();await api.listeners.command('open-search');
  await api.listeners.command('toggle-pin');await api.listeners.command('recent-tab');
  assert.equal(api.injected.length,2);
  assert.ok(api.injected.every(options=>options.target.tabId===3 && options.func===mount));
});
test('suggestion messages return search results and unrelated messages are ignored', async () => {
  const api=browser();registerSearch(api,()=>{});
  assert.equal(api.listeners.message({type:'toggle-pin'},{},()=>{throw Error('Unexpected');}),undefined);
  const response=await new Promise(resolve=>{
    assert.equal(api.listeners.message({type:'palette:suggest',query:''},{id:'test',tab:{windowId:7}},resolve),true);
  });
  assert.equal(response.ok,true);assert.equal(response.suggestions[0].id,3);
});
test('invalid search messages return an error instead of an unhandled rejection', async () => {
  const api=browser();registerSearch(api,()=>{});
  const response=await new Promise(resolve=>api.listeners.message({type:'palette:suggest',query:''},{id:'foreign'},resolve));
  assert.equal(response.ok,false);assert.equal(response.error,'Unknown sender');
});
test('edit-address command injects explicit current-page context',async()=>{
  const api=browser();registerSearch(api,()=>{});await api.listeners.command('edit-address');
  assert.equal(api.injected[0].args[2].mode,'edit');
  assert.equal(api.injected[0].args[2].sourceUrl,'https://example.com');
});
