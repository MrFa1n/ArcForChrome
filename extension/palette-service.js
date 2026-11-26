import {
  learningEnabled,
  preferredProvider,
  rankCommands,
  selectionSignal,
} from "./ai-learning.js";
import { loadDesignTokens } from "./design-tokens.js";
import { rememberTabChoice } from "./search-preferences.js";
import { launcherContext } from "./launcher-catalog.js";
import { noteSuggestions, noteAction } from "./notes.js";
import { faviconImages } from "./favicons.js";
import { calculate } from "./calculator.js";
import { quicklinks, changeQuicklink } from "./quicklinks.js";
import { listActivity } from "./activity-store.js";
import { bookmarkFolders, changeBookmarks } from "./tab-bookmarks.js";
import {
  GROUP_COLORS,
  groupSuggestions,
  manageGroupSuggestions,
  groupActionSuggestions,
  changeGroup,
} from "./tab-groups.js";
import { recordActivity } from "./activity-store.js";
import { BUILTIN_SITES } from "./search-providers.js";
import {
  savePrompt,
  listPrompts,
  recoverPrompt,
  clearPrompts,
} from "./prompt-recovery.js";
import { browserCommandUrl } from "./browser-pages.js";
import { orderSuggestions, moveTab } from "./tab-order.js";
import { destination } from "./model.js";
import { findSuggestions } from "./suggestions.js";
import { loadSites, siteDestination, rememberSite } from "./site-search.js";
import { COMMANDS, commandSuggestions } from "./command-catalog.js";

import {
  copyTabs,
  editHidden,
  hiddenSuggestions,
  publicUrl,
} from "./palette-extras.js";

import {
  destinationGroup,
  saveDomainRoute,
  openPreview,
  promotePreview,
} from "./workspace-navigation.js";

export async function openPalette(api, mount, mode = "search") {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const [tabs, sites, launcher, designTokens] = await Promise.all([
    api.tabs.query({ windowId: tab.windowId }),
    loadSites(api, tab.windowId),
    launcherContext(api),
    loadDesignTokens(),
  ]);
  const context = {
    ...launcher,
    designTokens,
    mode,
    sourceUrl: tab.url || "",
    sourceTabId: tab.id,
    activeGroupId: tab.groupId,
    groupColors: GROUP_COLORS,
    sites,
    favicons: true,
  };
  try {
    await api.scripting.executeScript({
      target: { tabId: tab.id },
      func: mount,
      args: [
        tabs.map(({ id, title, url, lastAccessed, groupId }) => ({
          id,
          title,
          url,
          lastAccessed,
          groupId,
        })),
        false,
        context,
      ],
    });
  } catch {
    const url = `${api.runtime.getURL("palette.html")}?window=${tab.windowId}&tab=${tab.id}&mode=${mode}`;
    const width = 480;
    const height = 420;
    const sourceWindow = await api.windows
      .get?.(tab.windowId)
      .catch(() => null);
    const position =
      sourceWindow &&
      [
        sourceWindow.left,
        sourceWindow.top,
        sourceWindow.width,
        sourceWindow.height,
      ].every(Number.isFinite)
        ? {
            left: Math.round(
              sourceWindow.left + (sourceWindow.width - width) / 2,
            ),
            top: Math.round(
              sourceWindow.top + (sourceWindow.height - height) / 2,
            ),
          }
        : {};
    await api.windows.create({
      type: "popup",
      width,
      height,
      ...position,
      url: `${url}&surface=window`,
    });
  }
}

function sourceContext(api, sender) {
  if (sender.id !== api.runtime.id) throw new Error("Unknown sender");
  if (sender.tab) {
    const newTab =
      typeof sender.url === "string" &&
      sender.url === api.runtime.getURL("newtab.html");
    return {
      windowId: sender.tab.windowId,
      tabId: sender.tab.id,
      incognito: sender.tab.incognito === true,
      ...(newTab ? { newTab: true } : {}),
    };
  }
  const url = new URL(sender.url || "about:blank");
  const expected = new URL(api.runtime.getURL("palette.html"));
  if (
    url.protocol !== expected.protocol ||
    url.host !== expected.host ||
    url.pathname !== expected.pathname
  )
    throw new Error("Unknown search page");
  const windowId = Number(url.searchParams.get("window"));
  if (
    !url.searchParams.has("window") ||
    !Number.isInteger(windowId) ||
    windowId < 0
  )
    throw new Error("Invalid window");
  const tabId = url.searchParams.has("tab")
    ? Number(url.searchParams.get("tab"))
    : undefined;
  return { windowId, tabId };
}

