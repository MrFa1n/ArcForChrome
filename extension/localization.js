export const LANGUAGE_SETTING = "interface-language";
const DEFAULT_LANGUAGE = "en";
const BUILTIN_LANGUAGES = ["en", "ru"];
const LANGUAGE_CODE = /^[a-z]{2,3}(?:_[A-Za-z0-9]{2,8})?$/;
const catalogs = new Map();

function catalog(code) {
  if (!LANGUAGE_CODE.test(code)) return Promise.resolve(null);
  if (!catalogs.has(code))
    catalogs.set(
      code,
      fetch(new URL(`./_locales/${code}/messages.json`, import.meta.url))
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    );
  return catalogs.get(code);
}

export async function interfaceLocale(api) {
  const saved = await api.storage?.local
    ?.get?.(LANGUAGE_SETTING)
    .catch(() => ({}));
  const preference = saved?.[LANGUAGE_SETTING];
  const requested =
    typeof preference === "string" && LANGUAGE_CODE.test(preference)
      ? preference
      : (api.i18n?.getUILanguage?.() || DEFAULT_LANGUAGE).replaceAll("-", "_");
  const [exact, base, english] = await Promise.all([
    catalog(requested),
    catalog(requested.split("_")[0]),
    catalog(DEFAULT_LANGUAGE),
  ]);
  const fallback = requested.split("_")[0];
  const code = exact ? requested : base ? fallback : DEFAULT_LANGUAGE;
  const translation = { ...base, ...exact };
  const messages = {};
  for (const [key, { message }] of Object.entries(english || {})) {
    if (translation[key]?.message && translation[key].message !== message)
      messages[message] = translation[key].message;
  }
  return {
    language: code.replaceAll("_", "-"),
    messages,
    patterns: messagePatterns(messages),
  };
}

export async function availableLanguages(api) {
  const codes = new Set(BUILTIN_LANGUAGES);
  try {
    const root = await api.runtime.getPackageDirectoryEntry();
    const directory = await new Promise((resolve, reject) =>
      root.getDirectory("_locales", {}, resolve, reject),
    );
    const reader = directory.createReader();
    while (true) {
      const entries = await new Promise((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (!entries.length) break;
      for (const entry of entries)
        if (entry.isDirectory && LANGUAGE_CODE.test(entry.name))
          codes.add(entry.name);
    }
  } catch {
    // The bundled languages still work when directory enumeration is unavailable.
  }
  const languages = await Promise.all(
    [...codes].map(async (code) => [
      code,
      (await catalog(code))?.language_name?.message,
    ]),
  );
  return languages.filter(([, name]) => typeof name === "string" && name);
}

// Catalog lookup operates on app-owned messages. Values are inserted as text.
export function translate(messages, source, ...values) {
  const value = Object.hasOwn(messages, source) ? messages[source] : source;
  return value.replace(/\{(\d+)\}/g, (token, index) => values[index] ?? token);
}

export function pageTranslator(document, { language, messages }) {
  document.documentElement.lang = language;
  const t = (source, ...values) => translate(messages, source, ...values);
  for (const element of document.querySelectorAll("[data-message]"))
    element.textContent = t(element.dataset.message);
  for (const attribute of ["placeholder", "aria-label"])
    for (const element of document.querySelectorAll(
      `[data-message-${attribute}]`,
    ))
      element.setAttribute(
        attribute,
        t(element.getAttribute(`data-message-${attribute}`)),
      );
  return t;
}

export function messagePatterns(messages) {
  const localArguments = {
    "Open {0}": [0],
    "Move tab {0} · {1}": [1],
    "Bookmarks · {0} · {1} tabs": [0],
    "Tab group · {0}": [0],
    "Tab group · {0} · {1} tabs": [0],
    "Note · {0}": [0],
    "Quicklink · {0}": [0],
    "Tab · {0}": [0],
    "Add selected tabs · {0}": [0],
    "{0} · Collapsed": [0],
    "{0} · Expanded": [0],
    "Position {0}{1}{2} · {3}": [1, 2],
    "{0} {1} of {2} bookmarks before Chrome failed. Refresh the folder list and retry; completed changes remain.":
      [0],
  };
  return Object.keys(messages)
    .filter((source) => /\{\d+\}/.test(source) && source !== "{0} {1}{2} · {3}")
    .sort(
      (a, b) =>
        b.replace(/\{\d+\}/g, "").length - a.replace(/\{\d+\}/g, "").length,
    )
    .map((source) => {
      const pattern = source
        .split(/(\{\d+\})/)
        .map((part) =>
          /^\{\d+\}$/.test(part)
            ? "([\\s\\S]*?)"
            : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        )
        .join("");
      const order = source === "Position {0}{1}{2} · {3}";
      return [
        source,
        order
          ? "^Position (\\d+)( · Pinned)?( · Grouped)? · (.*)$"
          : `^${pattern}$`,
        localArguments[source] || [],
      ];
    });
}

export function systemTranslator({ messages, patterns }) {
  const matchers = patterns.map(([source, pattern, local]) => [
    source,
    new RegExp(pattern),
    local,
  ]);
  return (value) => {
    if (typeof value !== "string" || !value) return value;
    if (Object.hasOwn(messages, value)) return messages[value];
    for (const [source, matcher, local] of matchers) {
      const match = matcher.exec(value);
      if (match)
        return translate(
          messages,
          source,
          ...match
            .slice(1)
            .map((item, index) =>
              local.includes(index) ? translate(messages, item || "") : item,
            ),
        );
    }
    return value;
  };
}
