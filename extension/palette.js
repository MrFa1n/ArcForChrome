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
      header{padding:20px 22px 0;display:flex;justify-content:space-between;color:var(--muted);font-size:.6875rem;letter-spacing:.5px}
      input{font:inherit;font-size:1.3125rem;width:100%;padding:18px 22px;border:0;outline:none;color:var(--fg);background:transparent}
      nav{display:flex;gap:8px;padding:12px 22px 0;align-items:center} nav select{min-width:0;flex:1;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:6px;font:inherit} nav button{border:1px solid var(--line);border-radius:8px;background:var(--bg);padding:6px 10px}
      #results{padding:6px 10px;max-height:48vh;overflow:auto;border-top:1px solid var(--line)}
      button{font:inherit;color:inherit;cursor:pointer}button.result{display:flex;align-items:center;gap:12px;width:100%;border:0;
      border-radius:8px;background:transparent;text-align:left;padding:12px}button.result[aria-selected=true]{background:var(--hover)}
      .icon{width:28px;height:28px;border-radius:8px;background:var(--hover);display:grid;place-items:center;flex-shrink:0}
      .text{min-width:0;flex:1}.title,.url{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .url{font-size:.6875rem;color:var(--muted)}.hint{font-size:.625rem;color:var(--muted);flex-shrink:0}
      footer{padding:12px 22px;color:var(--muted);font-size:.6875rem;border-top:1px solid var(--line)}
      #error{color:#b3261e;padding:0 22px;font-size:.75rem}#close{border:0;background:transparent;color:inherit;border-radius:4px}
      button:focus-visible{outline:2px solid Highlight;outline-offset:-2px}
      @media(prefers-color-scheme:dark){#error{color:#f2b8b5}}
      @media(prefers-contrast:more){dialog{--line:CanvasText}.url,.hint,header,footer{color:CanvasText}}
      @media(forced-colors:active){button.result[aria-selected=true]{background:Highlight;color:HighlightText}
        button.result[aria-selected=true] .url,button.result[aria-selected=true] .hint{color:HighlightText}}
      @media(prefers-reduced-transparency:reduce){dialog::backdrop{backdrop-filter:none}}
      `;
    root.append(style);
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', 'Search tabs or the web');
    const header = document.createElement('header');
    header.textContent = 'Search tabs and the web';
    const closeButton = document.createElement('button');
    closeButton.id = 'close'; closeButton.textContent = 'esc'; closeButton.setAttribute('aria-label','Close search');
    header.append(closeButton);
    const input = document.createElement('input');
    input.placeholder = 'Search tabs or enter a URL…';
    input.maxLength = 8192;
    input.setAttribute('aria-label','Search tabs or enter a URL');
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-controls','results');input.setAttribute('aria-expanded','true');
    const results = document.createElement('div'); results.id = 'results'; results.setAttribute('role','listbox');
    const error = document.createElement('p'); error.id = 'error'; error.setAttribute('role','status');
    const footer = document.createElement('footer');footer.textContent = '↑ ↓ select · Tab complete address · Enter open · Esc return';
    const modes = document.createElement('select');modes.setAttribute('aria-label','Search mode');
    const sites = Array.isArray(context.sites) ? context.sites : [];
    for(const [value,label] of [['search','Search · new tab'],['edit','Edit current URL'],['commands','Commands'],['closed','Recently closed'],...sites.map(site=>[`site:${site.key}`,`Search ${site.name}`])]) {
      const option = document.createElement('option');option.value=value;option.textContent=label;modes.append(option);
    }
    const settings = document.createElement('button');settings.textContent='Settings';settings.type='button';
    const nav = document.createElement('nav');nav.append(modes,settings);
    dialog.append(header,nav,input,results,error,footer); root.append(dialog);document.documentElement.append(host);
    let mode = context.mode === 'edit' ? 'edit' : 'search';
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
    const labels = {tab:'Open tab',bookmark:'Bookmark',history:'History',domain:'Homepage · New tab',command:'Command',closed:'Restore session',site:'Site search'};
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
    function setMode(next,value='') {
      mode=next;completedAddress=null;modes.value=mode;input.value=value;
      input.placeholder=mode==='commands'?'Find a browser command…':mode==='closed'?'Find a recently closed tab…'
        :mode.startsWith('site:')?'Enter a site search query…':'Search tabs or enter a URL…';
      updateSuggestions();input.focus();
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
      modes.disabled=true;settings.disabled=true;
      try {
        // Do not commit the provisional list while smart suggestions are still loading.
        await pendingQuery;
        if(dismissed || closing || actionRevision!==queryRevision) return;
        const choice=choices[selected];
        if(!choice) return;
        if(choice.kind==='site') {setMode(`site:${choice.site}`);return;}
        const target=event.altKey?'current':event.shiftKey?'background':(mode==='edit' && !(event.metaKey||event.ctrlKey))?'current':'new';
        const targetField=target==='new'?{}:{target};
        let message;
        if(choice.kind==='command') message={type:'palette:command',command:choice.command};
        else if(choice.kind==='closed') message={type:'palette:restore',sessionId:choice.sessionId};
        else if(mode.startsWith('site:')) message={type:'palette:site',site:mode.slice(5),query:input.value,...targetField};
        else if(choice.id!==undefined && mode!=='edit' && !event.altKey && !event.shiftKey && !event.metaKey && !event.ctrlKey)
          message={type:'palette:activate',tabId:choice.id};
        else message={type:'palette:navigate',query:choice.kind==='navigate'?input.value:choice.url,...targetField};
        const response=await chrome.runtime.sendMessage(message);
        if(!response?.ok) throw new Error(response?.error || 'Could not open result');
        if(response.copyText!==undefined) await copyText(response.copyText);
        close();
      } catch(failure) {error.textContent=failure.message;}
      finally {busy=false;modes.disabled=false;settings.disabled=false;}
    }
    modes.addEventListener('change',()=>setMode(modes.value,modes.value==='edit'?context.sourceUrl || '':''));
    settings.addEventListener('click',async()=>{
      try {
        const response=await chrome.runtime.sendMessage({type:'palette:command',command:'settings'});
        if(!response?.ok) throw new Error(response?.error || 'Could not open settings');
        close();
      } catch(failure) {error.textContent=failure.message;}
    });
    editCurrent=value=>mode==='edit'?close():setMode('edit',value);
    function highlight() {
      [...results.children].forEach((row,index) => row.setAttribute('aria-selected', String(index === selected)));
      const row = results.children[selected];
      if (row) {input.setAttribute('aria-activedescendant',row.id);row.scrollIntoView({block:'nearest'});}
      else input.removeAttribute('aria-activedescendant');
    }
    function render() {
      const previous = choices[selected];
      const previousKey = previous && `${previous.kind}:${previous.command ?? previous.sessionId ?? previous.id ?? previous.url}`;
      choices = [...suggestions.filter(item => item.kind === 'tab'), ...domains, ...suggestions.filter(item => item.kind !== 'tab')];
      const query=input.value.trim();
      if(mode==='commands' || mode==='closed') choices=suggestions;
      else if(mode.startsWith('site:')) choices=query?[{kind:'navigate',title:`Search ${sites.find(site=>site.key===mode.slice(5))?.name || 'site'}: ${query}`,url:'Site search'}]:[];
      else if(query) {
        const navigation={kind:'navigate',title:mode==='edit'?`Go to ${query}`:`Open ${query}`,url:mode==='edit'?'Replace current page':'New tab · URL or default search provider'};
        if(mode==='edit' || completedAddress===query) choices.unshift(navigation);else choices.push(navigation);
        const site=sites.find(site=>site.key===query.toLocaleLowerCase());
        if(site && mode==='search') choices.unshift({kind:'site',site:site.key,title:`Search ${site.name}`,url:`${site.key} · Press Tab to search this site`});
      }
      footer.textContent=mode==='commands'?'Commands only · Esc back':mode==='closed'?'Enter restores the original session · Esc back'
        : '↑ ↓ select · Tab complete / mode · Shift+Enter background · Alt+Enter current';
      const retained = choices.findIndex(choice => `${choice.kind}:${choice.command ?? choice.sessionId ?? choice.id ?? choice.url}` === previousKey);
      selected = selectionMoved && retained >= 0 ? retained : 0;
      results.replaceChildren(...choices.map((choice,index) => {
        const row = document.createElement('button'); row.className = 'result';row.id = `result-${index}`;
        row.setAttribute('role','option');row.tabIndex = -1;
        const icon = document.createElement('span');icon.className = 'icon';icon.textContent = ({tab:'▣',bookmark:'☆',history:'◷',domain:'⌂',navigate:'↗',command:'›',closed:'↶',site:'⌕'})[choice.kind];
        const text = document.createElement('span');text.className = 'text';
        const title = document.createElement('span');title.className = 'title';title.textContent = choice.title || 'Untitled tab';
        const url = document.createElement('span');url.className = 'url';url.textContent = choice.kind === 'navigate' ? choice.url
          : `${(choice.sources || [choice.kind]).map(source => labels[source]).join(' · ')} · ${choice.url || ''}`;
        if (choice.match) url.textContent += choice.match === 'layout' ? ' · Keyboard layout match' : ' · Similar spelling';
        text.append(title,url);row.append(icon,text);
        if (choice.kind !== 'navigate' && !['command','closed'].includes(choice.kind)) {
          const hint = document.createElement('span');hint.className = 'hint';hint.textContent = 'Tab ↹';row.append(hint);
        }
        row.addEventListener('click',event => {if(busy)return;selected=index;selectionMoved=true;activate(event);});
        row.addEventListener('mousemove',() => {if(!busy){selected=index;selectionMoved=true;highlight();}});
        return row;
      }));highlight();
    }
    function updateSuggestions() {
      if(mode==='search' && input.value.startsWith('>')) {setMode('commands',input.value.slice(1).trimStart());return;}
      const revision=++queryRevision;
      clearTimeout(timer);finishPending();
      let resolvePending;
      pendingQuery=new Promise(resolve=>{resolvePending=resolve;finishPending=resolve;});
      const query=input.value.trim();
      const terms=query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
      suggestions=['commands','closed'].includes(mode) || mode.startsWith('site:')?[]
        :tabs.filter(tab=>terms.every(term=>`${tab.title || ''} ${tab.url || ''}`.toLocaleLowerCase().includes(term)))
          .slice(0,8).map(tab=>({...tab,kind:'tab',sources:['tab']}));
      domains=[];choices=[];selected=0;selectionMoved=false;error.textContent='';render();
      if(mode.startsWith('site:')) {resolvePending();return;}
      timer=setTimeout(async()=>{
        try {
          const response=await chrome.runtime.sendMessage({type:'palette:suggest',query,...(['commands','closed'].includes(mode)?{mode}:{})});
          if(revision!==queryRevision || dismissed || closing) return;
          if(!response?.ok || !Array.isArray(response.suggestions)) throw new Error(response?.error || 'Suggestions unavailable');
          suggestions=response.suggestions;domains=Array.isArray(response.domains)?response.domains:[];
          error.textContent=(response.warnings || []).join(' · ');render();
        } catch(failure) {
          if(revision===queryRevision && !dismissed && !closing) error.textContent=failure.message;
        } finally {resolvePending();}
      },150);
    }
    input.addEventListener('input',()=>{completedAddress=null;updateSuggestions();});
    input.addEventListener('beforeinput',event=>{if(busy)event.preventDefault();});
    dialog.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault();event.stopPropagation();
        if(mode!=='search') setMode('search'); else close();
        return;
      }
      if(busy) {event.preventDefault();return;}
      if(event.key==='Backspace' && mode.startsWith('site:') && !input.value) {event.preventDefault();setMode('search',mode.slice(5));return;}
      if (['ArrowDown','ArrowUp'].includes(event.key) && event.target===input && choices.length) {
        event.preventDefault(); selectionMoved = true; selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;highlight();
      }
      if (event.key === 'Enter' && event.target!==modes) {
        event.preventDefault();
        if(event.target===closeButton)close();
        else if(event.target===settings)settings.click();
        else activate(event);
      }
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        const choice = choices[selected];
        const site=sites.find(site=>site.key===input.value.trim().toLocaleLowerCase());
        if(!event.shiftKey && event.target===input && mode==='search' && site) {setMode(`site:${site.key}`);return;}
        if(!event.shiftKey && event.target===input && mode==='search' && !input.value.trim()) {setMode('commands');return;}
        if (!event.shiftKey && event.target === input && !['navigate','command','closed','site'].includes(choice?.kind) && choice?.url) {
          input.value = choice.url;
          completedAddress = choice.url;
          input.focus();
          input.setSelectionRange(input.value.length,input.value.length);
          updateSuggestions();
        } else {
          const controls=[input,modes,settings,closeButton];
          const index=controls.indexOf(root.activeElement);
          controls[(index+(event.shiftKey?-1:1)+controls.length)%controls.length].focus();
        }
      }
    });
    dialog.addEventListener('cancel', event => {event.preventDefault();close();});
    dialog.addEventListener('click',event => {if(event.target === dialog) close();});
    closeButton.addEventListener('click',close);
    dialog.showModal();setMode(mode,mode==='edit'?context.sourceUrl || '':'');
  }
  showPalette(frame.contentDocument);
}
