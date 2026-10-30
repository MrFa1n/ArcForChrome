export const COMMANDS = [
  {command:'reload',title:'Reload current page',aliases:'refresh перезагрузить обновить'},
  {command:'duplicate',title:'Duplicate current tab',aliases:'дублировать копия'},
  {command:'copy-url',title:'Copy current URL',aliases:'скопировать адрес ссылку'},
  {command:'history',title:'Open browser history',aliases:'история'},
  {command:'downloads',title:'Open downloads',aliases:'загрузки'},
  {command:'reopen',title:'Reopen last closed tab',aliases:'restore восстановить закрытую'},
  {command:'settings',title:'Search settings',aliases:'site search настройки поиск'},
  {command:'new-window',title:'New browser window',aliases:'новое окно'}
];

export function commandSuggestions(query) {
  const terms=query.trim().toLocaleLowerCase().split(/\s+/);
  return COMMANDS.filter(item=>terms.every(term=>`${item.title} ${item.command} ${item.aliases}`.toLocaleLowerCase().includes(term)))
    .map(({command,title})=>({kind:'command',command,title,url:'Browser action',sources:['command']}));
}
