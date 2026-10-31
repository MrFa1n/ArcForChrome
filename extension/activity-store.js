const PREFIX='activity:entry:';
const SETTINGS='activity:settings';
const ALARM='spotlight-history-cleanup';
export const DEFAULT_ACTIVITY_SETTINGS={enabled:true,includeText:false,retentionHours:168,maxEntries:500};
function parseSettings(value) {
  if(!value || typeof value.enabled!=='boolean' || typeof value.includeText!=='boolean' ||
    !Number.isInteger(value.retentionHours) || value.retentionHours<0 || value.retentionHours>8760 ||
    !Number.isInteger(value.maxEntries) || value.maxEntries<1 || value.maxEntries>5000)throw new Error('Invalid history limits');
  return {enabled:value.enabled,includeText:value.includeText,retentionHours:value.retentionHours,maxEntries:value.maxEntries};
}
export async function activitySettings(api) {
  const saved=await api.storage.local.get(SETTINGS);
  return saved[SETTINGS]===undefined?{...DEFAULT_ACTIVITY_SETTINGS}:parseSettings(saved[SETTINGS]);
}
export async function cleanupActivity(api) {
  const saved=await api.storage.local.get(null);
  const settings=saved[SETTINGS]===undefined?DEFAULT_ACTIVITY_SETTINGS:parseSettings(saved[SETTINGS]);
  const cutoff=settings.retentionHours?Date.now()-settings.retentionHours*3600000:0;
  const entries=Object.entries(saved).filter(([key])=>key.startsWith(PREFIX))
    .sort((a,b)=>(b[1]?.time || 0)-(a[1]?.time || 0) || b[0].localeCompare(a[0]));
  const kept=[];const removed=[];
  for(const [key,row] of entries) {
    if(!row || !Number.isFinite(row.time) || row.time<=cutoff || typeof row.label!=='string' || kept.length>=settings.maxEntries)removed.push(key);
    else kept.push({...row,id:key});
  }
  if(removed.length)await api.storage.local.remove(removed);
  if(api.alarms) {
    if(settings.retentionHours && kept.length)await api.alarms.create(ALARM,{when:Math.max(Date.now()+60000,kept.at(-1).time+settings.retentionHours*3600000)});
    else await api.alarms.clear(ALARM);
  }
  return kept;
}
export async function saveActivitySettings(api,value) {
  await api.storage.local.set({[SETTINGS]:parseSettings(value)});
  await cleanupActivity(api);
}
export async function recordActivity(api,event) {
  if(!api.storage?.local?.set)return;
  const settings=await activitySettings(api);
  if(!settings.enabled)return;
  const row={time:Date.now(),action:event.action,label:event.label.slice(0,200),status:event.status};
  if(settings.includeText && typeof event.text==='string')row.text=event.text.slice(0,8192);
  await api.storage.local.set({[PREFIX+crypto.randomUUID()]:row});
  await cleanupActivity(api);
}
export async function listActivity(api,query='') {
  const terms=query.trim().toLocaleLowerCase().split(/\s+/);
  return (await cleanupActivity(api)).filter(row=>terms.every(term=>`${row.label} ${row.action} ${row.status} ${row.text || ''}`.toLocaleLowerCase().includes(term)));
}
export async function clearActivity(api) {
  const all=await api.storage.local.get(null);
  await api.storage.local.remove(Object.keys(all).filter(key=>key.startsWith(PREFIX)));
  await api.alarms?.clear(ALARM);
}
export function registerActivityCleanup(api) {
  const clean=()=>cleanupActivity(api).catch(()=>{});
  api.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM)return clean();});
  api.runtime.onStartup.addListener(clean);
  clean();
}
