import {test} from 'node:test';
import assert from 'node:assert/strict';
import {destination} from '../extension/model.js';
test('web addresses and local development ports open directly',()=>{
  assert.deepEqual(destination('example.com'),{type:'url',url:'https://example.com/'});
  assert.deepEqual(destination('localhost:3000'),{type:'url',url:'https://localhost:3000/'});
});
test('queries and unsafe schemes use the default provider rather than a fixed Google URL',()=>{
  for(const text of ['hello world','javascript:alert(1)','file:///tmp/test']) assert.deepEqual(destination(text),{type:'search',text});
});
test('empty input does not navigate',()=>assert.equal(destination('  '),null));
