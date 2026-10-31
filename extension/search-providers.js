// Explicit provider shortcuts requested by the user; ordinary queries still use Chrome's default.
export const BUILTIN_SITES=[
  {key:'provider:google',name:'Google',aliases:['g','google','гугл'],template:'https://www.google.com/search?q=%s'},
  {key:'provider:yandex',name:'Yandex',aliases:['ya','yandex','я','яндекс'],template:'https://yandex.ru/search/?text=%s'},
  {key:'provider:chatgpt',name:'ChatGPT',ai:true,aliases:['gpt','chatgpt','чатгпт'],template:'https://chatgpt.com/?q=%s'},
  {key:'provider:gemini',name:'Google AI Mode',ai:true,aliases:['gem','gemini','джемини'],template:'https://www.google.com/search?udm=50&q=%s'},
  {key:'provider:claude',name:'Claude',ai:true,aliases:['claude','cl','клод'],template:'https://claude.ai/new?q=%s'},
  {key:'provider:grok',name:'Grok',ai:true,aliases:['grok','грок'],template:'https://grok.com/?q=%s'},
  {key:'provider:perplexity',name:'Perplexity',ai:true,aliases:['pplx','perplexity','pp'],template:'https://www.perplexity.ai/search?q=%s'}
];
