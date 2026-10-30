const LIMIT = 8;
const ORDER = { tab: 0, bookmark: 1, history: 2 };

function candidateUrl(item, kind) {
  try {
    const url = new URL(item.url);
    if (kind !== 'tab' && !['https:', 'http:'].includes(url.protocol)) return null;
    return url.href;
  } catch { return kind === 'tab' ? '' : null; }
}

function relevance(item, query) {
  if (!query) return 0;
  const title = item.title.toLocaleLowerCase();
  const url = item.url.toLocaleLowerCase().replace(/^https?:\/\//, '');
  if (url.startsWith(query)) return 3;
  if (title.startsWith(query)) return 2;
  return 1;
}

export function rankSuggestions(tabs, bookmarks, history, input) {
  const query = input.trim().toLocaleLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
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
  return [...unique.values()].filter(item => terms.every(term => item.search.includes(term)))
    .sort((a,b) => ORDER[a.kind] - ORDER[b.kind] || relevance(b,query) - relevance(a,query) || b.lastVisitTime - a.lastVisitTime)
    .slice(0,LIMIT).map(({search, lastVisitTime, ...item}) => item);
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

export async function findSuggestions(api, windowId, input) {
  if (typeof input !== 'string' || input.length > 8192) throw new Error('Invalid query');
  const query = input.trim();
  const requests = [() => api.tabs.query({windowId})];
  if (query) requests.push(() => api.bookmarks.search(query), () => api.history.search({text:query, startTime:0, maxResults:50}));
  const results = await Promise.allSettled(requests.map(request => Promise.resolve().then(request)));
  const names = ['Open tabs', 'Bookmarks', 'History'];
  const warnings = results.flatMap((result,index) => result.status === 'rejected' ? [`${names[index]} unavailable`] : []);
  const [tabs=[], bookmarks=[], history=[]] = results.map(result => result.status === 'fulfilled' ? result.value : []);
  const suggestions = rankSuggestions(tabs,bookmarks,history,query);
  return {suggestions,domains:domainSuggestions(suggestions,query),warnings};
}
