import {test} from 'node:test';
import assert from 'node:assert/strict';
import {faviconImages} from '../extension/favicons.js';
test('favicons only read the extension-local Chrome endpoint and share a bounded cache',async()=>{
  const calls=[];const api={runtime:{getURL:path=>`chrome-extension://test/${path}`}};
  const fetcher=async url=>{calls.push(url);return {ok:true,headers:{get:()=> 'image/png'},arrayBuffer:async()=>new Uint8Array([137,80,78,71]).buffer};};
  const result=await faviconImages(api,['https://example.com/private?q=secret','https://example.com/other','javascript:alert(1)','https://u:p@example.com/'],fetcher);
  assert.deepEqual(result.slice(0,2),['data:image/png;base64,iVBORw==','data:image/png;base64,iVBORw==']);
  assert.equal(result[2],null);assert.equal(result[3],null);assert.equal(calls.length,1);
  const url=new URL(calls[0]);assert.equal(url.protocol,'chrome-extension:');assert.equal(url.searchParams.get('pageUrl'),'https://example.com/');
  assert.ok(!calls[0].includes('secret'));
  await assert.rejects(()=>faviconImages(api,Array(21).fill('https://example.com/'),fetcher));
});
test('favicon failures and oversized or non-image responses leave generic icons',async()=>{
  const api={runtime:{getURL:path=>`chrome-extension://failure/${path}`}};
  assert.deepEqual(await faviconImages(api,['https://a.example'],async()=>{throw Error('Offline');}),[null]);
  assert.deepEqual(await faviconImages(api,['https://b.example'],async()=>({ok:true,headers:{get:()=> 'text/html'}})),[null]);
  assert.deepEqual(await faviconImages(api,['https://c.example'],async()=>({ok:true,headers:{get:()=> 'image/png'},arrayBuffer:async()=>new ArrayBuffer(65537)})),[null]);
});
