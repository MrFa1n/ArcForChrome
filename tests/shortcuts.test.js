import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeCommand, cycleSpace } from '../extension/shortcuts.js';
function browser(tabs) {
  const updates = [];
  return { updates, tabs: { query: async () => tabs, update: async (...args) => updates.push(args) } };
}
test('pin command toggles only the active tab', async () => {
  const api = browser([{id:7,pinned:false}]);
  await executeCommand(api,'toggle-pin');
  assert.deepEqual(api.updates, [[7,{pinned:true}]]);
});
test('tab navigation wraps in both directions', async () => {
  const api = browser([{id:1,index:0,active:true},{id:2,index:1,active:false}]);
  await executeCommand(api,'previous-tab');
  await executeCommand(api,'next-tab');
  assert.deepEqual(api.updates, [[2,{active:true}],[2,{active:true}]]);
});
test('commands tolerate empty windows and ignore unknown actions', async () => {
  const api = browser([]);
  await executeCommand(api,'toggle-pin');
  await executeCommand(api,'next-tab');
  await executeCommand(api,'unknown');
  assert.deepEqual(api.updates, []);
});
test('space navigation wraps through Inbox and available groups', () => {
  assert.equal(cycleSpace([-1,4,8],-1,-1),8);
  assert.equal(cycleSpace([-1,4,8],8,1),-1);
  assert.equal(cycleSpace([-1],-1,1),-1);
});
test('numbered favorites select pinned tabs in native order, not query order', async () => {
  const updates=[];let scope;
  const api={tabs:{query:async options=>{scope=options;return [{id:30,index:2},{id:10,index:0},{id:20,index:1}];},
    update:async(...args)=>updates.push(args)}};
  await executeCommand(api,'pinned-tab-2');
  assert.deepEqual(scope,{currentWindow:true,pinned:true});
  assert.deepEqual(updates,[[20,{active:true}]]);
});
test('favorite 9 activates the ninth pinned tab rather than the final tab', async () => {
  const updates=[];
  const api={tabs:{query:async()=>Array.from({length:12},(_,index)=>({id:index+10,index})),
    update:async(...args)=>updates.push(args)}};
  await executeCommand(api,'pinned-tab-9');
  assert.deepEqual(updates,[[18,{active:true}]]);
});
test('missing favorite slots never activate a regular tab or create a tab', async () => {
  const api=browser([]);
  await executeCommand(api,'pinned-tab-1');await executeCommand(api,'pinned-tab-9');
  assert.deepEqual(api.updates,[]);
});
