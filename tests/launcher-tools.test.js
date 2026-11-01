import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from '../extension/calculator.js';
import {quicklinks,changeQuicklink} from '../extension/quicklinks.js';

test('calculator handles precedence, parentheses, unary signs and powers without executing code',()=>{
  for(const [expression,result] of [['1250 * 0.18','225'],['(12 + 3) / 5','3'],['2^3^2','512'],['-2^2','-4'],['2^-2','0.25'],['0.1+0.2','0.3'],['20 % 6','2'],['2 × 5 − 3','7']])assert.equal(calculate(expression)?.result,result,expression);
  for(const expression of ['example.com','1/0','2+','alert(1)','2**3','2(3)','9'.repeat(300),'2^9999','1 + Infinity','2026-11-02'])assert.equal(calculate(expression),null,expression);
});
function browser(){const values={};return {values,storage:{local:{get:async()=>({...values}),set:async data=>Object.assign(values,data),remove:async key=>{delete values[key];}}}};}
test('quicklinks save, search, update by id and remove only their own entry',async()=>{
  const api=browser();api.values.unrelated={secret:'untouched'};
  const saved=await changeQuicklink(api,{operation:'save',name:'Work project',url:'https://example.com/project'});
  assert.equal((await quicklinks(api,'work'))[0].url,'https://example.com/project');
  await changeQuicklink(api,{operation:'save',id:saved.id,name:'Renamed',url:'https://example.com/new'});
  assert.equal((await quicklinks(api,'renamed')).length,1);
  await changeQuicklink(api,{operation:'remove',id:saved.id});
  assert.deepEqual(await quicklinks(api,''),[]);assert.deepEqual(api.values.unrelated,{secret:'untouched'});
});
test('quicklinks reject unsafe URLs, empty names, foreign ids and writes beyond the limit',async()=>{
  const api=browser();
  for(const url of ['javascript:alert(1)','file:///tmp/a','https://u:p@example.com','chrome://quit/'])await assert.rejects(()=>changeQuicklink(api,{operation:'save',name:'Bad',url}));
  await assert.rejects(()=>changeQuicklink(api,{operation:'save',name:' ',url:'https://example.com'}));
  await assert.rejects(()=>changeQuicklink(api,{operation:'remove',id:'unrelated'}));
  for(let i=0;i<100;i++)await changeQuicklink(api,{operation:'save',name:`Link ${i}`,url:`https://example.com/${i}`});
  await assert.rejects(()=>changeQuicklink(api,{operation:'save',name:'Overflow',url:'https://example.com/overflow'}),/100/);
  assert.equal((await quicklinks(api,'')).length,100);
});
