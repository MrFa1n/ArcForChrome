// Chrome's own favicon cache only. No third-party favicon service or host access.
const cache=new Map();
export async function faviconImages(api,urls,fetcher=fetch) {
  if(!Array.isArray(urls) || urls.length>20 || urls.some(url=>typeof url!=='string' || url.length>8192))throw Error('Invalid icon request');
  return Promise.all(urls.map(async value=>{
    let page;
    try {page=new URL(value);if(!['http:','https:'].includes(page.protocol) || page.username || page.password)return null;}catch{return null;}
    const endpoint=new URL(api.runtime.getURL('_favicon/'));
    endpoint.searchParams.set('pageUrl',page.origin+'/');endpoint.searchParams.set('size','32');
    const key=endpoint.href,previous=cache.get(key);
    if(previous && previous.expires>Date.now())return previous.promise;
    const promise=(async()=>{
      try {
        const response=await fetcher(key,{signal:AbortSignal.timeout(1500)});
        if(!response.ok || response.headers.get('content-type')?.split(';')[0]!=='image/png')return null;
        const bytes=new Uint8Array(await response.arrayBuffer());
        if(!bytes.length || bytes.length>65536)return null;
        return 'data:image/png;base64,'+btoa(String.fromCharCode(...bytes));
      } catch {return null;}
    })();
    cache.set(key,{expires:Date.now()+120000,promise});
    while(cache.size>100)cache.delete(cache.keys().next().value);
    return promise;
  }));
}
