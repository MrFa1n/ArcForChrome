import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
    globalThis.chrome={runtime:{sendMessage:async message=>{if(message.type==='palette:suggest')return {ok:true,suggestions:[],warnings:[]};messages.push(message);return {ok:true};}}};`);
  await evaluate(`(${mountPalette.toString()})([{id:1,title:'Video',url:'https://video.example'}])`);
  async function paletteStyles(rootSize) {
    const tree = await send('DOM.getDocument',{depth:-1,pierce:true});
    function find(node) {
      if (node.nodeName === 'DIALOG' && node.attributes?.includes('Search tabs or the web')) return node;
      for (const child of [...(node.children || []),...(node.shadowRoots || []),...(node.contentDocument ? [node.contentDocument] : [])]) {
        const match = find(child); if (match) return match;
      }
    }
    const node = find(tree.root);
    assert.ok(node,'search dialog should exist in its frame');
    const {object} = await send('DOM.resolveNode',{backendNodeId:node.backendNodeId});
    const result = await send('Runtime.callFunctionOn',{objectId:object.objectId,returnByValue:true,
      functionDeclaration:`function(rootSize) {
        if(rootSize)this.ownerDocument.documentElement.style.fontSize=rootSize;
        const probe=this.ownerDocument.createElement('span');
        probe.style.cssText='background:Canvas;color:CanvasText;color-scheme:light dark';this.append(probe);
        const view=this.ownerDocument.defaultView;
        const theme={background:view.getComputedStyle(this).backgroundColor,color:view.getComputedStyle(this).color,
          canvas:view.getComputedStyle(probe).backgroundColor,canvasText:view.getComputedStyle(probe).color,
          fontSize:parseFloat(view.getComputedStyle(this).fontSize)};
        probe.remove();return theme;
      }`,arguments:[{value:rootSize}]});
    return result.result.value;
  }
  async function screenshot(name) {
    if (!process.env.PALETTE_SCREENSHOT_DIR) return;
    const {data}=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(process.env.PALETTE_SCREENSHOT_DIR,`arc-spotlight-${name}.png`),Buffer.from(data,'base64'));
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
  const light=await paletteStyles();
  assert.equal(light.background,light.canvas,'palette should use native browser Canvas color');
  assert.equal(light.color,light.canvasText);
  await screenshot('light');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
  const dark=await paletteStyles();
  assert.equal(dark.background,dark.canvas);assert.notEqual(dark.background,light.background,'open palette should react to theme changes');
  await screenshot('dark');
  const larger=await paletteStyles('24px');
  assert.ok(larger.fontSize>dark.fontSize*1.4,'browser base-font changes should scale search text');
  await paletteStyles('medium');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
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
  await evaluate(`globalThis.chrome.runtime.sendMessage=async message=>{
    if(message.type!=='palette:suggest'){messages.push(message);return {ok:true};}
    await new Promise(resolve=>setTimeout(resolve,message.query==='a'?400:10));
    return {ok:true,suggestions:message.query?[{kind:'bookmark',sources:['bookmark'],title:message.query+' saved',url:'https://saved.example/'+message.query}]:[],warnings:[]};
  }`);
  await evaluate(`(${mountPalette.toString()})([])`);
  await key('a','KeyA','a');
  await evaluate('new Promise(resolve=>setTimeout(resolve,180))');
  await key('b','KeyB','b');
  await evaluate('new Promise(resolve=>setTimeout(resolve,220))');
  await evaluate('new Promise(resolve=>setTimeout(resolve,250))');
  await key('Enter','Enter');
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:navigate',query:'https://saved.example/ab'},
    'Enter must open the first suggestion URL; stale responses must not replace new results');
  assert.deepEqual(await evaluate('pageKeys'),[],'suggestion interactions stay isolated');
  await evaluate(`globalThis.chrome.runtime.sendMessage=async message=>{
    if(message.type!=='palette:suggest'){messages.push(message);return {ok:true};}
    return {ok:true,suggestions:[{kind:'bookmark',sources:['bookmark'],title:'Project',url:'https://github.com/org/project'}],
      domains:[{kind:'domain',sources:['domain'],title:'Open github.com',url:'https://github.com/'}],warnings:[]};
  }`);
  await evaluate(`(${mountPalette.toString()})([])`);
  await key('g','KeyG','g');
  await evaluate('new Promise(resolve=>setTimeout(resolve,220))');
  const beforeCompletion = await evaluate('messages.length');
  await key('Tab','Tab');
  assert.equal(await evaluate('messages.length'),beforeCompletion,'Tab must not navigate');
  await key('Enter','Enter');
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:navigate',query:'https://github.com/'},
    'Tab must complete the selected homepage, and Enter must open just the domain');
  await evaluate(`(${mountPalette.toString()})([])`);
  await key('g','KeyG','g');
  await evaluate('new Promise(resolve=>setTimeout(resolve,220))');
  await key('ArrowDown','ArrowDown');
  await key('Tab','Tab');
  await key('Enter','Enter');
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:navigate',query:'https://github.com/org/project'},
    'Tab must also complete the full saved page URL');
  assert.deepEqual(await evaluate('pageKeys'),[],'completion and homepage selection must stay isolated');
  console.log('PASS: real Chrome capture listeners isolated; text, Space, arrows, Escape, Enter focus restoration, suggestion selection, stale replies, Tab completion, homepage navigation, live theme changes and font scaling verified.');
} finally {
  socket?.close();
  if (processChrome.exitCode === null && processChrome.signalCode === null) {
    const exited = new Promise(resolve => processChrome.once('exit',resolve));
    processChrome.kill();await exited;
  }
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
