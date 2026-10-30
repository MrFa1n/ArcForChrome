import {discoverSites} from './site-discovery.js';

export function parseSites(value) {
  if(!Array.isArray(value) || value.length>20) throw new Error('Use at most 20 search sites');
  const seen=new Set();
  return value.map(site=>{
    if(!site || typeof site.key!=='string' || !/^[a-z][a-z0-9-]{0,15}$/.test(site.key) || seen.has(site.key)) throw new Error('Site keywords must be unique: letters, digits or hyphens');
    if(typeof site.name!=='string' || !site.name.trim() || site.name.length>40) throw new Error('Site names must be 1–40 characters');
    if(typeof site.template!=='string' || site.template.length>2048 || site.template.split('%s').length!==2) throw new Error('Search URL needs exactly one %s placeholder');
    const url=new URL(site.template.replace('%s','query'));
    if(!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) search URL without credentials');
    seen.add(site.key);
    return {key:site.key,name:site.name.trim(),template:site.template};
  });
}

export async function loadCustomSites(api) {
  const saved=await api.storage?.local?.get('sites');
  return saved?.sites===undefined?[]:parseSites(saved.sites);
}

export async function loadSites(api,windowId) {
  const [custom,detected,saved]=await Promise.all([loadCustomSites(api),discoverSites(api,windowId),api.storage?.local?.get(null)]);
  const manual=custom.map(site=>({...site,aliases:[site.key],detected:false}));
  const origins=new Set(custom.map(site=>new URL(site.template.replace('%s','query')).origin));
  const sites=[...manual,...detected.filter(site=>!origins.has(new URL(site.template.replace('%s','query')).origin))];
  for(const [key,value] of Object.entries(saved || {})) {
    if(!key.startsWith('siteAlias:') || typeof value!=='string') continue;
    try {
      const alias=decodeURIComponent(key.slice(10));
      const site=sites.find(item=>item.key===value);
      if(site && /^[\p{L}\d.-]{2,32}$/u.test(alias)) {
        if(!site.aliases.includes(alias))site.aliases.unshift(alias);
        site.learnedAliases=[...(site.learnedAliases || []),alias];
      }
    } catch { /* Ignore malformed stored alias keys. */ }
  }
  return sites;
}

export async function rememberSite(api,windowId,siteKey,input) {
  if(typeof input!=='string' || !/^[\p{L}\d.-]{2,32}$/u.test(input.trim())) return;
  const sites=await loadSites(api,windowId);
  if(!sites.some(site=>site.key===siteKey)) throw new Error('Search site is no longer available');
  const alias=input.trim().toLocaleLowerCase();
  await api.storage.local.set({[`siteAlias:${encodeURIComponent(alias)}`]:siteKey});
}

export function siteDestination(sites,key,query) {
  if(typeof query!=='string' || query.length>8192 || !query.trim()) throw new Error('Enter a site search query');
  const site=sites.find(item=>item.key===key);
  if(!site) throw new Error('Unknown search site');
  return site.template.replace('%s',encodeURIComponent(query.trim()));
}
