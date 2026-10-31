import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordActivity,listActivity,saveActivitySettings,clearActivity,DEFAULT_ACTIVITY_SETTINGS} from '../extension/activity-store.js';
function browser(){const data={};return {data,storage:{local:{get:async()=>({...data}),set:async rows=>Object.assign(data,rows),remove:async keys=>keys.forEach(key=>delete data[key])}}};}
test('action history omits request content by default and supports opt-in text',async()=>{
 const api=browser();await recordActivity(api,{action:'site',label:'Search Gemini',status:'ok',text:'Secret prompt'});
 let rows=await listActivity(api);assert.equal(rows.length,1);assert.equal(rows[0].text,undefined);
 await saveActivitySettings(api,{...DEFAULT_ACTIVITY_SETTINGS,includeText:true});
 await recordActivity(api,{action:'site',label:'Search Gemini',status:'error',text:'Keep this request'});
 rows=await listActivity(api,'keep this');assert.equal(rows.length,1);assert.equal(rows[0].text,'Keep this request');
});
test('age/count limits clean history and manual clear preserves settings and unrelated data',async()=>{
 const api=browser();api.data.unrelated='keep';
 await saveActivitySettings(api,{...DEFAULT_ACTIVITY_SETTINGS,maxEntries:2});
 for(let i=0;i<4;i++)await recordActivity(api,{action:'move',label:`Move ${i}`,status:'ok'});
 assert.equal((await listActivity(api)).length,2);
 api.data['activity:entry:expired']={time:Date.now()-8*24*3600000,label:'Expired'};
 await listActivity(api);assert.equal(api.data['activity:entry:expired'],undefined);
 await clearActivity(api);assert.equal((await listActivity(api)).length,0);assert.equal(api.data.unrelated,'keep');
 assert.ok(api.data['activity:settings']);
});
test('disabled recording and invalid retention settings cannot silently expand history',async()=>{
 const api=browser();await saveActivitySettings(api,{...DEFAULT_ACTIVITY_SETTINGS,enabled:false});
 await recordActivity(api,{action:'site',label:'Search',status:'ok'});assert.deepEqual(await listActivity(api),[]);
 await assert.rejects(()=>saveActivitySettings(api,{...DEFAULT_ACTIVITY_SETTINGS,maxEntries:5001}));
});
test('cleanup schedules an expiry alarm even while Spotlight is closed',async()=>{
 const {cleanupActivity,registerActivityCleanup}=await import('../extension/activity-store.js');
 const api=browser();const scheduled=[];let onAlarm;
 api.alarms={create:async(...args)=>scheduled.push(args),clear:async()=>{},onAlarm:{addListener:fn=>{onAlarm=fn;}}};
 api.runtime={onStartup:{addListener:()=>{}}};
 await recordActivity(api,{action:'command',label:'Open extensions',status:'ok'});
 assert.equal(scheduled[0][0],'spotlight-history-cleanup');assert.ok(scheduled[0][1].when>Date.now());
 registerActivityCleanup(api);await onAlarm({name:'spotlight-history-cleanup'});
 assert.equal((await cleanupActivity(api)).length,1);
});
