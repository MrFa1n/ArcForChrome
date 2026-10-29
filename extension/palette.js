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
    const host = document.createElement('div');
    host.setAttribute('data-arc-command-palette', '');
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host{all:initial}*{box-sizing:border-box}dialog{--bg:#f7f5fb;--fg:#302b40;--muted:#82798e;--hover:#eae4f4;
      color-scheme:light dark;border:1px solid #a99bb855;border-radius:20px;padding:0;width:min(620px,calc(100vw - 32px));
      max-height:80vh;margin:12vh auto 0;background:var(--bg);color:var(--fg);box-shadow:0 24px 100px #0005;
      font:14px/1.5 system-ui,sans-serif;overflow:hidden}dialog::backdrop{background:#15102055;backdrop-filter:blur(5px)}
      @media(prefers-color-scheme:dark){dialog{--bg:#282432;--fg:#f5f0fc;--muted:#b7acc6;--hover:#3a3249}}
      header{padding:20px 22px 0;display:flex;justify-content:space-between;color:var(--muted);font-size:11px;letter-spacing:1px}
      input{font:inherit;font-size:21px;width:100%;padding:18px 22px;border:0;outline:none;color:var(--fg);background:transparent}
      #results{padding:6px 10px;max-height:48vh;overflow:auto;border-top:1px solid #a99bb833}
      button{font:inherit;color:inherit;cursor:pointer}button.result{display:flex;align-items:center;gap:12px;width:100%;border:0;
      border-radius:10px;background:transparent;text-align:left;padding:12px}button.result[aria-selected=true]{background:var(--hover)}
      .icon{width:28px;height:28px;border-radius:8px;background:var(--hover);display:grid;place-items:center;flex-shrink:0}
      .text{min-width:0;flex:1}.title,.url{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .url{font-size:11px;color:var(--muted)}footer{padding:12px 22px;color:var(--muted);font-size:11px;border-top:1px solid #a99bb833}
      #error{color:#d05d71;padding:0 22px;font-size:12px}#close{border:0;background:transparent;color:inherit;border-radius:4px}
      button:focus-visible{outline:2px solid #9b7bc8;outline-offset:-2px}`;
    root.append(style);
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', 'Search tabs or the web');
    const header = document.createElement('header');
    header.textContent = 'ARC · COMMAND BAR';
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
    const footer = document.createElement('footer');footer.textContent = '↑ ↓ to select · Enter to open · Esc to return · Opens links in a new tab';
    dialog.append(header,input,results,error,footer); root.append(dialog);document.documentElement.append(host);
    let selected = 0;
    let choices = [];
    let busy = false;
    const heldKeys = new Set();
    let closing = false;
    function close() {
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
          : {type:'palette:navigate', query:input.value});
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
      const query = input.value.trim().toLocaleLowerCase();
      choices = tabs.filter(tab => !query || `${tab.title || ''} ${tab.url || ''}`.toLocaleLowerCase().includes(query)).slice(0,8);
      // Explicit navigation is the default for typed text; existing tabs are one arrow away.
      if (query) choices.unshift({ title: `Open ${input.value.trim()}`, url: 'New tab · URL or Google search' });
      selected = 0;
      results.replaceChildren(...choices.map((choice,index) => {
        const row = document.createElement('button'); row.className = 'result';row.id = `result-${index}`;
        row.setAttribute('role','option');row.tabIndex = -1;
        const icon = document.createElement('span');icon.className = 'icon';icon.textContent = choice.id === undefined ? '↗' : '▣';
        const text = document.createElement('span');text.className = 'text';
        const title = document.createElement('span');title.className = 'title';title.textContent = choice.title || 'Untitled tab';
        const url = document.createElement('span');url.className = 'url';url.textContent = choice.url || '';
        text.append(title,url);row.append(icon,text);
        row.addEventListener('click',() => activate(index));
        row.addEventListener('mousemove',() => {selected = index;highlight();});
        return row;
      }));highlight();
    }
    input.addEventListener('input',render);
    dialog.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Escape') {event.preventDefault();event.stopPropagation();close();}
      if (['ArrowDown','ArrowUp'].includes(event.key) && choices.length) {
        event.preventDefault(); selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;highlight();
      }
      if (event.key === 'Enter') {event.preventDefault();activate(selected);}
      if (event.key === 'Tab') {event.preventDefault();input.focus();}
    });
    dialog.addEventListener('cancel', event => {event.preventDefault();close();});
    dialog.addEventListener('click',event => {if(event.target === dialog) close();});
    closeButton.addEventListener('click',close);
    dialog.showModal(); render(); input.focus();
  }
  showPalette(frame.contentDocument);
}
