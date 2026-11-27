import { matchPage, queryVariants } from "./search-match.js";

// Navigation only: this catalogue never reads settings or performs browser actions.
const PAGES = [
  [
    "manage-profile",
    "Chrome profile settings",
    "chrome://settings/manageProfile",
    ["профиль", "настройки профиля", "chrome profile", "profile settings"],
  ],
  [
    "settings",
    "Settings",
    "chrome://settings/",
    ["настройки", "параметры", "preferences", "browser settings"],
  ],
  [
    "extensions",
    "Extensions",
    "chrome://extensions/",
    ["расширения", "дополнения", "плагины", "addons", "plugins"],
  ],
  [
    "extension-shortcuts",
    "Extension keyboard shortcuts",
    "chrome://extensions/shortcuts",
    ["горячие клавиши", "сочетания клавиш", "клавиши расширений"],
  ],
  [
    "history",
    "History",
    "chrome://history/",
    ["история", "посещения", "browsing history"],
  ],
  [
    "downloads",
    "Downloads",
    "chrome://downloads/",
    ["загрузки", "скачанные файлы"],
  ],
  [
    "bookmarks",
    "Bookmarks",
    "chrome://bookmarks/",
    ["закладки", "диспетчер закладок", "bookmark manager"],
  ],
  [
    "passwords",
    "Password Manager",
    "chrome://password-manager/passwords",
    ["пароли", "менеджер паролей", "passwords"],
  ],
  [
    "privacy",
    "Privacy and security",
    "chrome://settings/privacy",
    ["конфиденциальность", "безопасность", "приватность"],
  ],
  [
    "site-settings",
    "Site settings",
    "chrome://settings/content",
    [
      "настройки сайтов",
      "разрешения сайтов",
      "камера",
      "микрофон",
      "уведомления",
      "permissions",
      "camera",
      "microphone",
      "notifications",
    ],
  ],
  [
    "appearance",
    "Appearance",
    "chrome://settings/appearance",
    ["оформление", "внешний вид", "тема", "theme"],
  ],
  [
    "search-engines",
    "Search engines",
    "chrome://settings/searchEngines",
    ["поисковые системы", "поисковик", "поисковая система", "site search"],
  ],
  [
    "languages",
    "Languages",
    "chrome://settings/languages",
    ["языки", "перевод", "translate"],
  ],
  [
    "accessibility",
    "Accessibility",
    "chrome://settings/accessibility",
    ["специальные возможности", "доступность"],
  ],
  [
    "performance",
    "Performance",
    "chrome://settings/performance",
    ["производительность", "экономия памяти", "memory saver", "energy saver"],
  ],
  [
    "startup",
    "On startup",
    "chrome://settings/onStartup",
    ["при запуске", "начальная страница", "startup pages"],
  ],
  [
    "default-browser",
    "Default browser",
    "chrome://settings/defaultBrowser",
    ["браузер по умолчанию"],
  ],
  [
    "autofill",
    "Autofill and passwords",
    "chrome://settings/autofill",
    ["автозаполнение", "адреса и платежи"],
  ],
  [
    "about",
    "About Chrome",
    "chrome://settings/help",
    ["о браузере", "обновление браузера", "обновить chrome", "update chrome"],
  ],
  [
    "version",
    "Chrome version",
    "chrome://version/",
    ["версия chrome", "версия браузера"],
  ],
  [
    "chrome-pages",
    "Chrome internal pages",
    "chrome://chrome-urls/",
    ["страницы chrome", "разделы браузера", "chrome urls"],
  ],
].map(([key, title, url, aliases]) => ({ key, title, url, aliases }));

function canonical(input) {
  try {
    const url = new URL(input);
    if (
      url.protocol !== "chrome:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    )
      return null;
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}
export function browserPageUrl(input) {
  const key = canonical(input);
  return key
    ? PAGES.find((page) => canonical(page.url) === key)?.url || null
    : null;
}
export function browserPageSuggestions(input) {
  const query = input.trim().toLocaleLowerCase();
  if (!query) return [];
  const variants = queryVariants(query);
  return PAGES.map((page) => {
    const match = matchPage(
      { ...page, search: [page.title, page.url, ...page.aliases].join(" ") },
      query,
    );
    const exact = variants.some((variant) => page.aliases.includes(variant));
    return { page, match, score: (match?.score || 0) + (exact ? 150 : 0) };
  })
    .filter((item) => item.match)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ page, match }) => ({
      kind: "browser-page",
      title: page.title,
      url: page.url,
      sources: ["browser-page"],
      ...(match.kind === "exact" ? {} : { match: match.kind }),
    }));
}
export function mergeBrowserPages(suggestions, tabs, input) {
  const rows = [...suggestions];
  for (const page of browserPageSuggestions(input)) {
    const open = tabs.find((tab) => canonical(tab.url) === canonical(page.url));
    const existing = rows.findIndex(
      (row) => canonical(row.url) === canonical(page.url),
    );
    if (existing >= 0) continue;
    rows.push(
      open
        ? {
            ...open,
            kind: "tab",
            title: open.title || page.title,
            url: page.url,
            sources: ["tab"],
          }
        : page,
    );
  }
  return rows;
}
export function browserPageCommands() {
  return PAGES.filter(
    (page) => !["history", "downloads"].includes(page.key),
  ).map((page) => ({
    command: `browser:${page.key}`,
    title:
      page.key === "settings" ? "Open Chrome settings" : `Open ${page.title}`,
    aliases: [page.url, ...page.aliases].join(" "),
  }));
}
export function browserCommandUrl(command) {
  return PAGES.find((page) => `browser:${page.key}` === command)?.url || null;
}
