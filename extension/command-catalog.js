import {browserPageCommands} from './browser-pages.js';
export const COMMANDS = [
  {command:'group-tabs',title:'Group selected tabs',aliases:'create add group создать группу объединить вкладки добавить'},
  {command:'ungroup-tabs',title:'Remove selected tabs from groups',aliases:'ungroup убрать вкладки из группы'},
  {command:'manage-groups',title:'Manage tab groups',aliases:'rename color collapse dissolve группы переименовать цвет свернуть разгруппировать'},
  {command:'activity',title:'Spotlight activity history',aliases:'action log journal история действия журнал spotlight'},
  {command:'recover-prompts',title:'Recover AI prompts',aliases:'restore retry draft last query восстановить промпт запрос последний черновики повторить'},
  {command:'clear-prompts',title:'Clear saved AI prompts',aliases:'forget очистить удалить промпты черновики'},
  {command:'closed-tabs',title:'Recently closed tabs',aliases:'recent closed sessions недавно закрытые вкладки'},
  {command:'edit-url',title:'Edit current URL',aliases:'address edit изменить адрес текущей вкладки'},
  {command:'order-tabs',title:'Arrange tabs',aliases:'move reorder position порядок вкладки переместить расположить'},
  {command:'reload',title:'Reload current page',aliases:'refresh перезагрузить обновить'},
  {command:'duplicate',title:'Duplicate current tab',aliases:'дублировать копия'},
  {command:'copy-url',title:'Copy current URL',aliases:'скопировать адрес ссылку'},
  {command:'history',title:'Open browser history',aliases:'история'},
  {command:'downloads',title:'Open downloads',aliases:'загрузки'},
  {command:'reopen',title:'Reopen last closed tab',aliases:'restore восстановить закрытую'},
  {command:'settings',title:'Search settings',aliases:'site search настройки поиск'},
  {command:'new-window',title:'New browser window',aliases:'новое окно'},
  ...browserPageCommands()
];

export function commandSuggestions(query) {
  const terms=query.trim().toLocaleLowerCase().split(/\s+/);
  return COMMANDS.filter(item=>terms.every(term=>`${item.title} ${item.command} ${item.aliases}`.toLocaleLowerCase().includes(term)))
    .map(({command,title})=>({kind:'command',command,title,url:'Browser action',sources:['command']}));
}
