import { visibleTabs, destination } from './model.js';
import { cycleSpace } from './shortcuts.js';
const $ = selector => document.querySelector(selector);
let tabs = [];
let space = -1;
let windowId;
let revision = 0;

function report(error) { $('#status').textContent = error.message || String(error); }
function run(action) {
  return (...args) => {
    try { Promise.resolve(action(...args)).catch(report); } catch (error) { report(error); }
  };
}

function tabRow(tab) {
  const row = $('#tab-template').content.firstElementChild.cloneNode(true);
  row.classList.toggle('active', tab.active);
  row.querySelector('.title').textContent = tab.title || 'New tab';
  row.querySelector('.favicon').textContent = (tab.title || '•').slice(0, 1).toUpperCase();
  row.querySelector('.audio').textContent = tab.audible ? '♪' : '';
  const activate = row.querySelector('.activate');
  activate.title = tab.url || tab.title || 'New tab';
  if (tab.active) activate.setAttribute('aria-current', 'page');
  activate.addEventListener('click', run(() => chrome.tabs.update(tab.id, { active: true })));
  const pin = row.querySelector('.pin');
  pin.textContent = tab.pinned ? '★' : '☆';
  pin.setAttribute('aria-pressed', String(tab.pinned));
  pin.setAttribute('aria-label', `${tab.pinned ? 'Unpin' : 'Pin'} ${tab.title || 'tab'}`);
  pin.addEventListener('click', run(() => chrome.tabs.update(tab.id, { pinned: !tab.pinned })));
  row.querySelector('.close').setAttribute('aria-label', `Close ${tab.title || 'tab'}`);
  row.querySelector('.close').addEventListener('click', run(() => chrome.tabs.remove(tab.id)));
  return row;
}

function renderList(selector, list, emptyText) {
  const container = $(selector);
  container.replaceChildren(...list.map(tabRow));
  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = emptyText;
    container.append(empty);
  }
}

function render() {
  const visible = visibleTabs(tabs, space, $('#search').value);
  renderList('#favorites', visible.filter(tab => tab.pinned), 'Pin a tab with ☆ to keep it close.');
  renderList('#tabs', visible.filter(tab => !tab.pinned), 'A fresh start. Open a new tab.');
  $('#tabs-heading').textContent = $('#search').value.trim() ? 'Search results · all spaces' : 'Today';
}

async function refresh() {
  const current = ++revision;
  const [nextTabs, groups] = await Promise.all([
    chrome.tabs.query({ windowId }), chrome.tabGroups.query({ windowId })
  ]);
  if (current !== revision) return;
  tabs = nextTabs;
  if (!groups.some(group => group.id === space)) space = -1;
  const options = [new Option('Inbox', '-1'), ...groups.map(group => new Option(group.title || 'Untitled space', String(group.id)))];
  $('#space').replaceChildren(...options);
  $('#space').value = String(space);
  render();
}

async function createTab(url) {
  const tab = await chrome.tabs.create({ windowId, ...(url ? { url } : {}) });
  if (space !== -1) await chrome.tabs.group({ tabIds: [tab.id], groupId: space });
}

async function createSpace(event) {
  event.preventDefault();
  const title = $('#space-name').value.trim();
  if (!title) return;
  const button = $('#space-form button[type=submit]');
  button.disabled = true;
  try {
    const tab = await chrome.tabs.create({ windowId });
    const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
    await chrome.tabGroups.update(groupId, { title, color: 'purple' });
    space = groupId;
    $('#space-form').reset();
    $('#space-form').hidden = true;
    await refresh();
  } finally { button.disabled = false; }
}

function handleKeyboard(event) {
  if (event.isComposing || event.defaultPrevented) return;
  const primary = event.metaKey || event.ctrlKey;
  if (primary && !event.altKey && !event.shiftKey && event.code === 'KeyK') {
    event.preventDefault();
    $('#search').focus();
    $('#search').select();
    return;
  }
  if (event.altKey && !primary && !event.shiftKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    const ids = [...$('#space').options].map(option => Number(option.value));
    space = cycleSpace(ids, space, event.key === 'ArrowRight' ? 1 : -1);
    $('#space').value = String(space);
    render();
    return;
  }
  if (event.key === 'Escape') {
    $('#space-form').hidden = true;
    $('#search').value = '';
    render();
    $('#search').focus();
    return;
  }
  if (primary || event.altKey || event.shiftKey || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  const results = [...document.querySelectorAll('.activate')];
  const index = results.indexOf(document.activeElement);
  if (document.activeElement !== $('#search') && index < 0) return;
  if (!results.length) return;
  event.preventDefault();
  const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : results.length - 1)
    : (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
  results[next].focus();
}

async function init() {
  windowId = (await chrome.windows.getCurrent()).id;
  document.addEventListener('keydown', handleKeyboard);
  $('#shortcut-settings').addEventListener('click', run(() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })));
  const commands = await chrome.commands.getAll();
  $('#shortcut-list').replaceChildren(...commands.map(command => {
    const item = document.createElement('li');
    item.textContent = `${command.description || 'Open sidebar'}: ${command.shortcut || 'Not assigned'}`;
    return item;
  }));
  $('#search').addEventListener('input', render);
  $('#search-form').addEventListener('submit', run(async event => {
    event.preventDefault();
    const url = destination($('#search').value);
    if (url) { await createTab(url); $('#search').value = ''; await refresh(); }
  }));
  $('#space').addEventListener('change', () => { space = Number($('#space').value); render(); });
  $('#new-tab').addEventListener('click', run(() => createTab()));
  $('#add-space').addEventListener('click', () => { $('#space-form').hidden = false; $('#space-name').focus(); });
  $('#cancel-space').addEventListener('click', () => { $('#space-form').hidden = true; });
  $('#space-form').addEventListener('submit', run(createSpace));
  $('#theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark' ||
      (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  });
  for (const event of [chrome.tabs.onCreated, chrome.tabs.onUpdated, chrome.tabs.onRemoved,
    chrome.tabs.onMoved, chrome.tabs.onAttached, chrome.tabs.onDetached, chrome.tabs.onActivated,
    chrome.tabGroups.onCreated, chrome.tabGroups.onUpdated, chrome.tabGroups.onRemoved]) {
    event.addListener(run(refresh));
  }
  await refresh();
  $('#search').focus();
}
init().catch(report);
