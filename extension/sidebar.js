import {matchPage} from './search-match.js';

const filter = document.querySelector('#filter');
const list = document.querySelector('#tabs');
const status = document.querySelector('#status');
const {id:windowId} = await chrome.windows.getCurrent();
let snapshot = [];
let groupNames = new Map();
let revision = 0;

function render() {
  const query = filter.value.trim();
  const byGroup = new Map();
  for (const tab of snapshot) {
    if (query && !matchPage(tab,query)) continue;
    const key = tab.groupId ?? -1;
    if (!byGroup.has(key)) byGroup.set(key,[]);
    byGroup.get(key).push(tab);
  }
  const sections = [];
  for (const [groupId,tabs] of byGroup) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = groupId < 0 ? 'Ungrouped' : groupNames.get(groupId) || 'Tab group';
    const items = document.createElement('div');
    items.className = 'tab-list';
    for (const tab of tabs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = tab.title || tab.url || 'Untitled tab';
      button.title = tab.url || button.textContent;
      if (tab.active) button.setAttribute('aria-current','true');
      button.addEventListener('click',async () => {
        try {
          const live = await chrome.tabs.get(tab.id);
          if (live.windowId !== windowId) throw new Error('Tab moved to another window');
          await chrome.tabs.update(tab.id,{active:true});
        } catch {
          status.textContent = 'Could not switch to this tab.';
        }
      });
      items.append(button);
    }
    section.append(heading,items);
    sections.push(section);
  }
  list.replaceChildren(...sections);
  status.textContent = sections.length ? '' : 'No matching tabs.';
}

async function refresh() {
  const current = ++revision;
  try {
    const [tabs,groups] = await Promise.all([
      chrome.tabs.query({windowId}),chrome.tabGroups.query({windowId})
    ]);
    if (current !== revision) return;
    snapshot = tabs;
    groupNames = new Map(groups.map(group => [group.id,group.title]));
    render();
  } catch {
    if (current === revision) status.textContent = 'Could not load tabs.';
  }
}

filter.addEventListener('input',render);
for (const event of [chrome.tabs.onCreated,chrome.tabs.onRemoved,chrome.tabs.onUpdated,
  chrome.tabs.onMoved,chrome.tabs.onAttached,chrome.tabs.onDetached,chrome.tabs.onActivated,
  chrome.tabGroups.onUpdated]) {
  event.addListener(refresh);
}
await refresh();