async function sourceTab(api, context) {
  if (!Number.isInteger(context.tabId))
    throw new Error("Source tab is unavailable");
  const tab = await api.tabs.get(context.tabId);
  if (tab.windowId !== context.windowId)
    throw new Error("Source tab moved to another window");
  return tab;
}

async function removeSearchTab(api, context) {
  if (!context.newTab) return;
  const tab = await api.tabs.get(context.tabId).catch(() => null);
  if (
    tab?.windowId === context.windowId &&
    [api.runtime.getURL("newtab.html"), "chrome://newtab/"].includes(tab.url) &&
    !tab.pendingUrl
  )
    await api.tabs.remove(tab.id).catch(() => {});
}

async function navigate(
  api,
  context,
  input,
  target = "new",
  wholeWindow = false,
) {
  if (!["new", "background", "current"].includes(target))
    throw new Error("Invalid navigation target");
  const parsed = destination(input);
  if (!parsed) return;
  const groupId =
    target !== "current" || context.newTab
      ? await destinationGroup(
          api,
          context.windowId,
          context.tabId,
          context.newTab,
          parsed.url,
          !wholeWindow,
        ).catch(() => null)
      : null;
  const placeInGroup = async (id) => {
    if (groupId !== null)
      await api.tabs.group({ groupId, tabIds: [id] }).catch(() => {});
  };
  if (target === "current") {
    const tab = await sourceTab(api, context);
    if (input.trim() === tab.url) {
      await api.tabs.reload(tab.id);
      return;
    }
    await placeInGroup(tab.id);
    if (parsed.type === "url") {
      if (parsed.url === tab.url) await api.tabs.reload(tab.id);
      else await api.tabs.update(tab.id, { url: parsed.url });
    } else await api.search.query({ text: parsed.text, tabId: tab.id });
    return;
  }
  const tab = await api.tabs.create({
    windowId: context.windowId,
    active: target !== "background",
    ...(parsed.type === "url" ? { url: parsed.url } : {}),
  });
  await placeInGroup(tab.id);
  if (parsed.type === "search")
    await api.search.query({ text: parsed.text, tabId: tab.id });
}

async function closedSuggestions(api, query) {
  const sessions = await api.sessions.getRecentlyClosed({ maxResults: 25 });
  const terms = query.trim().toLocaleLowerCase().split(/\s+/);
  return sessions
    .filter(
      (item) =>
        item.tab?.sessionId &&
        terms.every((term) =>
          `${item.tab.title || ""} ${item.tab.url || ""}`
            .toLocaleLowerCase()
            .includes(term),
        ),
    )
    .slice(0, 8)
    .map(({ tab }) => ({
      kind: "closed",
      sessionId: tab.sessionId,
      title: tab.title || tab.url || "Closed tab",
      url: tab.url || "",
      sources: ["closed"],
    }));
}

async function restore(api, sessionId) {
  const available = await api.sessions.getRecentlyClosed({ maxResults: 25 });
  const item = available.find(
    (item) =>
      item.tab?.sessionId && (!sessionId || item.tab.sessionId === sessionId),
  );
  if (!item) throw new Error("Closed tab is no longer available");
  const restored = await api.sessions.restore(item.tab.sessionId);
  if (restored?.tab?.windowId !== undefined)
    await api.windows.update(restored.tab.windowId, { focused: true });
}

