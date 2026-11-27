import {
  KEYBOARD_SHORTCUTS_SETTING,
  shortcutText,
  validShortcut,
} from "./keyboard-shortcuts.js";
import { COMMANDS, TARGET_COMMANDS } from "./command-catalog.js";
// Shared by injected and protected-page palettes; data only, no remote code.
export const ACTIONS = [
  {
    id: "toggle-search-scope",
    title: "Switch group / window search",
    aliases: "группа окно область поиска",
  },
  {
    id: "preview",
    title: "Open temporary preview",
    aliases: "временный предпросмотр",
  },
  {
    id: "route",
    title: "Route this domain to a group",
    aliases: "отправлять домен в группу",
  },
  {
    id: "remove-route",
    title: "Clear route for this domain",
    aliases: "убрать маршрут домена",
  },
  {
    id: "copy-tabs",
    title: "Copy links from selected tabs",
    aliases: "скопировать ссылки отмеченных вкладок",
  },
  {
    id: "copy-markdown",
    title: "Copy links as Markdown",
    aliases: "копировать ссылки маркдаун",
  },
  { id: "hide", title: "Hide this suggestion", aliases: "скрыть подсказку" },
  { id: "paste-url", title: "Paste and go", aliases: "вставить и открыть" },
  {
    id: "instant",
    title: "Open first web result via DuckDuckGo",
    aliases: "мгновенная ссылка первый результат",
  },
  { id: "new-note", title: "New note", aliases: "создать заметку текст" },
  {
    id: "notes",
    title: "Search / manage notes",
    aliases: "заметки найти список",
  },
  {
    id: "shortcuts",
    title: "All keyboard shortcuts",
    aliases: "все хоткеи сочетания клавиши справка",
  },
  {
    id: "commands",
    title: "All browser commands",
    shortcut: ">",
    aliases: "все команды браузера",
  },
  { id: "edit-note", title: "Edit note", aliases: "изменить заметку" },
  { id: "copy-note", title: "Copy note text", aliases: "копировать заметку" },
  { id: "remove-note", title: "Delete note", aliases: "удалить заметку" },
  {
    id: "save-note",
    title: "Save note",
    shortcut: "⌘/Ctrl ↵",
    aliases: "сохранить заметку",
  },
  { id: "open", title: "Open / Run", shortcut: "↵" },
  { id: "new", title: "Open in a new tab", shortcut: "⌘/Ctrl ↵" },
  { id: "background", title: "Open in background", shortcut: "⇧ ↵" },
  { id: "copy", title: "Copy URL / Result" },
  { id: "move", title: "Move selected tab…", shortcut: "Alt ←/→" },
  { id: "group", title: "Add to a tab group…", key: "g", shortcut: "⌘/Ctrl G" },
  {
    id: "ungroup",
    title: "Remove from tab groups",
    key: "g",
    shift: true,
    shortcut: "⌘/Ctrl ⇧ G",
  },
  {
    id: "manage-groups",
    title: "Manage tab groups…",
    key: "g",
    alt: true,
    shortcut: "⌘/Ctrl Alt G",
  },
  {
    id: "bookmark",
    title: "Save in a bookmark folder…",
    key: "d",
    shortcut: "⌘/Ctrl D",
  },
  {
    id: "remove-bookmark",
    title: "Remove from a bookmark folder…",
    key: "d",
    shift: true,
    shortcut: "⌘/Ctrl ⇧ D",
  },
  { id: "duplicate", title: "Duplicate selected tab" },
  { id: "save-link", title: "Save as quicklink…" },
  { id: "rename-link", title: "Rename quicklink…" },
  { id: "remove-link", title: "Remove quicklink" },
  { id: "provider", title: "Search this query with…" },
];

