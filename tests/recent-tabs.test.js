import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecentTabs } from '../extension/recent-tabs.js';
function browser() {
  let saved={};let time=1000;
  const tabs=[{id:1,index:0,windowId:7,active:true,lastAccessed:100},{id:2,index:1,windowId:7,lastAccessed:50},{id:3,index:2,windowId:7,lastAccessed:80}];
  const updates=[];
  const api={storage:{session:{get:async()=>structuredClone(saved),set:async value=>{saved=structuredClone(value);}}},
    tabs:{query:async query=>tabs.filter(tab=>query.windowId===undefined||tab.windowId===query.windowId),
      update:async(id)=>{updates.push(id);const target=tabs.find(tab=>tab.id===id);for(const tab of tabs)if(tab.windowId===target.windowId)tab.active=tab.id===id;}}};
  return {api,tabs,updates,now:()=>time,advance:()=>{time+=2000;}};
}
test('first switch uses last activity rather than tab position', async()=>{
  const b=browser();await createRecentTabs(b.api,{now:b.now}).cycle();assert.deepEqual(b.updates,[3]);
});
test('rapid repeated switching traverses a frozen MRU list and wraps', async()=>{
  const b=browser();const recent=createRecentTabs(b.api,{now:b.now});
  await recent.cycle();await recent.activated({windowId:7,tabId:3});
  await recent.cycle();await recent.activated({windowId:7,tabId:2});
  await recent.cycle();assert.deepEqual(b.updates,[3,2,1]);
});
test('after a pause the command returns to the last active tab', async()=>{
  const b=browser();const recent=createRecentTabs(b.api,{now:b.now});
  await recent.cycle();await recent.activated({windowId:7,tabId:3});b.advance();await recent.cycle();
  assert.deepEqual(b.updates,[3,1]);
});
test('manual activations update recency and cancel an in-progress cycle', async()=>{
  const b=browser();const recent=createRecentTabs(b.api,{now:b.now});
  await recent.cycle();await recent.activated({windowId:7,tabId:3});
  b.tabs.forEach(tab=>tab.active=tab.id===2);await recent.activated({windowId:7,tabId:2});
  await recent.cycle();assert.deepEqual(b.updates,[3,3]);
});
test('recency survives service-worker recreation and stays within a window', async()=>{
  const b=browser();let recent=createRecentTabs(b.api,{now:b.now});
  await recent.activated({windowId:7,tabId:2});
  b.tabs.forEach(tab=>tab.active=tab.id===1);await recent.activated({windowId:7,tabId:1});
  b.tabs.push({id:9,windowId:8,active:true,lastAccessed:9999});
  recent=createRecentTabs(b.api,{now:b.now});await recent.cycle();assert.deepEqual(b.updates,[2]);
});
test('closed tabs are skipped and one-tab windows are unchanged', async()=>{
  const b=browser();const recent=createRecentTabs(b.api,{now:b.now});
  await recent.cycle();b.tabs.splice(b.tabs.findIndex(tab=>tab.id===2),1);await recent.cycle();
  assert.deepEqual(b.updates,[3,1]);
  b.tabs.splice(1);await recent.cycle();assert.deepEqual(b.updates,[3,1]);
});
test('activation events are serialized without losing recency writes', async()=>{
  const b=browser();const recent=createRecentTabs(b.api,{now:b.now});
  await Promise.all([recent.activated({windowId:7,tabId:3}),recent.activated({windowId:7,tabId:2}),recent.activated({windowId:7,tabId:1})]);
  await recent.cycle();assert.deepEqual(b.updates,[2]);
});
test('removed windows and detached tabs do not remain in stored recency', async()=>{
  const b=browser();const recent=createRecentTabs(b.api,{now:b.now});
  await recent.activated({windowId:7,tabId:2});await recent.removed(7,2);
  const {recentTabs}=await b.api.storage.session.get('recentTabs');
  assert.ok(!recentTabs[7].order.includes(2));
  await recent.removed(7);
  assert.deepEqual((await b.api.storage.session.get('recentTabs')).recentTabs,{});
});
test('failed tab updates preserve state and do not poison subsequent commands', async()=>{
  const b=browser();const recent=createRecentTabs(b.api,{now:b.now});
  const update=b.api.tabs.update;b.api.tabs.update=async()=>{throw Error('Tab closed');};
  await assert.rejects(()=>recent.cycle());
  b.api.tabs.update=update;await recent.cycle();assert.deepEqual(b.updates,[3]);
});