async function executeAction(api, context, id) {
  if (!COMMANDS.some((item) => item.command === id))
    throw new Error("Unknown command");
  const browserUrl = browserCommandUrl(id);
  if (browserUrl) return navigate(api, context, browserUrl);
  if (id === "open-sidebar" || id === "close-sidebar") {
    const method = id === "open-sidebar" ? "open" : "close";
    if (typeof api.sidePanel?.[method] !== "function")
      throw new Error(
        "This version of Chrome cannot perform that sidebar action",
      );
    await api.sidePanel[method]({ windowId: context.windowId });
    return;
  }
  if (id === "previous-tab") {
    const tabs = await api.tabs.query({ windowId: context.windowId });
    const candidate = tabs
      .filter(
        (tab) =>
          tab.id !== context.tabId &&
          (!tab.active || context.newTab) &&
          tab.url !== api.runtime.getURL("newtab.html") &&
          tab.url !== "chrome://newtab/",
      )
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
    if (!candidate) throw new Error("No previous tab in this window");
    await api.tabs.update(candidate.id, { active: true });
    await api.windows.update(context.windowId, { focused: true });
    await removeSearchTab(api, context);
    return;
  }
  if (id === "promote-preview" || id === "split-preview")
    return promotePreview(api, context, id === "split-preview");
  if (id === "restore-suggestions") return editHidden(api, null);
  if (id === "activity")
    return api.tabs.create({
      windowId: context.windowId,
      url: api.runtime.getURL("activity.html"),
    });
  if (id === "clear-prompts") return clearPrompts(api);
  if (
    [
      "notes",
      "new-note",
      "shortcuts",
      "quicklinks",
      "save-quicklink",
      "search-with",
      "order-tabs",
      "closed-tabs",
      "edit-url",
      "recover-prompts",
      "group-tabs",
      "manage-groups",
      "ungroup-tabs",
      "bookmark-tabs",
      "remove-bookmarks",
    ].includes(id)
  )
    throw new Error("Choose this mode in the command bar");
  if (id === "reopen") return restore(api);
  if (id === "settings") return api.runtime.openOptionsPage();
  if (id === "new-window") return api.windows.create({ type: "normal" });
  if (id === "history" || id === "downloads")
    return api.tabs.create({
      windowId: context.windowId,
      url: `chrome://${id}/`,
    });
  const tab = await sourceTab(api, context);
  if (id === "reload") await api.tabs.reload(tab.id);
  if (id === "duplicate") await api.tabs.duplicate(tab.id);
  if (id === "copy-url") return { copyText: tab.url || "" };
}

