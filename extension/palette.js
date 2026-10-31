// Self-contained: Chrome serializes this function for isolated-world injection.
export function mountPalette(tabs, floating = false, context = {}) {
  const existing = document.querySelector('[data-arc-command-palette]');
  if (existing) {
    existing.dispatchEvent(context.mode === 'edit'
      ? new CustomEvent('arc-palette-edit',{detail:context.sourceUrl || ''}) : new Event('arc-palette-close'));
    return;
  }
  const previousFocus = document.activeElement;
  const host = document.createElement('div');
  host.setAttribute('data-arc-command-palette', '');
  const root = host.attachShadow({ mode: 'closed' });
  const shell = document.createElement('dialog');
  shell.setAttribute('aria-label', 'Arc command bar');
  shell.style.cssText = 'border:0;padding:0;margin:0;width:100vw;height:100vh;max-width:none;max-height:none;background:transparent;overflow:hidden;';
  const frame = document.createElement('iframe');
  frame.title = 'Arc search';
  frame.style.cssText = 'display:block;border:0;width:100%;height:100%;background:transparent;';
  shell.append(frame); root.append(shell); document.documentElement.append(host);
  let requestClose = () => {};
  let editCurrent = () => {};
  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    shell.close(); host.remove();
    if (floating) window.close(); else if (previousFocus?.isConnected) previousFocus.focus();
  }
  host.addEventListener('arc-palette-close', () => requestClose());
  host.addEventListener('arc-palette-edit',event => editCurrent(event.detail));
  shell.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
  shell.showModal();
  // Frame events never traverse the page's window/document capture listeners.
  // Keep the final keyup in the frame before returning focus to the page.
  function showPalette(document) {
    // Keep Chrome's default font preferences rather than inheriting the website's typography.
    document.documentElement.style.cssText = 'color-scheme:light dark;font-size:medium;font-family:sans-serif';
    document.documentElement.lang = navigator.language;
    const host = document.createElement('div');
    host.setAttribute('data-arc-command-palette', '');
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host{all:initial;color-scheme:light dark}*{box-sizing:border-box}
      dialog{--bg:Canvas;--fg:CanvasText;--muted:GrayText;
      --hover:color-mix(in srgb,Highlight 12%,Canvas);--line:color-mix(in srgb,CanvasText 18%,Canvas);
      color-scheme:light dark;border:1px solid var(--line);border-radius:16px;padding:0;width:min(620px,calc(100vw - 32px));
      max-height:80vh;margin:12vh auto 0;background:var(--bg);color:var(--fg);box-shadow:0 12px 40px #0004;
      font:.875rem/1.5 sans-serif;overflow:hidden}
      dialog::backdrop{background:#0005;backdrop-filter:blur(4px)}
      input{font:inherit;font-size:1.3125rem;width:100%;padding:18px 22px;border:0;outline:none;color:var(--fg);background:transparent}
      #results{padding:6px 10px;max-height:48vh;overflow:auto;border-top:1px solid var(--line)}
      button{font:inherit;color:inherit;cursor:pointer}button.result{display:flex;align-items:center;gap:12px;width:100%;border:0;
      border-radius:8px;background:transparent;text-align:left;padding:12px}button.result[aria-selected=true]{background:var(--hover)}
      .icon{width:28px;height:28px;border-radius:8px;background:var(--hover);display:grid;place-items:center;flex-shrink:0}
      .text{min-width:0;flex:1}.title,.url{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .url{font-size:.6875rem;color:var(--muted)}.hint{font-size:.625rem;color:var(--muted);flex-shrink:0}
      footer{padding:12px 22px;color:var(--muted);font-size:.6875rem;border-top:1px solid var(--line)}
      #error{color:#b3261e;padding:0 22px;font-size:.75rem}
      button:focus-visible{outline:2px solid Highlight;outline-offset:-2px}
      @media(prefers-color-scheme:dark){#error{color:#f2b8b5}}
      @media(prefers-contrast:more){dialog{--line:CanvasText}.url,.hint,footer{color:CanvasText}}
      @media(forced-colors:active){button.result[aria-selected=true]{background:Highlight;color:HighlightText}
        button.result[aria-selected=true] .url,button.result[aria-selected=true] .hint{color:HighlightText}}
      @media(prefers-reduced-transparency:reduce){dialog::backdrop{backdrop-filter:none}}
      `;
    root.append(style);
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', 'Search tabs or the web');
    const input = document.createElement('input');
    input.placeholder = 'Search tabs or enter a URL…';
    input.maxLength = 8192;
    input.setAttribute('aria-label','Search tabs or enter a URL');
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-controls','results');input.setAttribute('aria-expanded','true');
    const results = document.createElement('div'); results.id = 'results'; results.setAttribute('role','listbox');
    const error = document.createElement('p'); error.id = 'error'; error.setAttribute('role','status');
    const footer = document.createElement('footer');footer.textContent = '↑ ↓ select · Tab complete address · Enter open · Esc return';
    const sites = Array.isArray(context.sites) ? context.sites : [];
    footer.id='hints';input.setAttribute('aria-describedby','hints');
    dialog.append(input,results,error,footer); root.append(dialog);document.documentElement.append(host);
    let mode = context.mode === 'edit' ? 'edit' : 'search';
    let orderTabId;
    let completedAddress = null;
    let pendingQuery = Promise.resolve();
    let finishPending = () => {};
    let selected = 0;
    let selectionMoved = false;
    let choices = [];
    let busy = false;
    let queryRevision = 0;
    let timer;
    let suggestions = [];
    let domains = [];
    const labels = {tab:'Open tab',bookmark:'Bookmark',history:'History',domain:'Homepage · New tab',command:'Command',closed:'Restore session',site:'Site search','browser-page':'Chrome page'};
    const heldKeys = new Set();
    let closing = false;
    function close() {
      clearTimeout(timer);
      finishPending();
      queryRevision++;
      if (heldKeys.size) { closing = true; return; }
      dismiss();
    }
    document.addEventListener('keydown', event => heldKeys.add(event.code || event.key), true);
    document.addEventListener('keyup', event => {
      heldKeys.delete(event.code || event.key);
      if (closing && !heldKeys.size) dismiss();
    }, true);
    document.defaultView.addEventListener('blur', () => {
      heldKeys.clear();
      if (closing) dismiss();
    });
    requestClose = close;
    function siteMatches(value,exact=false) {
      const query=value.trim().toLocaleLowerCase();
      if(!/^[\p{L}\d.-]{1,32}$/u.test(query)) return [];
      return sites.map(site=>{
        const aliases=[site.key,...(site.aliases || [])].map(alias=>alias.toLocaleLowerCase());
        let score=(site.learnedAliases || []).includes(query)?120:aliases.includes(query)?100:aliases.some(alias=>alias.startsWith(query))?70:0;
        if(!score && query.length<=4) {
          const name=site.name.toLocaleLowerCase().replace(/[^\p{L}\d]/gu,'');
          let index=0;for(const char of name)if(char===query[index])index++;
          if(index===query.length)score=30;
        }
        return {site,score};
      }).filter(item=>(exact || query.length===1)?item.score>=100:item.score).sort((a,b)=>b.score-a.score).slice(0,3);
    }
    function enterSite(site,alias=input.value,value='') {
      // Remember only an explicitly chosen site association, not browsing activity or search queries.
      if(alias.trim()) chrome.runtime.sendMessage({type:'palette:remember-site',site:site.key,alias}).catch(()=>{});
      setMode(`site:${site.key}`,value);
    }
    function setMode(next,value='',tabId,preferredId) {
      orderTabId=next==='order'?tabId:undefined;
      mode=next;completedAddress=null;input.value=value;
      input.placeholder=mode==='order'?(orderTabId===undefined?'Choose a tab to move…':'Choose a position or a destination tab…'):mode==='drafts'?'Recover a recent AI prompt…':mode==='commands'?'Find a browser command…':mode==='closed'?'Find a recently closed tab…'
        :mode.startsWith('site:')?'Enter a site search query…':'Search tabs or enter a URL…';
      input.setAttribute('aria-label',input.placeholder);
      updateSuggestions(preferredId);input.focus();
      if(mode==='edit') input.select();
    }
    async function copyText(value) {
      if(navigator.clipboard?.writeText) {await navigator.clipboard.writeText(value);return;}
      const area=document.createElement('textarea');area.value=value;root.append(area);area.select();
      const copied=document.execCommand('copy');area.remove();
      if(!copied) throw new Error('Clipboard access is unavailable');
    }
    async function activate(event={}) {
      if(busy) return;
      busy=true;error.textContent='';
      const actionRevision=queryRevision;
      try {
        // Do not commit the provisional list while smart suggestions are still loading.
        await pendingQuery;
        if(dismissed || closing || actionRevision!==queryRevision) return;
        const choice=choices[selected];
        if(!choice) return;
        if(choice.kind==='order-tab') {setMode('order','',choice.tabId);return;}
        const commandMode={'order-tabs':'order','closed-tabs':'closed','edit-url':'edit','recover-prompts':'drafts'}[choice.command];
        if(choice.kind==='command' && commandMode) {setMode(commandMode,commandMode==='edit'?context.sourceUrl || '':'');return;}
        if(choice.kind==='ai-draft') {
          const response=await chrome.runtime.sendMessage({type:'palette:recover',draftId:choice.draftId});
          if(!response?.ok)throw new Error(response?.error || 'Could not recover prompt');
          if(dismissed || closing || actionRevision!==queryRevision)return;
          setMode('search',response.alias?`${response.alias} ${response.query}`:response.query);
          if(response.alias)input.setSelectionRange(0,response.alias.length);
          return;
        }
        if(choice.kind==='site') {enterSite(sites.find(site=>site.key===choice.site));return;}
        const target=event.altKey?'current':event.shiftKey?'background':(mode==='edit' && !(event.metaKey||event.ctrlKey))?'current':'new';
        const targetField=target==='new'?{}:{target};
        let message;
        if(choice.kind==='move') message={type:'palette:move',tabId:orderTabId,placement:choice.placement,...(choice.beforeTabId===undefined?{}:{beforeTabId:choice.beforeTabId})};
        else if(choice.kind==='command') message={type:'palette:command',command:choice.command};
        else if(choice.kind==='closed') message={type:'palette:restore',sessionId:choice.sessionId};
        else if(choice.kind==='site-query') message={type:'palette:site',site:choice.site,query:choice.query,...targetField};
        else if(mode.startsWith('site:')) message={type:'palette:site',site:mode.slice(5),query:input.value,...targetField};
        else if(choice.id!==undefined && mode!=='edit' && !event.altKey && !event.shiftKey && !event.metaKey && !event.ctrlKey)
          message={type:'palette:activate',tabId:choice.id};
        else message={type:'palette:navigate',query:choice.kind==='navigate'?input.value:choice.url,...targetField};
        const response=await chrome.runtime.sendMessage(message);
        if(!response?.ok) throw new Error(response?.error || 'Could not open result');
        if(choice.kind==='site-query')chrome.runtime.sendMessage({type:'palette:remember-site',site:choice.site,alias:choice.alias}).catch(()=>{});
        if(response.copyText!==undefined) await copyText(response.copyText);
        close();
      } catch(failure) {error.textContent=failure.message;}
      finally {busy=false;}
    }
    editCurrent=value=>mode==='edit'?close():setMode('edit',value);
    function highlight() {
      [...results.children].forEach((row,index) => row.setAttribute('aria-selected', String(index === selected)));
      const row = results.children[selected];
      if (row) {input.setAttribute('aria-activedescendant',row.id);row.scrollIntoView({block:'nearest'});}
      else input.removeAttribute('aria-activedescendant');
    }
    function render(preferredId) {
      const previous = choices[selected];
      const previousKey = previous && `${previous.kind}:${previous.draftId ?? previous.beforeTabId ?? previous.placement ?? previous.tabId ?? previous.site ?? previous.command ?? previous.sessionId ?? previous.id ?? previous.url}`;
      choices = [...suggestions.filter(item => item.kind === 'tab'), ...suggestions.filter(item => item.kind === 'browser-page'), ...domains, ...suggestions.filter(item => !['tab','browser-page'].includes(item.kind))];
      const query=input.value.trim();
      if(['commands','closed','order','drafts'].includes(mode)) choices=suggestions;
      else if(mode.startsWith('site:')) choices=query?[{kind:'navigate',title:`Search ${sites.find(site=>site.key===mode.slice(5))?.name || 'site'}: ${query}`,url:'Site search'}]:[];
      else if(query) {
        const navigation={kind:'navigate',title:mode==='edit'?`Go to ${query}`:`Open ${query}`,url:mode==='edit'?'Replace current page':'New tab · URL or default search provider'};
        if(mode==='edit' || completedAddress===query) choices.unshift(navigation);else choices.push(navigation);
        if(mode==='search' && completedAddress!==query) {
          const siteRows=siteMatches(query).map(({site})=>({kind:'site',site:site.key,title:`Search ${site.name}`,url:site.detected?'Detected from your browsing · Tab to search':'Site search · Tab to search'}));
          const open=choices.filter(item=>item.kind==='tab');
          choices=[...open,...siteRows,...choices.filter(item=>item.kind!=='tab')];
        }
      }
      const inline=mode==='search' && completedAddress!==query?query.match(/^([\p{L}\d.-]{1,32})\s+(.+)$/us):null;
      const inlineSites=inline?siteMatches(inline[1],true):[];
      const uniqueInline=inlineSites.length && (inlineSites.length===1 || inlineSites[0].score>inlineSites[1].score);
      if(inlineSites.length) {
        const siteRows=inlineSites.map(({site})=>({kind:'site-query',site:site.key,query:inline[2],alias:inline[1].toLocaleLowerCase(),
          title:`Search ${site.name}: ${inline[2]}`,url:new URL(site.template.replace('%s','query')).origin,sources:['site']}));
        if(uniqueInline)choices=[...siteRows,...choices];
        else choices=[...choices.filter(choice=>choice.kind==='navigate'),...siteRows,...choices.filter(choice=>choice.kind!=='navigate')];
      }
      footer.textContent=mode==='drafts'?'Saved AI prompts · Enter recover · Edit shortcut to redirect · Esc back':mode==='order'?(orderTabId===undefined?'Arrange tabs · Alt+←/→ move · +Shift first/last · Enter place'
        :'Choose a destination · Enter move · Esc back'):mode==='commands'?'Commands · ↑ ↓ select · Enter run · Esc back'
        :mode==='closed'?'Recently closed · Enter restore · Esc back':mode==='edit'?'Edit URL · Enter replace · Cmd/Ctrl+Enter new tab · Esc back'
        :mode.startsWith('site:')?`Search ${sites.find(site=>site.key===mode.slice(5))?.name || 'site'} · Enter search · Esc back`
        :'↑ ↓ select · Alt+←/→ move tab · > commands · @ arrange · ? prompts';
      if(inlineSites.length)footer.textContent=uniqueInline?`Search ${inlineSites[0].site.name} · Enter send query · Tab enter scope · ↓ other results`:'Shared shortcut · ↓ choose site · Enter default search';
      const retained = choices.findIndex(choice => `${choice.kind}:${choice.draftId ?? choice.beforeTabId ?? choice.placement ?? choice.tabId ?? choice.site ?? choice.command ?? choice.sessionId ?? choice.id ?? choice.url}` === previousKey);
      const preferred=preferredId===undefined?-1:choices.findIndex(choice=>(choice.tabId ?? choice.id)===preferredId);
      selected = preferred>=0?preferred:selectionMoved && retained >= 0 ? retained : 0;
      if(preferred>=0)selectionMoved=true;
      results.replaceChildren(...choices.map((choice,index) => {
        const row = document.createElement('button'); row.className = 'result';row.id = `result-${index}`;
        row.setAttribute('role','option');row.tabIndex = -1;
        const icon = document.createElement('span');icon.className = 'icon';icon.textContent = ({tab:'▣',bookmark:'☆',history:'◷',domain:'⌂',navigate:'↗',command:'›',closed:'↶',site:'⌕','order-tab':'▣',move:'↔','ai-draft':'↶','browser-page':'⚙','site-query':'⌕'})[choice.kind];
        const text = document.createElement('span');text.className = 'text';
        const title = document.createElement('span');title.className = 'title';title.textContent = choice.title || 'Untitled tab';
        const url = document.createElement('span');url.className = 'url';url.textContent = ['navigate','order-tab','move','ai-draft'].includes(choice.kind) ? choice.url
          : `${(choice.sources || [choice.kind]).map(source => labels[source]).join(' · ')} · ${choice.url || ''}`;
        if (choice.match) url.textContent += choice.match === 'layout' ? ' · Keyboard layout match' : ' · Similar spelling';
        text.append(title,url);row.append(icon,text);
        if (choice.kind !== 'navigate' && !['command','closed','order-tab','move','ai-draft'].includes(choice.kind)) {
          const hint = document.createElement('span');hint.className = 'hint';hint.textContent = choice.kind==='site-query'?'Enter ↵':'Tab ↹';row.append(hint);
        }
        row.addEventListener('click',event => {if(busy)return;selected=index;selectionMoved=true;activate(event);});
        row.addEventListener('mousemove',() => {if(!busy){selected=index;selectionMoved=true;highlight();}});
        return row;
      }));highlight();
    }
    function updateSuggestions(preferredId) {
      const prefixMode={'>':'commands','@':'order','<':'closed','?':'drafts'}[input.value[0]];
      if(mode==='search' && prefixMode) {setMode(prefixMode,input.value.slice(1).trimStart());return;}
      const revision=++queryRevision;
      clearTimeout(timer);finishPending();
      let resolvePending;
      pendingQuery=new Promise(resolve=>{resolvePending=resolve;finishPending=resolve;});
      const query=input.value.trim();
      const terms=query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
      suggestions=['commands','closed','order','drafts'].includes(mode) || mode.startsWith('site:')?[]
        :tabs.filter(tab=>terms.every(term=>`${tab.title || ''} ${tab.url || ''}`.toLocaleLowerCase().includes(term)))
          .slice(0,8).map(tab=>({...tab,kind:'tab',sources:['tab']}));
      domains=[];choices=[];selected=0;selectionMoved=false;error.textContent='';render(preferredId);
      if(mode.startsWith('site:')) {resolvePending();return;}
      timer=setTimeout(async()=>{
        try {
          const response=await chrome.runtime.sendMessage({type:'palette:suggest',query,...(['commands','closed','order','drafts'].includes(mode)?{mode}:{}),...(mode==='order' && orderTabId!==undefined?{tabId:orderTabId}:{})});
          if(revision!==queryRevision || dismissed || closing) return;
          if(!response?.ok || !Array.isArray(response.suggestions)) throw new Error(response?.error || 'Suggestions unavailable');
          suggestions=response.suggestions;domains=Array.isArray(response.domains)?response.domains:[];
          error.textContent=(response.warnings || []).join(' · ');render(preferredId);
        } catch(failure) {
          if(revision===queryRevision && !dismissed && !closing) error.textContent=failure.message;
        } finally {resolvePending();}
      },150);
    }
    async function quickMove(placement) {
      if(busy)return;
      busy=true;error.textContent='';
      const revision=queryRevision;
      try {
        await pendingQuery;
        if(dismissed || closing || revision!==queryRevision)return;
        const choice=choices[selected];
        const tabId=orderTabId ?? (choice?.kind==='order-tab'?choice.tabId:choice?.kind==='tab'?choice.id:undefined);
        if(tabId===undefined)return;
        const filter=mode==='order' && orderTabId===undefined?input.value:'';
        const response=await chrome.runtime.sendMessage({type:'palette:move',tabId,placement});
        if(!response?.ok)throw new Error(response?.error || 'Could not move tab');
        if(!dismissed && !closing && revision===queryRevision)setMode('order',filter,undefined,tabId);
      } catch(failure) {if(!dismissed && !closing && revision===queryRevision)error.textContent=failure.message;}
      finally {busy=false;}
    }
    input.addEventListener('input',()=>{completedAddress=null;updateSuggestions();});
    input.addEventListener('beforeinput',event=>{if(busy)event.preventDefault();});
    dialog.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault();event.stopPropagation();
        if(mode==='order' && orderTabId!==undefined) setMode('order');
        else if(mode!=='search') setMode('search'); else close();
        return;
      }
      if(busy) {event.preventDefault();return;}
      if(event.key==='Backspace' && mode!=='search' && !input.value) {
        event.preventDefault();
        if(mode==='order' && orderTabId!==undefined)setMode('order');
        else setMode('search',mode.startsWith('site:')?mode.slice(5):'');
        return;
      }
      const moveKey={ArrowLeft:'left',ArrowRight:'right',Home:'start',End:'end'}[event.key];
      if(event.altKey && !event.ctrlKey && !event.metaKey && moveKey && (orderTabId!==undefined || ['tab','order-tab'].includes(choices[selected]?.kind))) {
        event.preventDefault();quickMove(event.shiftKey && ['left','right'].includes(moveKey)?(moveKey==='left'?'start':'end'):moveKey);return;
      }
      if (['ArrowDown','ArrowUp'].includes(event.key) && event.target===input && choices.length) {
        event.preventDefault(); selectionMoved = true; selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;highlight();
      }
      if (event.key === 'Enter') {event.preventDefault();activate(event);}
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        const choice = choices[selected];
        const matches=siteMatches(input.value);
        const site=choice?.kind==='site'?sites.find(site=>site.key===choice.site)
          :matches.length && (matches.length===1 || matches[0].score>matches[1].score)?matches[0].site:null;
        if(!event.shiftKey && event.target===input && choice?.kind==='site-query') {enterSite(sites.find(site=>site.key===choice.site),choice.alias,choice.query);return;}
        if(!event.shiftKey && event.target===input && mode==='search' && site) {enterSite(site);return;}
        if(!event.shiftKey && event.target===input && mode==='search' && !input.value.trim()) {setMode('commands');return;}
        if (!event.shiftKey && event.target === input && !['navigate','command','closed','site','order-tab','move','ai-draft'].includes(choice?.kind) && choice?.url) {
          input.value = choice.url;
          completedAddress = choice.url;
          input.focus();
          input.setSelectionRange(input.value.length,input.value.length);
          updateSuggestions();
        } else {
          input.focus();
        }
      }
    });
    dialog.addEventListener('cancel', event => {event.preventDefault();close();});
    dialog.addEventListener('click',event => {if(event.target === dialog) close();});
    dialog.showModal();setMode(mode,mode==='edit'?context.sourceUrl || '':'');
  }
  showPalette(frame.contentDocument);
}
