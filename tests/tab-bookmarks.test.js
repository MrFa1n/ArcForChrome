import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookmarkFolders,changeBookmarks} from '../extension/tab-bookmarks.js';
function browser(){const calls=[];const children=[{id:'b1',parentId:'work',title:'Alpha',url:'https://alpha.example/'},{id:'b2',parentId:'other',title:'Alpha copy',url:'https://alpha.example/'}];return {calls,tabs:{get:async id=>({id,windowId:id===9?9:2,title:id===1?'Alpha':'Beta',url:id===1?'https://alpha.example/':'https://beta.example/'})},bookmarks:{getTree:async()=>[{id:'0',title:'',children:[{id:'bar',parentId:'0',title:'Bookmarks bar',children:[{id:'work',parentId:'bar',title:'Work',children:[children[0]]}]},{id:'other',parentId:'0',title:'Other bookmarks',children:[children[1]]},{id:'managed',parentId:'0',title:'Company',unmodifiable:'managed',children:[]}]}],getChildren:async id=>children.filter(child=>child.parentId===id),create:async value=>{calls.push(['create',value]);return {id:'new'};},remove:async id=>calls.push(['remove',id])}};}
test('folder picker shows full paths and excludes root/managed destinations',async()=>{
 const rows=await bookmarkFolders(browser(),2,'work','add',[1]);
 assert.deepEqual(rows.map(row=>[row.folderId,row.title]),[['work','Bookmarks bar / Work']]);
});
test('saving selected tabs only creates missing URLs in the chosen folder',async()=>{
 const api=browser();const result=await changeBookmarks(api,2,{operation:'add',tabIds:[1,2],folderId:'work'});
 assert.deepEqual(api.calls,[['create',{parentId:'work',title:'Beta',url:'https://beta.example/'}]]);
 assert.equal(result.changed,1);assert.equal(result.skipped,1);
});
test('removal is limited to matching URLs directly inside the selected folder',async()=>{
 const api=browser();await changeBookmarks(api,2,{operation:'remove',tabIds:[1],folderId:'work'});
 assert.deepEqual(api.calls,[['remove','b1']]);
 const rows=await bookmarkFolders(browser(),2,'','remove',[1]);
 assert.deepEqual(rows.map(row=>row.folderId),['work','other']);
});
test('invalid selection, foreign tabs and protected folders fail before writes',async()=>{
 const api=browser();
 for(const message of [{operation:'add',tabIds:[1,9],folderId:'work'},{operation:'add',tabIds:[],folderId:'work'},
  {operation:'add',tabIds:[1,1],folderId:'work'},{operation:'add',tabIds:[1],folderId:'0'},
  {operation:'remove',tabIds:[1],folderId:'managed'},{operation:'add',tabIds:[1],folderId:'b1'},{operation:'unknown',tabIds:[1],folderId:'work'}])await assert.rejects(()=>changeBookmarks(api,2,message));
 assert.deepEqual(api.calls,[]);
});
test('partial browser failure reports progress without deleting successful additions',async()=>{
 const api=browser();api.bookmarks.getChildren=async()=>[];
 api.bookmarks.create=async value=>{api.calls.push(['create',value]);if(api.calls.length===2)throw Error('Quota');return {id:'new'};};
 await assert.rejects(()=>changeBookmarks(api,2,{operation:'add',tabIds:[1,2],folderId:'work'}),/1 of 2/);
 assert.ok(api.calls.every(call=>call[0]==='create'));
});

test('concurrent extension saves serialize and do not create a second copy',async()=>{
 const api=browser();const stored=[];api.bookmarks.getChildren=async()=>stored.slice();
 api.bookmarks.create=async value=>{stored.push({id:'saved',...value});api.calls.push(['create',value]);};
 const request={operation:'add',tabIds:[2],folderId:'work'};
 const results=await Promise.all([changeBookmarks(api,2,request),changeBookmarks(api,2,request)]);
 assert.equal(api.calls.length,1);assert.equal(results[1].skipped,1);
});