async function performAction(api, message, context, publish, onAiLaunch) {
  if (message.type === "palette:extra") {
    if (message.action === "route")
      return saveDomainRoute(
        api,
        context.windowId,
        message.url,
        message.groupId,
      );
    if (message.action === "preview")
      return openPreview(api, context, message.url);
    if (message.action === "copy-tabs")
      return copyTabs(
        api,
        context.windowId,
        message.tabIds,
        message.markdown === true,
      );
    if (message.action === "hide") return editHidden(api, message.url);
    if (message.action === "instant") {
      if (
        typeof message.query !== "string" ||
        !message.query.trim() ||
        message.query.length > 2048
      )
        throw new Error("Enter a search query");
      const url = new URL("https://duckduckgo.com/");
      url.searchParams.set("q", String.fromCharCode(92) + message.query.trim());
      return navigate(
        api,
        context,
        url.href,
        context.newTab ? "current" : "new",
      );
    }
    if (message.action === "paste-url") {
      const url = publicUrl(message.url);
      if (!url)
        throw new Error("The clipboard does not contain an HTTP(S) address");
      return navigate(
        api,
        context,
        url.href,
        context.newTab ? "current" : "new",
      );
    }
    throw new Error("Unknown search action");
  }
  if (message.type === "palette:icons")
    return { images: await faviconImages(api, message.urls) };
  if (message.type === "palette:suggest") {
    if (typeof message.query !== "string" || message.query.length > 8192)
      throw new Error("Invalid query");
    if (message.mode === "notes")
      return {
        suggestions: await noteSuggestions(api, message.query),
        domains: [],
        warnings: [],
      };
    if (message.mode === "quicklinks")
      return {
        suggestions: await quicklinks(api, message.query),
        domains: [],
        warnings: [],
      };
    if (message.mode === "bookmark-folders") {
      const suggestions = await bookmarkFolders(
        api,
        context.windowId,
        message.query,
        message.operation,
        message.tabIds,
      );
      return {
        suggestions,
        domains: [],
        warnings: suggestions.length
          ? []
          : [
              message.operation === "remove"
                ? "No matching bookmarks in writable folders"
                : "No matching writable folders",
            ],
      };
    }
    if (message.mode === "groups")
      return {
        suggestions: await groupSuggestions(
          api,
          context.windowId,
          message.query,
        ),
        domains: [],
        warnings: [],
      };
    if (["group-switch", "group-route"].includes(message.mode)) {
      const groups = await manageGroupSuggestions(
        api,
        context.windowId,
        message.query,
      );
      return {
        suggestions: groups.map((row) => ({
          ...row,
          kind: message.mode,
          url:
            message.mode === "group-route"
              ? "Route domain to group"
              : "Switch to group",
        })),
        domains: [],
        warnings: [],
      };
    }
    if (message.mode === "group-manage")
      return {
        suggestions: await manageGroupSuggestions(
          api,
          context.windowId,
          message.query,
        ),
        domains: [],
        warnings: [],
      };
    if (message.mode === "group-actions")
      return {
        suggestions: await groupActionSuggestions(
          api,
          context.windowId,
          message.groupId,
          message.query,
        ),
        domains: [],
        warnings: [],
      };
    if (message.mode === "drafts")
      return {
        suggestions: await listPrompts(
          api,
          message.query,
          await learningEnabled(api, context),
        ),
        domains: [],
        warnings: [],
      };
    if (message.mode === "order")
      return {
        suggestions: await orderSuggestions(
          api,
          context.windowId,
          message.query,
          message.tabId,
        ),
        domains: [],
        warnings: [],
      };
    if (message.mode === "commands")
      return {
        suggestions: await rankCommands(
          api,
          context,
          message.query,
          commandSuggestions(message.query),
        ),
        domains: [],
        warnings: [],
      };
    if (message.mode === "closed")
      return {
        suggestions: await closedSuggestions(api, message.query),
        domains: [],
        warnings: [],
      };
    const hidden = new Set(await hiddenSuggestions(api).catch(() => []));
    const visible = (row) => row.kind === "tab" || !hidden.has(row.url);
    const publishVisible =
      publish &&
      ((result) =>
        publish({
          ...result,
          suggestions: result.suggestions.filter(visible),
          domains: result.domains.filter(visible),
        }));
    const groupId =
      message.scope === "group"
        ? await destinationGroup(
            api,
            context.windowId,
            context.tabId,
            context.newTab,
          ).catch(() => null)
        : null;
    const [found, links, notes, provider] = await Promise.all([
      findSuggestions(
        api,
        context.windowId,
        message.query,
        publishVisible,
        context.newTab ? context.tabId : undefined,
        groupId,
      ),
      quicklinks(api, message.query).catch(() => []),
      noteSuggestions(api, message.query).catch(() => []),
      learnedProvider(api, context, message.query).catch(() => undefined),
    ]);
    const calculation = calculate(message.query);
    const extra = calculation
      ? [
          {
            kind: "calculator",
            title: calculation.result,
            url: calculation.expression,
            copyText: calculation.result,
            sources: ["calculator"],
          },
        ]
      : [];
    let recent = [],
      recentActions = [];
    if (!message.query.trim()) {
      const history = await listActivity(api).catch(() => []);
      recentActions = history.slice(0, 3).map((row) => ({
        kind: "activity",
        activityId: row.id,
        title: row.label,
        url: `View history · ${new Date(row.time).toLocaleString()}`,
        sources: ["activity"],
        section: "Recent actions",
      }));
      const counts = new Map();
      for (const row of history.filter(
        (row) => row.action === "command" && row.status === "ok",
      ))
        counts.set(row.label, (counts.get(row.label) || 0) + 1);
      recent = commandSuggestions("")
        .filter((row) => counts.has(row.title))
        .sort((a, b) => counts.get(b.title) - counts.get(a.title))
        .slice(0, 3);
      const hasFrequent = recent.length > 0;
      if (!hasFrequent)
        recent = commandSuggestions("").filter((row) =>
          ["order-tabs", "closed-tabs", "settings"].includes(row.command),
        );
      recent = recent.map((row) => ({
        ...row,
        section: hasFrequent ? "Frequent commands" : "Commands",
      }));
    }
    const rows = found.suggestions.filter(visible),
      remaining = [];
    for (const link of links.filter(visible).slice(0, 8)) {
      const index = rows.findIndex((row) => row.url === link.url);
      if (index < 0) remaining.push(link);
      else
        rows[index] = {
          ...rows[index],
          linkId: link.linkId,
          linkName: link.title,
          sources: [
            ...new Set([
              ...(rows[index].sources || [rows[index].kind]),
              "quicklink",
            ]),
          ],
        };
    }
    return {
      ...found,
      domains: found.domains.filter(visible),
      ...(provider ? { learnedProvider: provider.key } : {}),
      suggestions: [
        ...extra,
        ...rows,
        ...remaining,
        ...notes.slice(0, message.query.trim() ? 8 : 3).map((note) => ({
          ...note,
          ...(!message.query.trim() ? { section: "Notes" } : {}),
        })),
        ...recentActions,
        ...recent,
      ],
    };
  }
  if (message.type === "palette:note") return noteAction(api, message);
  if (message.type === "palette:quicklink") {
    let request = message;
    if (message.operation === "save" && message.tabId !== undefined) {
      if (!Number.isInteger(message.tabId)) throw Error("Invalid tab");
      const tab = await api.tabs.get(message.tabId);
      if (tab.windowId !== context.windowId)
        throw Error("Tab is outside this window");
      request = { ...message, url: tab.url };
    }
    return changeQuicklink(api, request);
  }
  if (message.type === "palette:tab-action") {
    if (message.action === "new-split" || message.action === "close-split") {
      const ids = message.tabIds;
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > 2 ||
        new Set(ids).size !== ids.length ||
        !ids.every(Number.isInteger)
      ) {
        throw new Error(
          "Choose one tab, or mark two adjacent tabs to pair them",
        );
      }
      if (
        typeof api.tabs.createSplit !== "function" ||
        typeof api.tabs.unsplit !== "function"
      ) {
        throw new Error("Split View commands require Chrome 155 or later");
      }
      const tabs = await Promise.all(ids.map((id) => api.tabs.get(id)));
      if (tabs.some((tab) => tab.windowId !== context.windowId))
        throw new Error("Tab is outside this window");
      const [first, second] = tabs;
      if (message.action === "close-split") {
        if (first.splitViewId >= 0) await api.tabs.unsplit(first.splitViewId);
        else throw new Error("This tab is not in Split View");
      } else if (second) {
        if (
          Math.abs(first.index - second.index) !== 1 ||
          first.groupId !== second.groupId ||
          first.pinned !== second.pinned ||
          tabs.some((tab) => tab.splitViewId >= 0)
        ) {
          throw new Error(
            "Choose adjacent tabs in the same group with the same pin state",
          );
        }
        await api.tabs.createSplit(ids);
      } else {
        if (first.splitViewId >= 0)
          throw new Error("This tab is already in Split View");
        await api.tabs.create({
          windowId: context.windowId,
          splitWithTabId: first.id,
        });
      }
      return;
    }
    const changes = {
      "pin-tab": { pinned: true },
      "unpin-tab": { pinned: false },
      "mute-tab": { muted: true },
      "unmute-tab": { muted: false },
    };
    if (Object.hasOwn(changes, message.action)) {
      const ids = message.tabIds;
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > 100 ||
        !ids.every(Number.isInteger)
      ) {
        throw new Error("Invalid tab selection");
      }
      const tabs = await Promise.all(
        [...new Set(ids)].map((id) => api.tabs.get(id)),
      );
      if (tabs.some((tab) => tab.windowId !== context.windowId))
        throw new Error("Tab is outside this window");
      for (const tab of tabs)
        await api.tabs.update(tab.id, changes[message.action]);
      return;
    }
    if (!Number.isInteger(message.tabId) || message.action !== "duplicate")
      throw Error("Invalid tab action");
    const tab = await api.tabs.get(message.tabId);
    if (tab.windowId !== context.windowId)
      throw Error("Tab is outside this window");
    await api.tabs.duplicate(tab.id);
    return;
  }
  if (message.type === "palette:bookmark")
    return changeBookmarks(api, context.windowId, message);
  if (message.type === "palette:group")
    return changeGroup(api, context.windowId, message);
  if (message.type === "palette:move") {
    await moveTab(api, context.windowId, message);
    return { suggestions: await orderSuggestions(api, context.windowId, "") };
  }
  if (message.type === "palette:activate") {
    if (!Number.isInteger(message.tabId)) throw new Error("Invalid tab");
    const tab = await api.tabs.get(message.tabId);
    if (tab.windowId !== context.windowId)
      throw new Error("Tab is outside this window");
    await api.tabs.update(tab.id, { active: true });
    await api.windows.update(context.windowId, { focused: true });
    await rememberTabChoice(api, message.selectionQuery, tab.url);
    if (tab.id !== context.tabId) await removeSearchTab(api, context);
    return;
  }
  if (message.type === "palette:navigate")
    return navigate(
      api,
      context,
      message.query,
      message.target,
      message.scope === "window",
    );
  if (message.type === "palette:site") {
    const sites = await loadSites(api, context.windowId);
    const url = siteDestination(sites, message.site, message.query);
    if (!["new", "background", "current", undefined].includes(message.target))
      throw new Error("Invalid navigation target");
    const site = sites.find((site) => site.key === message.site);
    if (site.ai) {
      await savePrompt(api, site, message.query);
      onAiLaunch();
    }
    return navigate(
      api,
      context,
      url,
      message.target,
      message.scope === "window",
    );
  }
  if (message.type === "palette:recover") {
    const sites = await loadSites(api, context.windowId);
    const draft = await recoverPrompt(api, message.draftId, sites);
    const provider = await preferredProvider(
      api,
      context,
      draft.query,
      async () => sites,
    ).catch(() => undefined);
    return {
      ...draft,
      ...(provider && (!draft.alias || !provider.aliases.includes(draft.alias))
        ? { learnedProvider: provider.key }
        : {}),
    };
  }
  if (message.type === "palette:remember-site")
    return rememberSite(api, context.windowId, message.site, message.alias);
  if (message.type === "palette:command")
    return executeAction(api, context, message.command);
  if (message.type === "palette:restore") {
    if (typeof message.sessionId !== "string" || !message.sessionId)
      throw new Error("Invalid closed tab");
    return restore(api, message.sessionId);
  }
  throw new Error("Unknown search action");
}

