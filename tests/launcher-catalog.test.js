import {test} from 'node:test';
import assert from 'node:assert/strict';
import {launcherContext,SHORTCUTS,ACTIONS} from '../extension/launcher-catalog.js';
test('shortcut directory covers navigation, marks, groups, bookmarks, geometry, prefixes and notes',()=>{
  const ids=SHORTCUTS.map(row=>row.id);assert.equal(new Set(ids).size,ids.length);
  for(const id of ['global-search','global-edit','actions','select','mark','open','new','background','current','group','ungroup','manage-groups','bookmark','remove-bookmark','move','move-edge','move-home-end','complete','focus','escape','backspace','position','position-large','reset','resize','resize-reset','note-save','prefix-commands','prefix-order','prefix-closed','prefix-drafts','prefix-links','prefix-groups','prefix-bookmarks','prefix-notes'])assert.ok(ids.includes(id),id);
  for(const id of ['new-note','notes','edit-note','copy-note','remove-note','save-note','shortcuts'])assert.ok(ACTIONS.some(action=>action.id===id),id);
});
test('global shortcuts show actual Chrome bindings, missing assignments and explicit lookup failure',async()=>{
  const context=await launcherContext({commands:{getAll:async()=>[{name:'open-search',shortcut:'Alt+Q'},{name:'edit-address',shortcut:''}]}});
  assert.equal(context.shortcuts.find(row=>row.global==='open-search').shortcut,'Alt+Q');
  assert.equal(context.shortcuts.find(row=>row.global==='edit-address').shortcut,'Not assigned');
  assert.equal((await launcherContext({})).shortcuts.find(row=>row.global).shortcut,'Check Chrome shortcuts');
});