export const SHORTCUTS = [
  {
    id: "global-previous",
    title: "Switch to previous tab",
    global: "previous-tab",
    description: "Return to the last used tab in this window.",
    aliases: "предыдущая вкладка",
  },
  {
    id: "global-search",
    title: "Open / close Spotlight",
    global: "open-search",
    description:
      "Global in Chrome. Check or change the assigned shortcut in chrome://extensions/shortcuts.",
    aliases: "поиск открыть закрыть spotlight",
  },
  {
    id: "global-commands",
    title: "Open browser commands",
    global: "open-commands",
    description:
      "Open the command catalog. Slash followed by space also opens it from Search.",
    aliases: "команды действия",
  },
  {
    id: "global-edit",
    title: "Edit current URL",
    global: "edit-address",
    description:
      "Global in Chrome. Enter replaces the source page; unchanged URL reloads it.",
    aliases: "адрес изменить текущий",
  },
  {
    id: "actions",
    title: "Actions for selected result",
    shortcut: "⌘/Ctrl K",
    description:
      "Inside Spotlight. Toggle the contextual actions; Esc returns to the same query and result.",
    aliases: "действия меню",
  },
  {
    id: "select",
    title: "Choose previous / next result",
    shortcut: "↑ / ↓",
    description:
      "With the query field focused. Changes the highlighted result without navigating.",
    aliases: "выбрать результат стрелки",
  },
  {
    id: "mark",
    title: "Mark / unmark an open tab",
    shortcut: "⇧ Space",
    description:
      "Search or Arrange. Collect tabs across queries for group and bookmark actions; at most 100.",
    aliases: "отметить выделить вкладки",
  },
  ...ACTIONS.filter((action) =>
    [
      "open",
      "new",
      "background",
      "group",
      "ungroup",
      "manage-groups",
      "bookmark",
      "remove-bookmark",
    ].includes(action.id),
  ).map((action) => ({
    id: action.id,
    title: action.title,
    shortcut: action.shortcut,
    description: ["group", "ungroup", "bookmark", "remove-bookmark"].includes(
      action.id,
    )
      ? "Inside Spotlight. Uses marked tabs; otherwise the highlighted/source tab."
      : "Inside Spotlight. Applies to the selected result; navigation modifiers affect URL/search results.",
  })),
  {
    id: "current",
    title: "Open in the source tab",
    shortcut: "Alt ↵",
    description:
      "URL/search result. Replaces the source page instead of creating another tab.",
    aliases: "текущая заменить страница",
  },
  {
    id: "move",
    title: "Move a tab one position",
    shortcut: "Alt ←/→/↑/↓",
    description:
      "Search or Arrange with an open tab selected. Horizontal and vertical keys both work; pin/group boundaries are preserved.",
    aliases: "переместить вкладку порядок",
  },
  {
    id: "move-edge",
    title: "Move a tab to the start / end",
    shortcut: "Alt ⇧ ←/→/↑/↓",
    description:
      "Search or Arrange. Moves within the same pin/group section. Alt+Home / Alt+End also work.",
    aliases: "начало конец вкладки",
  },
  {
    id: "move-home-end",
    title: "Move a tab to the start / end (Home / End)",
    shortcut: "Alt Home / End",
    description:
      "Search or Arrange with an open tab selected; same pin/group boundaries.",
    aliases: "начало конец вкладки",
  },
  {
    id: "complete",
    title: "Complete a URL / enter site search / open Commands",
    shortcut: "Tab",
    description:
      "Query field: selected URL completes the address; site keyword enters site search; empty Search opens Commands. Otherwise cycles controls.",
    aliases: "подставить адрес сайт команды",
  },
  {
    id: "focus",
    title: "Focus Actions / resize handle",
    shortcut: "Tab / ⇧ Tab",
    description:
      "Cycles query, Actions and resize controls when Tab is not completing a URL/site. Shift+Tab from the query reaches resize.",
    aliases: "фокус размер угол",
  },
  {
    id: "escape",
    title: "Back / clear marks / close Spotlight",
    shortcut: "Esc",
    description:
      "Leaves the current scope; in Search clears marks before closing. In the note editor cancels unsaved edits.",
    aliases: "назад закрыть отменить",
  },
  {
    id: "backspace",
    title: "Leave an empty search scope",
    shortcut: "Backspace",
    description:
      "With an empty scoped query. Returns to Search or the previous provider/action scope.",
    aliases: "назад пустой поиск",
  },
  {
    id: "position",
    title: "Move Spotlight on the page",
    shortcut: "Ctrl Alt ←/→/↑/↓",
    description:
      "Inside Spotlight. Moves by 16 pixels, independently of tab ordering.",
    aliases: "позиция окно передвинуть поиск",
  },
  {
    id: "position-large",
    title: "Move Spotlight in larger steps",
    shortcut: "Ctrl Alt ⇧ ←/→/↑/↓",
    description: "Inside Spotlight. Moves by 64 pixels within the viewport.",
    aliases: "позиция окно крупный шаг",
  },
  {
    id: "reset",
    title: "Reset Spotlight position and size",
    shortcut: "Ctrl Alt 0",
    description: "Inside Spotlight. Resets both position and custom size.",
    aliases: "сброс положение размер",
  },
  {
    id: "resize",
    title: "Resize Spotlight",
    shortcut: "↑/↓/←/→ · ⇧",
    description:
      "Resize handle focused: arrows change size by 16 pixels; Shift gives 64-pixel steps. Enter resets size.",
    aliases: "размер угол растянуть",
  },
  {
    id: "resize-reset",
    title: "Reset Spotlight size",
    shortcut: "↵",
    description:
      "Resize handle focused. Restores the automatic size without resetting a manually chosen position.",
    aliases: "размер сброс",
  },
  {
    id: "note-save",
    title: "Save note",
    shortcut: "⌘/Ctrl ↵",
    description:
      "Note editor only. Saves the title and multiline body locally. Plain Enter in the body inserts a new line.",
    aliases: "заметка сохранить",
  },
  {
    id: "prefix-commands",
    title: "Browse all browser commands",
    shortcut: ">",
    description:
      "At the start of Search. Includes settings, Chrome sections, notes and browser actions.",
    aliases: "команды браузер все",
  },
  {
    id: "prefix-order",
    title: "Arrange tabs",
    shortcut: "@",
    description:
      "At the start of Search. Shows actual tab-strip order and optional name/URL filter.",
    aliases: "порядок вкладки",
  },
  {
    id: "prefix-closed",
    title: "Recently closed tabs",
    shortcut: "<",
    description:
      "At the start of Search. Enter restores the selected native browser session.",
    aliases: "закрытые восстановить",
  },
  {
    id: "prefix-drafts",
    title: "Recover an AI prompt",
    shortcut: "?",
    description:
      "At the start of Search. Recover a session copy, then retry or change its provider.",
    aliases: "ии промпт восстановить",
  },
  {
    id: "prefix-links",
    title: "Find named quicklinks",
    shortcut: "$",
    description:
      "At the start of Search. Search, open or manage your local named links.",
    aliases: "быстрые ссылки",
  },
  {
    id: "prefix-groups",
    title: "Create / choose a tab group",
    shortcut: "#",
    description:
      "At the start of Search. Type a new or existing group name; uses marked/highlighted/source tabs.",
    aliases: "группы вкладки",
  },
  {
    id: "prefix-bookmarks",
    title: "Choose a bookmark folder",
    shortcut: "*",
    description:
      "At the start of Search. Save marked/highlighted/source tabs in a chosen folder.",
    aliases: "закладки папка",
  },
  {
    id: "prefix-notes",
    title: "Search local notes",
    shortcut: ":",
    description:
      "At the start of Search. Search note titles and text; Enter edits a note, Cmd/Ctrl+K offers note actions.",
    aliases: "заметки текст поиск",
  },
];

