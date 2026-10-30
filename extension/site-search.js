export const DEFAULT_SITES = [
  {key:'yt',name:'YouTube',template:'https://www.youtube.com/results?search_query=%s'},
  {key:'wiki',name:'Wikipedia',template:'https://en.wikipedia.org/w/index.php?search=%s'},
  {key:'gh',name:'GitHub',template:'https://github.com/search?q=%s'}
];

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

export async function loadSites(api) {
  const saved=await api.storage?.local?.get('sites');
  if(saved?.sites===undefined) return DEFAULT_SITES;
  return parseSites(saved.sites);
}

export function siteDestination(sites,key,query) {
  if(typeof query!=='string' || query.length>8192 || !query.trim()) throw new Error('Enter a site search query');
  const site=sites.find(item=>item.key===key);
  if(!site) throw new Error('Unknown search site');
  return site.template.replace('%s',encodeURIComponent(query.trim()));
}
