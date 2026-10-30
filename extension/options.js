import {loadCustomSites,loadSites,parseSites} from './site-search.js';
const container=document.querySelector('#sites');
const status=document.querySelector('#status');
function addRow(site={name:'',key:'',template:''}) {
  const row=document.createElement('div');row.className='site';
  for(const [field,label] of [['name','Name'],['key','Keyword'],['template','Search URL']]) {
    const wrapper=document.createElement('label');wrapper.textContent=label;wrapper.className=field;
    const input=document.createElement('input');input.name=field;input.value=site[field];input.required=true;
    input.maxLength=field==='template'?2048:field==='name'?40:16;wrapper.append(input);row.append(wrapper);
  }
  const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label',`Remove ${site.name || 'site'}`);
  remove.addEventListener('click',()=>row.remove());row.insertBefore(remove,row.lastElementChild);container.append(row);
}
function render(sites) {container.replaceChildren();sites.forEach(addRow);}
document.querySelector('#add').addEventListener('click',()=>{if(container.children.length<20)addRow();else status.textContent='Use at most 20 sites.';});
document.querySelector('#reset').addEventListener('click',()=>{render([]);status.textContent='Manual overrides cleared in this form. Save to use automatic detection only.';});
document.querySelector('#sites-form').addEventListener('submit',async event=>{
  event.preventDefault();const submit=event.submitter || document.querySelector('button[type=submit]');submit.disabled=true;
  try {
    const sites=parseSites([...container.children].map(row=>Object.fromEntries([...row.querySelectorAll('input')].map(input=>[input.name,input.value]))));
    await chrome.storage.local.set({sites});status.textContent='Saved. Reopen search to use these sites.';
  } catch(error) {status.textContent=error.message;} finally {submit.disabled=false;}
});
for(const [id,url] of [['provider','chrome://settings/searchEngines'],['shortcuts','chrome://extensions/shortcuts']]) {
  document.querySelector(`#${id}`).addEventListener('click',()=>chrome.tabs.create({url}).catch(error=>{status.textContent=error.message;}));
}
loadCustomSites(chrome).then(render).catch(error=>{status.textContent=error.message;});
loadSites(chrome).then(sites=>{
  const list=document.querySelector('#detected');
  for(const site of sites.filter(site=>site.detected)) {
    const item=document.createElement('li');item.textContent=`${site.name} · ${site.aliases.join(', ')}`;list.append(item);
  }
  if(!list.children.length)list.textContent='No search URLs detected yet. Search on a website in Chrome once, then reopen the palette.';
}).catch(()=>{});
document.querySelector('#forget').addEventListener('click',async()=>{
  try {
    const saved=await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(saved).filter(key=>key.startsWith('siteAlias:')));
    status.textContent='Learned shortcuts cleared. Reopen search to refresh.';
  } catch(error) {status.textContent=error.message;}
});
