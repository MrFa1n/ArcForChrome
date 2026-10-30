import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inferSites} from '../extension/site-discovery.js';
import {loadSites} from '../extension/site-search.js';
test('observed search URLs supply site templates and brand initials without a hand-written preset',()=>{
  const sites=inferSites([{title:'cats - YouTube',url:'https://www.youtube.com/results?search_query=cats&sp=videos'},
    {title:'GitHub',url:'https://github.com/search?q=widget'}]);
  assert.ok(sites[0].aliases.includes('yt'));assert.ok(sites[1].aliases.includes('gh'));
  assert.equal(sites[0].template,'https://www.youtube.com/results?search_query=%s&sp=videos');
});
test('ordinary domain URLs do not invent a search endpoint; credentials/tokens are never reused',()=>{
  assert.deepEqual(inferSites([{url:'https://example.com/page'},{url:'https://u:p@example.com/search?q=x'},
    {url:'https://example.com/search?q=x&token=secret'},{url:'javascript:search?q=x'}]),[]);
});
test('discovery deduplicates origins and removes fragments and tracking/pagination',()=>{
  const sites=inferSites([{title:'Docs',url:'https://docs.example.com/search?q=old&utm_source=x&page=3#part'},
    {title:'Docs',url:'https://docs.example.com/search?q=older'}]);
  assert.equal(sites.length,1);assert.equal(sites[0].template,'https://docs.example.com/search?q=%s');
});
test('saved aliases adapt discovery and manual definitions remain optional overrides',async()=>{
  const api={storage:{local:{get:async()=>({'siteAlias:work':'auto:https://docs.example.com'})}},
    tabs:{query:async()=>[{title:'Docs',url:'https://docs.example.com/search?q=work'}]},bookmarks:{getRecent:async()=>[]},history:{search:async()=>[]}};
  const sites=await loadSites(api,2);
  assert.ok(sites[0].aliases.includes('work'));
});
test('learned shortcuts store only an explicit association with a currently known site',async()=>{
  const {rememberSite}=await import('../extension/site-search.js');
  const writes=[];
  const api={storage:{local:{get:async()=>({}),set:async value=>writes.push(value)}},tabs:{query:async()=>[{title:'Docs',url:'https://docs.example.com/search?q=old'}]},bookmarks:{getRecent:async()=>[]},history:{search:async()=>[]}};
  await rememberSite(api,2,'auto:https://docs.example.com','work');
  assert.deepEqual(writes,[{'siteAlias:work':'auto:https://docs.example.com'}]);
  await assert.rejects(()=>rememberSite(api,2,'auto:https://unknown.example','work'));
});
