import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  availableLanguages,
  interfaceLocale,
  LANGUAGE_SETTING,
  systemTranslator,
  translate,
} from "../extension/localization.js";
import { commandSuggestions } from "../extension/command-catalog.js";

const folder = new URL("../extension/_locales/", import.meta.url);
const readCatalog = async (name) =>
  JSON.parse(await readFile(new URL(`${name}/messages.json`, folder)));

test("Chrome locale, manual choice, and a new translation file share one catalog format", async (context) => {
  const [en, ru] = await Promise.all([readCatalog("en"), readCatalog("ru")]);
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
  for (const [key, message] of Object.entries(en)) {
    const placeholders = (text) =>
      [...text.matchAll(/\{\d+\}/g)].map(([match]) => match).sort();
    assert.deepEqual(
      placeholders(ru[key].message),
      placeholders(message.message),
      key,
    );
  }
  const es = {
    language_name: { message: "Español" },
    search_settings: { message: "Configuración de búsqueda" },
  };
  context.mock.method(globalThis, "fetch", async (url) => {
    const code = new URL(url).pathname.split("/").at(-2);
    const messages = { en, ru, es }[code];
    return { ok: Boolean(messages), json: async () => messages };
  });
  let preference;
  const api = {
    i18n: { getUILanguage: () => "ru-RU" },
    storage: {
      local: { get: async () => ({ [LANGUAGE_SETTING]: preference }) },
    },
    runtime: {
      getPackageDirectoryEntry: async () => ({
        getDirectory(_name, _options, resolve) {
          resolve({
            createReader() {
              let page = 0;
              return {
                readEntries(resolveEntries) {
                  resolveEntries(
                    page++ === 0 ? [{ name: "es", isDirectory: true }] : [],
                  );
                },
              };
            },
          });
        },
      }),
    },
  };
  const russian = await interfaceLocale(api);
  const systemText = systemTranslator(russian);
  assert.equal(russian.language, "ru");
  assert.equal(
    translate(russian.messages, "Search settings"),
    "Настройки поиска",
  );
  assert.equal(
    systemText("Move before History"),
    "Переместить перед «History»",
  );
  assert.equal(
    systemText("Position 2 · Pinned · https://example.com"),
    "Позиция 2 · Закреплена · https://example.com",
  );
  assert.equal(systemText("Tab · mute-tab"), "Вкладка · выключить звук");
  assert.equal(
    translate(russian.messages, "Ask {0}: {1}", "Claude", "{0} History"),
    "Спросить Claude: {0} History",
  );
  assert.ok(
    commandSuggestions("настройки поиска", systemText).some(
      (row) => row.command === "settings",
    ),
  );

  assert.ok(
    commandSuggestions("открыть закладки", systemText).some(
      (row) => row.command === "browser:bookmarks",
    ),
  );

  preference = "en";
  assert.equal((await interfaceLocale(api)).language, "en");
  preference = "es";
  const spanish = await interfaceLocale(api);
  assert.equal(spanish.language, "es");
  assert.equal(
    translate(spanish.messages, "Search settings"),
    "Configuración de búsqueda",
  );
  assert.equal(
    translate(spanish.messages, "Open Arc Search"),
    "Open Arc Search",
  );
  assert.deepEqual(await availableLanguages(api), [
    ["en", "English"],
    ["ru", "Русский"],
    ["es", "Español"],
  ]);
});