async function learnedProvider(api, context, query) {
  const trimmed = query.trim();
  if (trimmed.length < 3 || destination(trimmed)?.type !== "search") return;
  return preferredProvider(api, context, trimmed, () =>
    loadSites(api, context.windowId),
  );
}

function activityEvent(message, status) {
  const action = message.type.slice(8);
  const provider = BUILTIN_SITES.find((site) => site.key === message.site);
  let label = action;
  if (action === "site") label = `Search ${provider?.name || message.site}`;
  if (action === "navigate") {
    const parsed = destination(message.query);
    label =
      parsed?.type === "url"
        ? `Open ${new URL(parsed.url).hostname}`
        : "Web search";
  }
  if (action === "command")
    label =
      COMMANDS.find((item) => item.command === message.command)?.title ||
      "Browser command";
  if (action === "move")
    label = `Move tab ${message.tabId} · ${message.placement}`;
  if (action === "activate") label = `Activate tab ${message.tabId}`;
  if (action === "restore") label = "Restore closed tab";
  if (action === "bookmark")
    label = `Bookmarks · ${message.operation} · ${message.tabIds?.length || 0} tabs`;
  if (action === "group")
    label = `Tab group · ${message.action}${message.tabIds ? ` · ${message.tabIds.length} tabs` : ""}`;
  if (action === "recover") label = "Recover AI prompt";
  if (action === "note") label = `Note · ${message.operation}`;
  if (action === "quicklink") label = `Quicklink · ${message.operation}`;
  if (action === "tab-action") label = `Tab · ${message.action}`;
  return {
    action,
    label,
    status,
    text: typeof message.query === "string" ? message.query : undefined,
  };
}
export async function paletteAction(api, message, sender, publish) {
  const context = sourceContext(api, sender);
  if (!sender.tab && api.windows?.get) {
    const window = await api.windows.get(context.windowId).catch(() => null);
    context.incognito = window?.incognito ?? true;
  }
  let aiLaunch = false;
  const record = async (status) => {
    const event = activityEvent(message, status);
    if (!context.incognito && (message.type === "palette:command" || aiLaunch))
      event.learning = await selectionSignal(
        api,
        context,
        message,
        status,
      ).catch(() => undefined);
    await recordActivity(api, event);
  };
  const logged =
    !(message.type === "palette:note" && message.operation === "get") &&
    !["palette:suggest", "palette:icons", "palette:remember-site"].includes(
      message.type,
    ) &&
    message.command !== "activity";
  try {
    const result = await performAction(api, message, context, publish, () => {
      aiLaunch = true;
    });
    if (logged) {
      const recording = record("ok").catch(() => {});
      if (message.type !== "palette:move") await recording;
    }
    return result;
  } catch (error) {
    if (logged) await record("error").catch(() => {});
    throw error;
  }
}
