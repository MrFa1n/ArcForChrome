export function destination(input) {
  if(typeof input!=='string' || input.length>8192) throw new Error('Invalid query');
  const value=input.trim();
  if(!value) return null;
  const hasScheme=/^[a-z][a-z\d+.-]*:/i.test(value) && !/^[\w.-]+:\d+(?:\/|$)/.test(value);
  try {
    const url=new URL(hasScheme?value:`https://${value}`);
    if(['http:','https:'].includes(url.protocol) && !/\s/.test(value) &&
      (url.hostname.includes('.') || url.hostname==='localhost' || url.hostname==='[::1]')) return {type:'url',url:url.href};
  } catch { /* Ordinary input is passed to Chrome's chosen search provider. */ }
  return {type:'search',text:value};
}
