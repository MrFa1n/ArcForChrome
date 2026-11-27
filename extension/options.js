import { activitySettings, saveActivitySettings } from "./activity-store.js";
import {
  availableLanguages,
  interfaceLocale,
  LANGUAGE_SETTING,
  pageTranslator,
  systemTranslator,
} from "./localization.js";
const locale = await interfaceLocale(chrome);
const t = pageTranslator(document, locale);
const systemText = systemTranslator(locale);
import { loadCustomSites, loadSites, parseSites } from "./site-search.js";
const container = document.querySelector("#sites");
const status = document.querySelector("#status");
function addRow(site = { name: "", key: "", template: "" }) {
  const row = document.createElement("div");
  row.className = "site";
  for (const [field, label] of [
    ["name", t("Name")],
    ["key", t("Keyword")],
    ["template", t("Search URL")],
  ]) {
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    wrapper.className = field;
    const input = document.createElement("input");
    input.name = field;
    input.value = site[field];
    input.required = true;
    input.maxLength = field === "template" ? 2048 : field === "name" ? 40 : 16;
    wrapper.append(input);
    row.append(wrapper);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = t("Remove");
  remove.setAttribute("aria-label", t("Remove {0}", site.name || t("site")));
  remove.addEventListener("click", () => row.remove());
  row.insertBefore(remove, row.lastElementChild);
  container.append(row);
}
function render(sites) {
  container.replaceChildren();
  sites.forEach(addRow);
}
document.querySelector("#add").addEventListener("click", () => {
  if (container.children.length < 20) addRow();
  else status.textContent = t("Use at most 20 sites.");
});
document.querySelector("#reset").addEventListener("click", () => {
  render([]);
  status.textContent = t(
    "Manual overrides cleared in this form. Save to use built-in and detected shortcuts.",
  );
});
document
  .querySelector("#sites-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit =
      event.submitter || document.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      const sites = parseSites(
        [...container.children].map((row) =>
          Object.fromEntries(
            [...row.querySelectorAll("input")].map((input) => [
              input.name,
              input.value,
            ]),
          ),
        ),
      );
      await chrome.storage.local.set({ sites });
      status.textContent = t("Saved. Reopen search to use these sites.");
    } catch (error) {
      status.textContent = systemText(error.message);
    } finally {
      submit.disabled = false;
    }
  });
for (const [id, url] of [
  ["provider", "chrome://settings/searchEngines"],
  ["shortcuts", "chrome://extensions/shortcuts"],
]) {
  document.querySelector(`#${id}`).addEventListener("click", () =>
    chrome.tabs.create({ url }).catch((error) => {
      status.textContent = systemText(error.message);
    }),
  );
}
loadCustomSites(chrome)
  .then(render)
  .catch((error) => {
    status.textContent = systemText(error.message);
  });
loadSites(chrome)
  .then((sites) => {
    const list = document.querySelector("#detected");
    for (const site of sites.filter((site) => site.detected || site.builtin)) {
      const item = document.createElement("li");
      item.textContent = `${site.name} · ${site.aliases.join(", ")} · ${site.builtin ? t("Built-in") : t("Detected")}`;
      list.append(item);
    }
    if (!list.children.length)
      list.textContent = t(
        "No search URLs detected yet. Search on a website in Chrome once, then reopen the palette.",
      );
  })
  .catch(() => {});
document.querySelector("#forget").addEventListener("click", async () => {
  try {
    const saved = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(
      Object.keys(saved).filter((key) => key.startsWith("siteAlias:")),
    );
    status.textContent = t(
      "Learned shortcuts cleared. Reopen search to refresh.",
    );
  } catch (error) {
    status.textContent = systemText(error.message);
  }
});

document.querySelector("#activity").addEventListener("click", () =>
  chrome.tabs
    .create({ url: chrome.runtime.getURL("activity.html") })
    .catch((error) => {
      status.textContent = systemText(error.message);
    }),
);

const languageForm = document.querySelector("#language-form");
const languageSelect = languageForm.elements.language;
const languageSave = languageForm.querySelector("button");
const [languages, settings] = await Promise.all([
  availableLanguages(chrome),
  chrome.storage.local.get(LANGUAGE_SETTING).catch(() => ({})),
]);
languageSelect.add(new Option(t("Use Chrome language"), ""));
for (const [code, name] of languages)
  languageSelect.add(new Option(name, code));
languageSelect.value = languages.some(
  ([code]) => code === settings[LANGUAGE_SETTING],
)
  ? settings[LANGUAGE_SETTING]
  : "";
languageSelect.disabled = false;
languageSave.disabled = false;
languageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  languageSave.disabled = true;
  try {
    if (languageSelect.value)
      await chrome.storage.local.set({
        [LANGUAGE_SETTING]: languageSelect.value,
      });
    else await chrome.storage.local.remove(LANGUAGE_SETTING);
    location.reload();
  } catch {
    document.querySelector("#language-status").textContent = t(
      "Cannot save the interface language.",
    );
    languageSave.disabled = false;
  }
});

const spotlightForm = document.querySelector("#spotlight-preferences");
const spotlightStatus = document.querySelector("#spotlight-preferences-status");
const spotlightSave = spotlightForm.querySelector("button");
try {
  const [activity, appearance] = await Promise.all([
    activitySettings(chrome),
    chrome.storage.local.get("dense-glass"),
  ]);
  spotlightForm.elements.learn.checked = activity.learn;
  spotlightForm.elements.dense.checked = appearance["dense-glass"] === true;
  spotlightForm.elements.learn.disabled = false;
  spotlightForm.elements.dense.disabled = false;
  spotlightSave.disabled = false;
} catch (error) {
  spotlightStatus.textContent = systemText(error.message);
}
spotlightForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  spotlightSave.disabled = true;
  try {
    const activity = await activitySettings(chrome);
    if (activity.learn !== spotlightForm.elements.learn.checked)
      await saveActivitySettings(chrome, {
        ...activity,
        learn: spotlightForm.elements.learn.checked,
      });
    await chrome.storage.local.set({
      "dense-glass": spotlightForm.elements.dense.checked,
    });
    spotlightStatus.textContent = t("Saved");
  } catch (error) {
    spotlightStatus.textContent = systemText(error.message);
  } finally {
    spotlightSave.disabled = false;
  }
});

document.querySelector("#replay-tour").addEventListener("click", async () => {
  try {
    await chrome.storage.local.remove("spotlight-tour-complete");
    spotlightStatus.textContent = t(
      "The introduction will appear the next time you open Spotlight.",
    );
  } catch (error) {
    spotlightStatus.textContent = systemText(error.message);
  }
});
