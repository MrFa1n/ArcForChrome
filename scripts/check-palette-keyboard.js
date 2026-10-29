import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mountPalette } from '../extension/palette.js';

const profile = await mkdtemp(join(tmpdir(), 'arc-keyboard-'));
const binary = process.env.CHROME_BINARY || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const processChrome = spawn(binary, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank']);
let socket;
try {
  const endpoint = await new Promise((resolve,reject) => {
    const timeout = setTimeout(() => reject(new Error('Chrome startup timed out')), 15000);
    let output = '';
    processChrome.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {clearTimeout(timeout);resolve(match[1]);}
    });
    processChrome.once('error', error => {clearTimeout(timeout);reject(error);});
    processChrome.once('exit', code => {clearTimeout(timeout);reject(new Error(`Chrome exited: ${code}`));});
  });
  const port = new URL(endpoint).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve,reject) => { socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true}); });
  let serial = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  function send(method,params={}) {
    return new Promise((resolve,reject) => { const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params})); });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function key(key,code,text) {
    await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,...(text ? {text} : {})});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key,code});
  }
  await evaluate(`document.body.innerHTML='<input id="page-input"><video></video>';document.querySelector('input').focus();
    globalThis.pageKeys=[];globalThis.messages=[];
    for(const type of ['keydown','keypress','keyup']) window.addEventListener(type,event=>pageKeys.push(type+':'+event.key),true);
    globalThis.chrome={runtime:{sendMessage:async message=>{messages.push(message);return {ok:true};}}};`);
  await evaluate(`(${mountPalette.toString()})([{id:1,title:'Video',url:'https://video.example'}])`);
  await key('f','KeyF','f');
  await key(' ','Space',' ');
  await key('ArrowDown','ArrowDown');
  assert.deepEqual(await evaluate('pageKeys'), [], 'page capture listeners must not receive palette keys');
  await key('Escape','Escape');
  assert.equal(await evaluate("document.querySelector('[data-arc-command-palette]') === null"),true);
  assert.equal(await evaluate("document.activeElement.id"),'page-input','page focus should be restored');
  await key('k','KeyK','k');
  assert.ok((await evaluate('pageKeys')).includes('keydown:k'),'page shortcuts should resume after close');
  await evaluate('pageKeys=[]');
  await evaluate(`(${mountPalette.toString()})([])`);
  await key('x','KeyX','x');
  await key('Enter','Enter');
  assert.deepEqual(await evaluate('messages'),[{type:'palette:navigate',query:'x'}],'typing and Enter must still work');
  assert.deepEqual(await evaluate('pageKeys'),[]);
  await evaluate(`(${mountPalette.toString()})([{id:7,title:'Existing',url:'https://existing.example'}])`);
  await key('ArrowDown','ArrowDown');
  await key('Enter','Enter');
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:activate',tabId:7});
  assert.deepEqual(await evaluate('pageKeys'),[],'selection keyup must not leak to the page');
  await evaluate(`(${mountPalette.toString()})([])`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'k',code:'KeyK',text:'k'});
  await evaluate(`(${mountPalette.toString()})([])`);
  assert.equal(await evaluate("!!document.querySelector('[data-arc-command-palette]')"),true,'dismissal waits for held keys');
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'k',code:'KeyK'});
  assert.equal(await evaluate("!!document.querySelector('[data-arc-command-palette]')"),false);
  assert.deepEqual(await evaluate('pageKeys'),[],'toggle dismissal must contain final keyup');
  console.log('PASS: real Chrome capture listeners isolated; text, Space, arrows, Escape, Enter and focus restoration verified.');
} finally {
  socket?.close();
  if (processChrome.exitCode === null && processChrome.signalCode === null) {
    const exited = new Promise(resolve => processChrome.once('exit',resolve));
    processChrome.kill();await exited;
  }
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
