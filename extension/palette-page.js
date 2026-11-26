import {
  interfaceLocale,
  pageTranslator,
  systemTranslator,
} from "./localization.js";
import { loadDesignTokens } from "./design-tokens.js";
import { launcherContext } from "./launcher-catalog.js";
import { GROUP_COLORS } from "./tab-groups.js";
import { mountPalette } from "./palette.js";
import { loadSites } from "./site-search.js";
const locale = await interfaceLocale(chrome);
const t = pageTranslator(document, locale);
const systemText = systemTranslator(locale);
const params = new URL(location.href).searchParams;
const actionPopup = ["action", "window"].includes(params.get("surface"));
if (actionPopup) document.documentElement.classList.add("action-popup");
const newTab = document.documentElement.classList.contains("new-tab");

async function open() {
  const tab = newTab
    ? await chrome.tabs.getCurrent()
    : await chrome.tabs.get(Number(params.get("tab")));
  const windowId = newTab ? tab?.windowId : Number(params.get("window"));
  if (!tab || tab.windowId !== windowId)
    throw new Error("Source tab is unavailable");
  const [tabs, sites, launcher, designTokens] = await Promise.all([
    chrome.tabs.query({ windowId }),
    loadSites(chrome, windowId),
    launcherContext(chrome),
    loadDesignTokens(),
  ]);
  const openTabs = tabs.filter((row) => !newTab || row.id !== tab.id);
  const actionTabId = newTab
    ? [...openTabs]
        .filter(
          (row) =>
            row.url && !["chrome://newtab/", location.href].includes(row.url),
        )
        .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0]?.id
    : tab.id;
  const mode = params.get("mode");
  mountPalette(openTabs, !newTab, {
    ...launcher,
    locale,
    designTokens,
    actionPopup,
    newTab,
    sites,
    favicons: true,
    sourceUrl: tab.url || "",
    sourceTabId: tab.id,
    actionTabId,
    activeGroupId: tabs.find((row) => row.id === actionTabId)?.groupId,
    groupColors: GROUP_COLORS,
    mode: ["edit", "commands"].includes(mode) ? mode : "search",
  });
}

open().catch((error) => {
  document.body.textContent = t(
    "Search could not open: {0}",
    systemText(error.message),
  );
});
