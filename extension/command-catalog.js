import { browserPageCommands } from "./browser-pages.js";
export const TARGET_COMMANDS = [
  {
    kind: "switch-group",
    prefixes: [
      "switch to space",
      "switch to group",
      "открыть пространство",
      "перейти в группу",
    ],
  },
  {
    kind: "group",
    prefixes: [
      "move to",
      "move tab to",
      "переместить в",
      "переместить вкладку в",
    ],
  },
  {
    kind: "bookmark",
    prefixes: ["pin to", "save to", "закрепить в", "сохранить в"],
  },
];

export const COMMANDS = [
  {
    command: "toggle-search-scope",
    title: "Switch group / window search",
    aliases: "группа окно область поиска",
  },
  {
    command: "promote-preview",
    title: "Keep preview as tab",
    aliases: "перенести предпросмотр во вкладку",
  },
  {
    command: "split-preview",
    title: "Keep preview in Split View",
    aliases: "перенести предпросмотр в разделённый экран",
  },
  {
    command: "previous-tab",
    title: "Previous tab",
    aliases: "last recent tab предыдущая вкладка вернуться",
  },
  {
    command: "restore-suggestions",
    title: "Restore hidden suggestions",
    aliases: "восстановить скрытые подсказки",
  },
  {
    command: "switch-space",
    title: "Switch to a space",
    aliases:
      "switch group spaces workspace открыть пространство перейти в группу",
  },
  {
    command: "new-space",
    title: "New space",
    aliases: "new group workspace создать пространство новая группа",
  },
  {
    command: "new-split",
    title: "New Split View",
    aliases: "split tabs разделить экран открыть рядом",
  },
  {
    command: "close-split",
    title: "Close Split View",
    aliases: "unsplit закрыть разделение убрать разделение",
  },
  {
    command: "open-sidebar",
    title: "Open sidebar",
    aliases: "side panel открыть боковую панель",
  },
  {
    command: "close-sidebar",
    title: "Close sidebar",
    aliases: "hide side panel закрыть боковую панель",
  },
  {
    command: "browser:extensions",
    title: "Manage extensions",
    aliases: "extension addons управление расширениями расширения",
  },
  { command: "pin-tab", title: "Pin tab", aliases: "закрепить вкладку" },
  { command: "unpin-tab", title: "Unpin tab", aliases: "открепить вкладку" },
  {
    command: "mute-tab",
    title: "Mute tab",
    aliases: "заглушить выключить звук вкладки",
  },
  {
    command: "unmute-tab",
    title: "Unmute tab",
    aliases: "включить звук вкладки",
  },
  {
    command: "notes",
    title: "Search / manage notes",
    aliases: "заметки найти текст список",
  },
  {
    command: "new-note",
    title: "New note",
    aliases: "создать новая заметка текст",
  },
  {
    command: "shortcuts",
    title: "All keyboard shortcuts",
    aliases: "все хоткеи сочетания клавиши справка",
  },
  {
    command: "quicklinks",
    title: "Manage quicklinks",
    aliases: "links shortcuts быстрые ссылки ярлыки",
  },
  {
    command: "save-quicklink",
    title: "Save selected page as quicklink",
    aliases: "shortcut create link сохранить быстрая ссылка",
  },
  {
    command: "search-with",
    title: "Search current query with…",
    aliases: "provider ai engine поисковик ии другой",
  },
  {
    command: "bookmark-tabs",
    title: "Bookmark selected tabs in a folder",
    aliases: "save add bookmarks сохранить закладки добавить папка",
  },
  {
    command: "remove-bookmarks",
    title: "Remove selected bookmarks from a folder",
    aliases: "delete bookmarks удалить закладки папка",
  },
  {
    command: "group-tabs",
    title: "Group selected tabs",
    aliases: "create add group создать группу объединить вкладки добавить",
  },
  {
    command: "ungroup-tabs",
    title: "Remove selected tabs from groups",
    aliases: "ungroup убрать вкладки из группы",
  },
  {
    command: "manage-groups",
    title: "Manage tab groups",
    aliases:
      "rename color collapse dissolve группы переименовать цвет свернуть разгруппировать",
  },
  {
    command: "activity",
    title: "Spotlight activity history",
    aliases: "action log journal история действия журнал spotlight",
  },
  {
    command: "recover-prompts",
    title: "Recover AI prompts",
    aliases:
      "restore retry draft last query восстановить промпт запрос последний черновики повторить",
  },
  {
    command: "clear-prompts",
    title: "Clear saved AI prompts",
    aliases: "forget очистить удалить промпты черновики",
  },
  {
    command: "closed-tabs",
    title: "Recently closed tabs",
    aliases: "recent closed sessions недавно закрытые вкладки",
  },
  {
    command: "edit-url",
    title: "Edit current URL",
    aliases: "address edit изменить адрес текущей вкладки",
  },
  {
    command: "order-tabs",
    title: "Arrange tabs",
    aliases: "move reorder position порядок вкладки переместить расположить",
  },
  {
    command: "reload",
    title: "Reload current page",
    aliases: "refresh перезагрузить обновить",
  },
  {
    command: "duplicate",
    title: "Duplicate current tab",
    aliases: "дублировать копия",
  },
  {
    command: "copy-url",
    title: "Copy current URL",
    aliases: "скопировать адрес ссылку",
  },
  { command: "history", title: "Open browser history", aliases: "история" },
  { command: "downloads", title: "Open downloads", aliases: "загрузки" },
  {
    command: "reopen",
    title: "Reopen last closed tab",
    aliases: "restore восстановить закрытую",
  },
  {
    command: "settings",
    title: "Search settings",
    aliases: "site search настройки поиск",
  },
  { command: "new-window", title: "New browser window", aliases: "новое окно" },
  { command: "new-tab", title: "New tab", aliases: "новая вкладка" },
  {
    command: "close-current-tab",
    title: "Close current tab",
    aliases: "закрыть текущую вкладку",
  },
  {
    command: "next-tab",
    title: "Next tab in tab strip",
    aliases: "следующая вкладка по порядку",
  },
  {
    command: "prior-tab-in-strip",
    title: "Previous tab in tab strip",
    aliases: "предыдущая вкладка по порядку",
  },
  {
    command: "page-back",
    title: "Go back one page",
    aliases: "вернуться на предыдущую страницу",
  },
  {
    command: "page-forward",
    title: "Go forward one page",
    aliases: "перейти на следующую страницу",
  },
  {
    command: "reload-bypass-cache",
    title: "Reload without cache",
    aliases: "обновить без кэша",
  },
  { command: "zoom-in", title: "Zoom in", aliases: "увеличить масштаб" },
  { command: "zoom-out", title: "Zoom out", aliases: "уменьшить масштаб" },
  {
    command: "zoom-reset",
    title: "Reset page zoom",
    aliases: "сбросить масштаб страницы",
  },
  {
    command: "new-incognito",
    title: "New incognito window",
    aliases: "новое окно инкогнито",
  },
  {
    command: "next-window",
    title: "Switch to next Chrome window",
    aliases: "переключиться на следующее окно chrome",
  },
  {
    command: "maximize-window",
    title: "Maximize current window",
    aliases: "развернуть текущее окно",
  },
  {
    command: "minimize-window",
    title: "Minimize current window",
    aliases: "свернуть текущее окно",
  },
  {
    command: "restore-window-size",
    title: "Restore current window size",
    aliases: "восстановить размер текущего окна",
  },
  {
    command: "fullscreen-window",
    title: "Toggle window fullscreen",
    aliases: "переключить полноэкранный режим окна",
  },
  {
    command: "detach-tab",
    title: "Move current tab to a new window",
    aliases: "переместить текущую вкладку в новое окно отделить",
  },
  {
    command: "toggle-page-navigation",
    title: "Toggle page navigation mode",
    aliases:
      "vim scroll keyboard навигация по странице прокрутка вим клавиатура",
  },
  ...browserPageCommands().filter(
    (row) => row.command !== "browser:extensions",
  ),
];

export function commandSuggestions(query, translateTitle = (title) => title) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/);
  return COMMANDS.filter((item) => {
    const search =
      `${item.title} ${translateTitle(item.title)} ${item.command} ${item.aliases}`.toLocaleLowerCase();
    return terms.every((term) => search.includes(term));
  }).map(({ command, title }) => ({
    kind: "command",
    command,
    title,
    url: "Browser action",
    sources: ["command"],
  }));
}