export const EDITABLE_SHORTCUTS = [
  { id: "actions", title: "Actions for selected result", key: "k" },
  ...ACTIONS.filter(({ key }) => key),
].map((binding) => ({ shift: false, alt: false, ...binding }));

export function resolveShortcuts(overrides) {
  const bindings = EDITABLE_SHORTCUTS.map((binding) => {
    const override = overrides?.[binding.id];
    if (!validShortcut(override)) return binding;
    const { key, shift, alt } = override;
    return { ...binding, key, shift, alt };
  });
  return new Set(bindings.map(shortcutText)).size === bindings.length
    ? bindings
    : EDITABLE_SHORTCUTS;
}

export async function launcherContext(api) {
  let commands = null;
  try {
    if (api.commands?.getAll) commands = await api.commands.getAll();
  } catch {
    /* Show an explicit unknown binding rather than guess. */
  }
  const settings = await api.storage?.local
    ?.get?.(KEYBOARD_SHORTCUTS_SETTING)
    .catch(() => ({}));
  const bindings = new Map(
    resolveShortcuts(settings?.[KEYBOARD_SHORTCUTS_SETTING]).map((binding) => [
      binding.id,
      binding,
    ]),
  );
  const withShortcut = (row) => {
    const binding = bindings.get(row.id);
    return binding
      ? { ...row, ...binding, shortcut: shortcutText(binding) }
      : row;
  };
  return {
    actionsBinding: bindings.get("actions"),
    actions: ACTIONS.map(withShortcut),
    targetCommands: TARGET_COMMANDS,
    commands: COMMANDS.filter(
      (row) =>
        !row.command.startsWith("browser:") ||
        row.command === "browser:extensions",
    ),
    shortcuts: SHORTCUTS.map((row) =>
      !row.global
        ? withShortcut(row)
        : {
            ...row,
            shortcut: commands
              ? commands.find((command) => command.name === row.global)
                  ?.shortcut || "Not assigned"
              : "Check Chrome shortcuts",
          },
    ),
  };
}
