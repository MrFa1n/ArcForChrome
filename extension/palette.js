// Self-contained: Chrome serializes this function for isolated-world injection.
export function mountPalette(tabs, floating = false) {
  const existing = document.querySelector('[data-arc-command-palette]');
  if (existing) { existing.dispatchEvent(new Event('arc-palette-close')); return; }
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
  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    shell.close(); host.remove();
    if (floating) window.close(); else if (previousFocus?.isConnected) previousFocus.focus();
  }
  host.addEventListener('arc-palette-close', () => requestClose());
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
    input.setAttribute('aria-label','Search tabs or enter a URL');
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-controls','results');input.setAttribute('aria-expanded','true');
    const results = document.createElement('div'); results.id = 'results'; results.setAttribute('role','listbox');
    const error = document.createElement('p'); error.id = 'error'; error.setAttribute('role','status');
    const footer = document.createElement('footer');footer.textContent = '↑ ↓ select · Tab complete address · Enter open · Esc return';
    dialog.append(header,input,results,error,footer); root.append(dialog);document.documentElement.append(host);
    let selected = 0;
    let selectionMoved = false;
    let choices = [];
    let busy = false;
    let queryRevision = 0;
    let timer;
    let suggestions = [];
    let domains = [];
    const labels = {tab:'Open tab',bookmark:'Bookmark',history:'History',domain:'Homepage · New tab'};
    const heldKeys = new Set();
    let closing = false;
    function close() {
      clearTimeout(timer);
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
    async function activate(index) {
      if (busy || !choices[index]) return;
      busy = true;
      error.textContent = '';
      try {
        const choice = choices[index];
        const response = await chrome.runtime.sendMessage(choice.id !== undefined
          ? {type:'palette:activate', tabId:choice.id}
          : {type:'palette:navigate', query:choice.kind === 'navigate' ? input.value : choice.url});
        if (!response?.ok) throw new Error(response?.error || 'Could not open result');
        close();
      } catch (failure) { error.textContent = failure.message; } finally { busy = false; }
    }
    function highlight() {
      [...results.children].forEach((row,index) => row.setAttribute('aria-selected', String(index === selected)));
      const row = results.children[selected];
      if (row) {input.setAttribute('aria-activedescendant',row.id);row.scrollIntoView({block:'nearest'});}
      else input.removeAttribute('aria-activedescendant');
    }
    function render() {
      const previous = choices[selected];
      const previousKey = previous && `${previous.kind}:${previous.id ?? previous.url}`;
      choices = [...suggestions.filter(item => item.kind === 'tab'), ...domains, ...suggestions.filter(item => item.kind !== 'tab')];
      if (input.value.trim()) choices.push({kind:'navigate', title:`Open ${input.value.trim()}`, url:'New tab · URL or Google search'});
      const retained = choices.findIndex(choice => `${choice.kind}:${choice.id ?? choice.url}` === previousKey);
      selected = selectionMoved && retained >= 0 ? retained : 0;
      results.replaceChildren(...choices.map((choice,index) => {
        const row = document.createElement('button'); row.className = 'result';row.id = `result-${index}`;
        row.setAttribute('role','option');row.tabIndex = -1;
        const icon = document.createElement('span');icon.className = 'icon';icon.textContent = ({tab:'▣',bookmark:'☆',history:'◷',domain:'⌂',navigate:'↗'})[choice.kind];
        const text = document.createElement('span');text.className = 'text';
        const title = document.createElement('span');title.className = 'title';title.textContent = choice.title || 'Untitled tab';
        const url = document.createElement('span');url.className = 'url';url.textContent = choice.kind === 'navigate' ? choice.url
          : `${(choice.sources || [choice.kind]).map(source => labels[source]).join(' · ')} · ${choice.url || ''}`;
        text.append(title,url);row.append(icon,text);
        if (choice.kind !== 'navigate') {
          const hint = document.createElement('span');hint.className = 'hint';hint.textContent = 'Tab ↹';row.append(hint);
        }
        row.addEventListener('click',() => activate(index));
        row.addEventListener('mousemove',() => {selected = index;selectionMoved = true;highlight();});
        return row;
      }));highlight();
    }
    function updateSuggestions() {
      const revision = ++queryRevision;
      clearTimeout(timer);
      const query = input.value.trim();
      const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
      suggestions = tabs.filter(tab => terms.every(term => `${tab.title || ''} ${tab.url || ''}`.toLocaleLowerCase().includes(term)))
        .slice(0,8).map(tab => ({...tab,kind:'tab',sources:['tab']}));
      domains = [];
      choices = []; selected = 0; selectionMoved = false; error.textContent = '';
      render();
      timer = setTimeout(async () => {
        try {
          const response = await chrome.runtime.sendMessage({type:'palette:suggest',query});
          if (revision !== queryRevision || dismissed || closing || busy) return;
          if (!response?.ok || !Array.isArray(response.suggestions)) throw new Error(response?.error || 'Suggestions unavailable');
          suggestions = response.suggestions;
          domains = Array.isArray(response.domains) ? response.domains : [];
          error.textContent = (response.warnings || []).join(' · ');
          render();
        } catch (failure) {
          if (revision === queryRevision && !dismissed && !closing) error.textContent = failure.message;
        }
      },150);
    }
    input.addEventListener('input', updateSuggestions);
    dialog.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Escape') {event.preventDefault();event.stopPropagation();close();}
      if (['ArrowDown','ArrowUp'].includes(event.key) && choices.length) {
        event.preventDefault(); selectionMoved = true; selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;highlight();
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.target === closeButton) close(); else activate(selected);
      }
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        const choice = choices[selected];
        if (!event.shiftKey && event.target === input && choice?.kind !== 'navigate' && choice?.url) {
          input.value = choice.url;
          input.focus();
          input.setSelectionRange(input.value.length,input.value.length);
          updateSuggestions();
        } else (event.target === input ? closeButton : input).focus();
      }
    });
    dialog.addEventListener('cancel', event => {event.preventDefault();close();});
    dialog.addEventListener('click',event => {if(event.target === dialog) close();});
    closeButton.addEventListener('click',close);
    dialog.showModal(); updateSuggestions(); input.focus();
  }
  showPalette(frame.contentDocument);
}
