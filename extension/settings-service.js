import { activitySettings, saveActivitySettings } from "./activity-store.js";
import { EDITABLE_SHORTCUTS, resolveShortcuts } from "./launcher-catalog.js";
import {
  KEYBOARD_SHORTCUTS_SETTING,
  shortcutText,
  validShortcut,
} from "./keyboard-shortcuts.js";
import { availableLanguages, LANGUAGE_SETTING } from "./localization.js";
import { loadCustomSites, loadSites, parseSites } from "./site-search.js";

const DENSE = "dense-glass";
const TOUR = "spotlight-tour-complete";
const CHROME_DESTINATIONS = new Set([
  "chrome://settings/searchEngines",
  "chrome://extensions/shortcuts",
]);

export async function settingsAction(api, windowId, { operation, value }) {
  const storage = api.storage.local;
  switch (operation) {
    case "load": {
      const [response, languages, customSites, sites, activity, saved] =
        await Promise.all([
          fetch(api.runtime.getURL("settings-panel.html")),
          availableLanguages(api),
          loadCustomSites(api),
          loadSites(api, windowId),
          activitySettings(api),
          storage.get([DENSE, LANGUAGE_SETTING, KEYBOARD_SHORTCUTS_SETTING]),
        ]);
      if (!response.ok) throw Error("Settings unavailable");
      return {
        markup: await response.text(),
        languages,
        customSites,
        sites,
        learn: activity.learn,
        dense: saved[DENSE] === true,
        languagePreference: saved[LANGUAGE_SETTING],
        bindings: resolveShortcuts(saved[KEYBOARD_SHORTCUTS_SETTING]),
        defaults: EDITABLE_SHORTCUTS,
      };
    }
    case "sites":
      return storage.set({ sites: parseSites(value) });
    case "forget": {
      const saved = await storage.get(null);
      return storage.remove(
        Object.keys(saved).filter((key) => key.startsWith("siteAlias:")),
      );
    }
    case "replay":
      return storage.remove(TOUR);
    case "appearance": {
      if (typeof value?.learn !== "boolean" || typeof value.dense !== "boolean")
        throw Error("Invalid preferences");
      const activity = await activitySettings(api);
      if (activity.learn !== value.learn)
        await saveActivitySettings(api, { ...activity, learn: value.learn });
      return storage.set({ [DENSE]: value.dense });
    }
    case "language": {
      if (value === "") return storage.remove(LANGUAGE_SETTING);
      if (!(await availableLanguages(api)).some(([code]) => code === value))
        throw Error("Cannot save the interface language.");
      return storage.set({ [LANGUAGE_SETTING]: value });
    }
    case "keyboard": {
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw Error("Invalid shortcuts");
      const defaults = new Map(
        EDITABLE_SHORTCUTS.map((binding) => [binding.id, binding]),
      );
      const changes = {};
      for (const [id, binding] of Object.entries(value)) {
        if (!defaults.has(id) || !validShortcut(binding))
          throw Error("Invalid shortcuts");
        const { key, shift, alt } = binding;
        changes[id] = { key, shift, alt };
      }
      const chords = EDITABLE_SHORTCUTS.map((binding) =>
        shortcutText(changes[binding.id] || binding),
      );
      if (new Set(chords).size !== chords.length)
        throw Error("Invalid shortcuts");
      return storage.set({ [KEYBOARD_SHORTCUTS_SETTING]: changes });
    }
    case "open": {
      const url =
        value === "activity"
          ? api.runtime.getURL("activity.html")
          : CHROME_DESTINATIONS.has(value)
            ? value
            : null;
      if (!url) throw Error("Invalid settings destination");
      await api.tabs.create({ windowId, url });
      return;
    }
    default:
      throw Error("Unknown settings action");
  }
}
