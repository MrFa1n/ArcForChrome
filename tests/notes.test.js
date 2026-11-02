import {test} from 'node:test';
import assert from 'node:assert/strict';
import {noteSuggestions,noteAction} from '../extension/notes.js';
function browser(){const values={unrelated:{value:'kept'}};return {values,storage:{local:{get:async()=>({...values}),set:async data=>Object.assign(values,data),remove:async id=>{delete values[id];}}}};}
test('notes persist multiline text, search their bodies, edit and remove independently of other data',async()=>{
  const api=browser();
  const created=await noteAction(api,{operation:'save',title:'Meeting',body:'First line\nОбсудить проект'});
  const [row]=await noteSuggestions(api,'проект');assert.equal(row.noteId,created.note.id);assert.equal(row.title,'Meeting');
  const loaded=await noteAction(api,{operation:'get',id:row.noteId});assert.equal(loaded.note.body,'First line\nОбсудить проект');
  const edited=await noteAction(api,{operation:'save',id:row.noteId,revision:loaded.note.revision,title:'Updated',body:'Changed'});
  assert.equal(edited.note.revision,2);
  await noteAction(api,{operation:'remove',id:row.noteId,revision:2});
  assert.deepEqual(await noteSuggestions(api,''),[]);assert.deepEqual(api.values.unrelated,{value:'kept'});
});
test('stale editors cannot overwrite or delete newer note content',async()=>{
  const api=browser(),{note}=await noteAction(api,{operation:'save',title:'Draft',body:'Original'});
  await noteAction(api,{operation:'save',id:note.id,revision:1,title:'Latest',body:'Keep me'});
  for(const operation of ['save','remove'])await assert.rejects(()=>noteAction(api,{operation,id:note.id,revision:1,title:'Stale',body:'Old'}),/changed/);
  assert.equal((await noteAction(api,{operation:'get',id:note.id})).note.body,'Keep me');
});
test('note validation rejects foreign ids, empty or oversized notes and bounds storage',async()=>{
  const api=browser();
  for(const message of [{operation:'get',id:'unrelated'},{operation:'remove',id:'unrelated',revision:1},{operation:'save',title:'',body:' '},{operation:'save',title:'x'.repeat(81),body:'x'},{operation:'save',title:'x',body:'x'.repeat(20001)}])await assert.rejects(()=>noteAction(api,message));
  for(let index=0;index<200;index++)await noteAction(api,{operation:'save',title:String(index),body:'Text'});
  await assert.rejects(()=>noteAction(api,{operation:'save',title:'Overflow',body:'Text'}),/200/);
  assert.equal((await noteSuggestions(api,'')).length,200);
});
