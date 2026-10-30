const SEARCH_KEYS=['search_query','search','query','q','text','keyword','term'];
const SECRET=/^(?:token|access_token|authorization|auth|session(?:id)?|sid|secret|api[_-]?key|code|state|nonce|csrf|xsrf|ticket|password|passwd|pwd|sig(?:nature)?)$/i;

function observedSite(record) {
  try {
    const url=new URL(record.url);
    if(!['http:','https:'].includes(url.protocol) || url.username || url.password || [...url.searchParams.keys()].some(key=>SECRET.test(key))) return null;
    const parameters=SEARCH_KEYS.filter(key=>url.searchParams.has(key));
    if(parameters.length!==1) return null;
    const parameter=parameters[0];
    if(url.searchParams.getAll(parameter).length!==1 || !url.searchParams.get(parameter)) return null;
    if(!['search','search_query'].includes(parameter) && url.pathname!=='/' && !/search|results|find/i.test(url.pathname) && !url.hostname.startsWith('search.')) return null;
    const labels=url.hostname.replace(/^www\./,'').split('.').slice(0,-1);
    const brand=(record.title || '').split(/\s+[|—–-]\s+/).find(part=>labels.includes(part.replace(/[^a-z\d]/gi,'').toLowerCase()));
    const name=brand || url.hostname.replace(/^www\./,'');
    const initials=name.replace(/([a-z])([A-Z])/g,'$1 $2').split(/[^a-z\d]+/i).filter(Boolean).map(word=>word[0]).join('').toLowerCase();
    const aliases=[...new Set([...labels,initials].filter(alias=>alias.length>=2))];
    url.hash='';
    for(const key of [...url.searchParams.keys()]) if(/^utm_|^(?:page|start|offset|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.set(parameter,'%s');
    return {key:`auto:${url.origin}`,name,template:url.href.replace(`${parameter}=%25s`,`${parameter}=%s`),aliases,detected:true};
  } catch {return null;}
}

export function inferSites(records) {
  const unique=new Map();
  for(const record of records) {
    const site=observedSite(record);
    if(site && !unique.has(site.key)) unique.set(site.key,site);
  }
  return [...unique.values()].slice(0,20);
}

export async function discoverSites(api,windowId) {
  const results=await Promise.allSettled([
    Promise.resolve().then(()=>api.tabs.query(windowId===undefined?{}:{windowId})),
    Promise.resolve().then(()=>api.bookmarks.getRecent(100)),
    Promise.resolve().then(()=>api.history.search({text:'',startTime:0,maxResults:250}))
  ]);
  const records=results.flatMap(result=>result.status==='fulfilled'?result.value:[]);
  records.sort((a,b)=>(b.lastAccessed || b.dateLastUsed || b.lastVisitTime || b.dateAdded || 0)-(a.lastAccessed || a.dateLastUsed || a.lastVisitTime || a.dateAdded || 0));
  return inferSites(records);
}
