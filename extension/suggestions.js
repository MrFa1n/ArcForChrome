import { matchPage, queryVariants } from './search-match.js';

const LIMIT = 8;
const ORDER = { tab: 0, bookmark: 1, history: 2 };

function candidateUrl(item, kind) {
  try {
    const url = new URL(item.url);
    if (kind !== 'tab' && !['https:', 'http:'].includes(url.protocol)) return null;
    return url.href;
  } catch { return kind === 'tab' ? '' : null; }
}

export function rankSuggestions(tabs, bookmarks, history, input) {
  const query = input.trim().toLocaleLowerCase();
  const unique = new Map();
  for (const [kind, items] of [['tab', tabs], ['bookmark', bookmarks], ['history', history]]) {
    for (const item of items) {
      const url = candidateUrl(item, kind);
      if (url === null) continue;
      const key = url || `tab:${item.id}`;
      const text = `${item.title || ''} ${url}`.toLocaleLowerCase();
      const previous = unique.get(key);
      if (previous) {
        previous.search += ` ${text}`;
        if (!previous.sources.includes(kind)) previous.sources.push(kind);
      } else unique.set(key, {
        kind, ...(kind === 'tab' ? {id: item.id} : {}), title: item.title || url || 'Untitled tab', url,
        sources: [kind], search: text, lastVisitTime: item.lastVisitTime || 0
      });
    }
  }
  return [...unique.values()].map(item => ({...item,match:matchPage(item,query)})).filter(item => item.match)
    .sort((a,b) => ORDER[a.kind] - ORDER[b.kind] || b.match.score - a.match.score || b.lastVisitTime - a.lastVisitTime)
    .slice(0,LIMIT).map(({search,lastVisitTime,match,...item}) => ({...item,...(match.kind==='exact'?{}:{match:match.kind})}));
}

function domainSuggestions(suggestions, query) {
  if (!query) return [];
  const known = new Set(suggestions.map(item => item.url));
  const domains = new Map();
  for (const item of suggestions) {
    try {
      const url = new URL(item.url);
      if (!['http:','https:'].includes(url.protocol)) continue;
      const home = `${url.origin}/`;
      if (!known.has(home)) domains.set(home, {kind:'domain',title:`Open ${url.host}`,url:home,sources:['domain']});
    } catch { /* Open browser-internal tabs have no web homepage action. */ }
  }
  return [...domains.values()].slice(0,3);
}

async function sourceCandidates(api, source, query) {
  const variants=queryVariants(query);
  const results=await Promise.allSettled(variants.map(text => Promise.resolve().then(() => source==='bookmarks'
    ? api.bookmarks.search(text) : api.history.search({text,startTime:0,maxResults:50}))));
  if(results.every(result => result.status==='rejected')) throw new Error('Source unavailable');
  return results.flatMap(result => result.status==='fulfilled'?result.value:[]);
}

export async function findSuggestions(api, windowId, input) {
  if (typeof input !== 'string' || input.length > 8192) throw new Error('Invalid query');
  const query = input.trim();
  const requests = [() => api.tabs.query({windowId})];
  if (query) requests.push(() => sourceCandidates(api,'bookmarks',query), () => sourceCandidates(api,'history',query));
  const results = await Promise.allSettled(requests.map(request => Promise.resolve().then(request)));
  const names = ['Open tabs', 'Bookmarks', 'History'];
  const warnings = results.flatMap((result,index) => result.status === 'rejected' ? [`${names[index]} unavailable`] : []);
  const [tabs=[], bookmarks=[], history=[]] = results.map(result => result.status === 'fulfilled' ? result.value : []);
  let suggestions = rankSuggestions(tabs,bookmarks,history,query);
  // Native text search cannot retrieve misspelled records; try a bounded recent sample only when there are no matches.
  if(!suggestions.length && query.length>=4 && query.length<=128) {
    const recent=await Promise.allSettled([
      Promise.resolve().then(()=>api.bookmarks.getRecent(100)),
      Promise.resolve().then(()=>api.history.search({text:'',startTime:0,maxResults:100}))
    ]);
    const [saved,visited]=recent.map(result=>result.status==='fulfilled'?result.value:[]);
    suggestions=rankSuggestions(tabs,[...bookmarks,...saved],[...history,...visited],query);
  }
  return {suggestions,domains:domainSuggestions(suggestions,query),warnings};
}
