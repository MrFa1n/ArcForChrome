const EN = "`qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const RU = 'ёйцукенгшщзхъфывапролджэячсмитьбю';

function normalize(value) {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/\p{M}/gu,'');
}

export function queryVariants(input) {
  const query = input.trim().toLocaleLowerCase();
  if (!/^[\p{L}\d\s]+$/u.test(query) || query.length > 128) return [query];
  const [from,to] = /[а-яё]/u.test(query) ? [RU,EN] : [EN,RU];
  const switched = [...query].map(char => from.includes(char) ? to[from.indexOf(char)] : char).join('');
  return [...new Set([query,switched])];
}

function nearWord(a,b) {
  if (Math.abs(a.length-b.length)>1) return false;
  if (a.length===b.length) {
    const mismatches=[];
    for(let index=0;index<a.length;index++) if(a[index]!==b[index]) mismatches.push(index);
    if(mismatches.length<=1) return true;
    const [first,second]=mismatches;
    return mismatches.length===2 && second===first+1 && a[first]===b[second] && a[second]===b[first];
  }
  const [short,long]=a.length<b.length?[a,b]:[b,a];
  let left=0,right=0;
  while(left<short.length && right<long.length) {
    if(short[left]===long[right]) left++; else if(right>left) return false;
    right++;
  }
  return true;
}

function scoreVariant(text, words, query, allowTypos) {
  let score=0,typo=false;
  for(const term of query.split(/\s+/).filter(Boolean)) {
    if(text.includes(term)) {score+=20;continue;}
    if(!allowTypos || term.length<4 || term.length>32 || !words.some(word => word.length>=4 && nearWord(term,word))) return null;
    score+=5;typo=true;
  }
  return {score,typo};
}

export function matchPage(item,input) {
  const text=normalize(item.search || `${item.title || ''} ${item.url || ''}`);
  let host='';
  try {host=normalize(new URL(item.url).hostname.replace(/^www\./,''));} catch { /* Untitled/internal tabs still match by title. */ }
  const words=[...(text.match(/[\p{L}\p{N}]+/gu) || []),host];
  let best=null;
  for(const [index,variant] of queryVariants(input).entries()) {
    const query=normalize(variant);
    const match=scoreVariant(text,words,query,input.length<=128);
    if(!match) continue;
    let score=match.score-(index?8:0);
    if(query && host===query) score+=100;
    else if(query && host.startsWith(query)) score+=80;
    const title=normalize(item.title || '');
    if(query && title===query) score+=70;
    else if(query && title.startsWith(query)) score+=50;
    const result={score,kind:index?'layout':match.typo?'typo':'exact'};
    if(!best || result.score>best.score) best=result;
  }
  return best;
}
