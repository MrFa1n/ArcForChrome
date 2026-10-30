import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mountPalette } from '../extension/palette.js';
import {inferSites} from '../extension/site-discovery.js';
const DISCOVERED_SITES=inferSites([{title:'cats - YouTube',url:'https://www.youtube.com/results?search_query=cats'},{title:'GitHub',url:'https://github.com/search?q=old'}]);
import { commandSuggestions } from '../extension/command-catalog.js';

const profile = await mkdtemp(join(tmpdir(), 'arc-keyboard-'));
const binary = process.env.CHROME_BINARY || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const processChrome = spawn(binary, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank']);
let socket;
let server;
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
  async function key(key,code,text,modifiers=0) {
    await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers,...(text ? {text} : {})});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers});
    if(key==='Enter') await evaluate('new Promise(resolve=>setTimeout(resolve,450))');
  }
  async function mount(tabs,context={}) {
    await evaluate(`globalThis.mockTabs=${JSON.stringify(tabs)};(${mountPalette.toString()})(${JSON.stringify(tabs)},false,${JSON.stringify(context)})`);
  }
  await evaluate(`document.body.innerHTML='<input id="page-input"><video></video>';document.querySelector('input').focus();
    globalThis.pageKeys=[];globalThis.messages=[];
    for(const type of ['keydown','keypress','keyup']) window.addEventListener(type,event=>pageKeys.push(type+':'+event.key),true);
    globalThis.chrome={runtime:{sendMessage:async message=>{if(message.type==='palette:suggest')return {ok:true,suggestions:(mockTabs||[]).filter(tab=>(tab.title+' '+tab.url).toLowerCase().includes(message.query.toLowerCase())).map(tab=>({...tab,kind:'tab',sources:['tab']})),warnings:[]};messages.push(message);return {ok:true};}}};`);
  await mount([{id:1,title:'Video',url:'https://video.example'}]);
  async function paletteCall(functionDeclaration,args=[]) {
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
    const result=await send('Runtime.callFunctionOn',{objectId:object.objectId,returnByValue:true,awaitPromise:true,functionDeclaration,arguments:args.map(value=>({value}))});
    if(result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function paletteStyles(rootSize) {
    return paletteCall(`function(rootSize) {
      if(rootSize)this.ownerDocument.documentElement.style.fontSize=rootSize;
      const probe=this.ownerDocument.createElement('span');
      probe.style.cssText='background:Canvas;color:CanvasText;color-scheme:light dark';this.append(probe);
      const view=this.ownerDocument.defaultView;
      const theme={background:view.getComputedStyle(this).backgroundColor,color:view.getComputedStyle(this).color,
        canvas:view.getComputedStyle(probe).backgroundColor,canvasText:view.getComputedStyle(probe).color,
        fontSize:parseFloat(view.getComputedStyle(this).fontSize)};
      probe.remove();return theme;
    }`,[rootSize]);
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
  await mount([]);
  await key('x','KeyX','x');
  await key('Enter','Enter');
  assert.deepEqual(await evaluate('messages'),[{type:'palette:navigate',query:'x'}],'typing and Enter must still work');
  assert.deepEqual(await evaluate('pageKeys'),[]);
  await mount([{id:7,title:'Existing',url:'https://existing.example'}]);
  await key('ArrowDown','ArrowDown');
  await key('Enter','Enter');
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:activate',tabId:7});
  assert.deepEqual(await evaluate('pageKeys'),[],'selection keyup must not leak to the page');
  await mount([]);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'k',code:'KeyK',text:'k'});
  await mount([]);
  assert.equal(await evaluate("!!document.querySelector('[data-arc-command-palette]')"),true,'dismissal waits for held keys');
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'k',code:'KeyK'});
  assert.equal(await evaluate("!!document.querySelector('[data-arc-command-palette]')"),false);
  assert.deepEqual(await evaluate('pageKeys'),[],'toggle dismissal must contain final keyup');
  await evaluate(`globalThis.chrome.runtime.sendMessage=async message=>{
    if(message.type!=='palette:suggest'){messages.push(message);return {ok:true};}
    await new Promise(resolve=>setTimeout(resolve,message.query==='a'?400:10));
    return {ok:true,suggestions:message.query?[{kind:'bookmark',sources:['bookmark'],title:message.query+' saved',url:'https://saved.example/'+message.query}]:[],warnings:[]};
  }`);
  await mount([]);
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
  await mount([]);
  await key('g','KeyG','g');
  await evaluate('new Promise(resolve=>setTimeout(resolve,220))');
  const beforeCompletion = await evaluate('messages.length');
  await key('Tab','Tab');
  assert.equal(await evaluate('messages.length'),beforeCompletion,'Tab must not navigate');
  await key('Enter','Enter');
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:navigate',query:'https://github.com/'},
    'Tab must complete the selected homepage, and Enter must open just the domain');
  await mount([]);
  await key('g','KeyG','g');
  await evaluate('new Promise(resolve=>setTimeout(resolve,220))');
  await key('ArrowDown','ArrowDown');
  await key('Tab','Tab');
  await key('Enter','Enter');
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:navigate',query:'https://github.com/org/project'},
    'Tab must also complete the full saved page URL');
  assert.deepEqual(await evaluate('pageKeys'),[],'completion and homepage selection must stay isolated');
  await evaluate(`globalThis.commandRows=${JSON.stringify(commandSuggestions(''))};globalThis.chrome.runtime.sendMessage=async message=>{
    if(message.type!=='palette:suggest'){messages.push(message);return {ok:true};}
    if(message.mode==='commands')return {ok:true,suggestions:commandRows.filter(row=>row.title.toLowerCase().includes(message.query.toLowerCase())),warnings:[]};
    if(message.mode==='closed')return {ok:true,suggestions:[{kind:'closed',sessionId:'closed-7',title:'Closed page',url:'https://closed.example'}],warnings:[]};
    return {ok:true,suggestions:(mockTabs||[]).filter(tab=>(tab.title+' '+tab.url).toLowerCase().includes(message.query.toLowerCase())).map(tab=>({...tab,kind:'tab',sources:['tab']})),warnings:[]};
  }`);
  const context={sites:DISCOVERED_SITES,sourceUrl:'https://current.example/page'};
  await mount([],context);
  await key('Tab','Tab');
  await send('Input.insertText',{text:'reload'});
  await key('Enter','Enter');
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:command',command:'reload'},'empty Tab enters explicit commands');
  await mount([],context);
  await send('Input.insertText',{text:'yt'});await key('Tab','Tab');
  await send('Input.insertText',{text:'cats & dogs'});await key('Enter','Enter');
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:site',site:'auto:https://www.youtube.com',query:'cats & dogs'},'keyword Tab scopes an automatically discovered site');
  await mount([],{...context,mode:'edit'});
  await send('Input.insertText',{text:'new.example'});await key('Enter','Enter');
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:navigate',query:'new.example',target:'current'},'edit mode replaces only source tab');
  await mount([],context);await send('Input.insertText',{text:'background.example'});await key('Enter','Enter',undefined,8);
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:navigate',query:'background.example',target:'background'},'Shift+Enter opens in background');
  await mount([],context);await send('Input.insertText',{text:'replace.example'});await key('Enter','Enter',undefined,1);
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:navigate',query:'replace.example',target:'current'},'Alt+Enter explicitly replaces current page');
  await mount([],context);
  await paletteCall(`function(){const select=this.querySelector('select');select.value='closed';select.dispatchEvent(new Event('change'));}`);
  await key('Enter','Enter');
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:restore',sessionId:'closed-7'},'closed mode restores session');
  assert.deepEqual(await evaluate('pageKeys'),[],'all command-bar modes must isolate keyboard events');
  await evaluate(`globalThis.chrome.runtime.sendMessage=async message=>{
    if(message.type!=='palette:suggest'){messages.push(message);return {ok:true};}
    await new Promise(resolve=>setTimeout(resolve,200));
    return {ok:true,suggestions:message.query==='fast'?[{kind:'bookmark',title:'Fast destination',url:'https://fast.example/'}]:[],warnings:[]};
  }`);
  await mount([],context);await send('Input.insertText',{text:'fast'});await key('Enter','Enter');
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:navigate',query:'https://fast.example/'},'early Enter must wait for final suggestions, not provisional raw navigation');
  await mount([],context);await send('Input.insertText',{text:'reload'});await key('Enter','Enter');
  assert.deepEqual((await evaluate('messages')).at(-1),{type:'palette:navigate',query:'reload'},'ordinary searches must not execute commands');
  // Optional documentation demo: real palette DOM, fictional tabs, disposable profile.
  if (process.env.PALETTE_SCREENSHOT_DIR) {
    await key('Escape','Escape');
    await send('Emulation.setDeviceMetricsOverride',{width:1120,height:720,deviceScaleFactor:1,mobile:false});
    await evaluate(`document.body.innerHTML='<main><small>DEMO WORKSPACE</small><h1>A little more focus.</h1><p>Your page stays right here while you find your next destination.</p><section><article>Reading list<br><span>Ideas worth coming back to</span></article><article>Current project<br><span>One good thing at a time</span></article></section></main>';document.body.style.cssText='margin:0;background:#edf1f7;color:#243048;font:16px system-ui';const style=document.createElement('style');style.textContent='main{max-width:900px;margin:80px auto}small{letter-spacing:.18em;color:#687892}h1{font-size:48px;letter-spacing:-2px;margin:18px 0}p{color:#687892}section{display:flex;gap:20px;margin-top:60px}article{background:#ffffffaa;border:1px solid #dbe2ed;border-radius:18px;padding:28px;width:40%;font-weight:600}article span{display:block;color:#7b879b;font-size:14px;font-weight:400;margin-top:12px}';document.head.append(style);
      globalThis.chrome.runtime.sendMessage=async message=>{if(message.type!=='palette:suggest')return {ok:true};if(message.mode==='commands')return {ok:true,suggestions:commandRows,warnings:[]};return {ok:true,suggestions:(mockTabs||[]).filter(tab=>(tab.title+' '+tab.url).toLowerCase().includes(message.query.toLowerCase())).map(tab=>({...tab,kind:'tab',sources:['tab']})),warnings:[]};};`);
    const demoTabs=[{id:101,title:'GitHub · Arc for Chrome',url:'https://github.com/example/arc-for-chrome'},{id:102,title:'Chrome Extensions · Documentation',url:'https://developer.chrome.com/docs/extensions'},{id:103,title:'YouTube · Design inspiration',url:'https://www.youtube.com/'}];
    await mount(demoTabs,context);
    await screenshot('demo-01');
    await send('Input.insertText',{text:'github'});
    await evaluate('new Promise(resolve=>setTimeout(resolve,300))');
    await screenshot('demo-02');
    await key('Escape','Escape');await mount([],context);
    await send('Input.insertText',{text:'yt'});await key('Tab','Tab');
    await send('Input.insertText',{text:'minimal interface design'});
    await evaluate('new Promise(resolve=>setTimeout(resolve,300))');
    await screenshot('demo-03');
    await key('Escape','Escape');await key('Escape','Escape');
    await mount(demoTabs,context);await key('Tab','Tab');
    await evaluate('new Promise(resolve=>setTimeout(resolve,300))');
    await screenshot('demo-04');
    await key('Escape','Escape');await key('Escape','Escape');
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
    await mount(demoTabs,context);await screenshot('demo-dark');
    await key('Escape','Escape');
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
  }
  // Serve the actual settings files; only Chrome APIs are stubbed, not form logic.
  const allowed=new Set(['options.html','options.js','options.css','site-search.js','site-discovery.js','icons/icon-32.png','icons/icon-48.png']);
  server=createServer(async(request,response)=>{
    const path=new URL(request.url,'http://localhost').pathname.slice(1);
    if(!allowed.has(path)){response.writeHead(404);response.end();return;}
    try {
      const content=await readFile(new URL(`../extension/${path}`,import.meta.url));
      const type=path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'text/html';
      response.writeHead(200,{'Content-Type':type});response.end(content);
    } catch {response.writeHead(500);response.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`globalThis.chrome={storage:{local:{get:async()=>({}),set:async value=>{globalThis.savedSites=value.sites;}}},tabs:{create:async()=>{}}};`});
  await send('Page.enable');
  const loaded=new Promise(resolve=>{
    const listener=event=>{if(JSON.parse(event.data).method==='Page.loadEventFired'){socket.removeEventListener('message',listener);resolve();}};
    socket.addEventListener('message',listener);
  });
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/options.html`});await loaded;
  assert.equal(await evaluate("document.querySelectorAll('.site').length"),0,'manual setup is optional and starts empty');
  await evaluate("document.querySelector('#add').click()");
  await evaluate(`const row=document.querySelector('.site');row.querySelector('[name=name]').value='My docs';row.querySelector('[name=key]').value='docs';row.querySelector('[name=template]').value='https://docs.example/?q=%s';document.querySelector('[type=submit]').click();`);
  await evaluate('new Promise(resolve=>setTimeout(resolve,20))');
  assert.deepEqual((await evaluate('savedSites'))[0],{key:'docs',name:'My docs',template:'https://docs.example/?q=%s'});
  await evaluate(`document.querySelector('[name=template]').value='javascript:%s';document.querySelector('[type=submit]').click();`);
  await evaluate('new Promise(resolve=>setTimeout(resolve,20))');
  assert.match(await evaluate("document.querySelector('#status').textContent"),/HTTP/,'settings reject unsafe templates');
  await send('Emulation.setDeviceMetricsOverride',{width:900,height:1100,deviceScaleFactor:1,mobile:false});
  await screenshot('options');
  console.log('PASS: real Chrome capture listeners isolated; text, Space, arrows, Escape, Enter focus restoration, suggestion selection, stale replies, Tab completion, homepage navigation, live theme changes and font scaling, command mode, site search, URL editing, modifiers session restoration and real settings-form validation verified.');
} finally {
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  socket?.close();
  if (processChrome.exitCode === null && processChrome.signalCode === null) {
    const exited = new Promise(resolve => processChrome.once('exit',resolve));
    processChrome.kill();await exited;
  }
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
