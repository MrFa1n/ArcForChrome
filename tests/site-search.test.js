import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SITES,parseSites,siteDestination} from '../extension/site-search.js';
test('site queries are encoded without changing the destination host',()=>{
  assert.equal(siteDestination(DEFAULT_SITES,'yt','cats & dogs'),'https://www.youtube.com/results?search_query=cats%20%26%20dogs');
});
test('custom site templates reject unsafe schemes, duplicate keywords and ambiguous placeholders',()=>{
  const site={key:'docs',name:'Docs',template:'https://example.com/?q=%s'};
  assert.deepEqual(parseSites([site]),[site]);
  for(const template of ['javascript:%s','https://user:pass@example.com/%s','https://example.com/','https://example.com/%s/%s']) assert.throws(()=>parseSites([{...site,template}]));
  assert.throws(()=>parseSites([site,site]));
  assert.throws(()=>siteDestination(DEFAULT_SITES,'unknown','x'));
});
