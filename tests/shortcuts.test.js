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
