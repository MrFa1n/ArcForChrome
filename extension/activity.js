import {activitySettings,saveActivitySettings,listActivity,clearActivity} from './activity-store.js';
const form=document.querySelector('#limits');
const status=document.querySelector('#status');
const filter=document.querySelector('#filter');
let revision=0;
async function refresh() {
  const current=++revision;
  try {
    const rows=await listActivity(chrome,filter.value);
    if(current!==revision)return;
    document.querySelector('#entries').replaceChildren(...rows.map(row=>{
      const item=document.createElement('li');const time=document.createElement('time');
      time.dateTime=new Date(row.time).toISOString();time.textContent=new Date(row.time).toLocaleString();
      const title=document.createElement('strong');title.textContent=`${row.status==='error'?'Failed / Ошибка':'Done / Выполнено'} · ${row.label}`;
      if(row.status==='error')title.className='failed';item.append(time,title);
      if(row.text){const text=document.createElement('p');text.textContent=row.text;item.append(text);}
      return item;
    }));
    document.querySelector('#count').textContent=rows.length?`${rows.length} actions / действий`:'No actions / Действий пока нет';
  } catch(error){status.textContent=error.message;}
}
activitySettings(chrome).then(settings=>{
  for(const [name,value] of Object.entries(settings)) {
    const input=form.elements.namedItem(name);if(input.type==='checkbox')input.checked=value;else input.value=value;
  }
}).catch(error=>{status.textContent=error.message;});
form.addEventListener('submit',async event=>{
  event.preventDefault();
  try {
    await saveActivitySettings(chrome,{enabled:form.elements.enabled.checked,includeText:form.elements.includeText.checked,
      retentionHours:Number(form.elements.retentionHours.value),maxEntries:Number(form.elements.maxEntries.value)});
    status.textContent='Saved / Сохранено';await refresh();
  } catch(error){status.textContent=error.message;}
});
document.querySelector('#clear').addEventListener('click',async()=>{
  try {await clearActivity(chrome);status.textContent='History cleared / История очищена';await refresh();}
  catch(error){status.textContent=error.message;}
});
filter.addEventListener('input',refresh);
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && Object.keys(changes).some(key=>key.startsWith('activity:')))refresh();});
refresh();
