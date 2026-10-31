import {test} from 'node:test';
import assert from 'node:assert/strict';
import {savePrompt,listPrompts,recoverPrompt} from '../extension/prompt-recovery.js';
function browser(){const data={};return {data,storage:{session:{get:async()=>({...data}),set:async row=>Object.assign(data,row),remove:async keys=>keys.forEach(key=>delete data[key])}}};}
const site={key:'provider:gemini',name:'Gemini',aliases:['gem'],template:'https://www.google.com/search?udm=50&q=%s'};
test('prompt recovery keeps a session copy before navigation and restores text without sending it',async()=>{
 const api=browser();await savePrompt(api,site,'Привет & + world');
 const rows=await listPrompts(api,'gemini');assert.equal(rows.length,1);
 const recovered=await recoverPrompt(api,rows[0].draftId,[site]);
 assert.deepEqual(recovered,{query:'Привет & + world',alias:'gem'});
 assert.ok(!api.storage.local);
});
test('unique records preserve concurrent requests and retain the most recent twenty',async()=>{
 const api=browser();await Promise.all(Array.from({length:22},(_,i)=>savePrompt(api,site,`Request ${i}`)));
 const rows=await listPrompts(api,'');assert.ok(rows.length<=20);assert.ok(rows.length>0);
 assert.equal(new Set(rows.map(row=>row.draftId)).size,rows.length);
});
test('missing drafts fail safely and removed providers retain the original text',async()=>{
 const api=browser();await savePrompt(api,site,'Keep this');const [row]=await listPrompts(api,'');
 assert.deepEqual(await recoverPrompt(api,row.draftId,[]),{query:'Keep this',alias:''});
 await assert.rejects(()=>recoverPrompt(api,'missing',[]));
});
test('storage failure prevents a false promise of saved recovery',async()=>{
 await assert.rejects(()=>savePrompt({},site,'Keep this'),/recovery/i);
});
