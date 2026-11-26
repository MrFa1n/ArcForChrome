import {
  interfaceLocale,
  pageTranslator,
  systemTranslator,
} from "./localization.js";
import { embeddingTopics } from "./ai-learning/embeddings.js";
import {
  activitySettings,
  saveActivitySettings,
  listActivity,
  clearActivity,
} from "./activity-store.js";
const locale = await interfaceLocale(chrome);
const t = pageTranslator(document, locale);
const systemText = systemTranslator(locale);
const form = document.querySelector("#limits");
const status = document.querySelector("#status");
const filter = document.querySelector("#filter");
let revision = 0;
async function refresh() {
  const current = ++revision;
  try {
    const terms = filter.value
      .toLocaleLowerCase(locale.language)
      .trim()
      .split(/\s+/);
    const rows = (await listActivity(chrome)).filter((row) => {
      const search = `${row.label} ${systemText(row.label)} ${row.action} ${row.status} ${row.text || ""}`;
      return terms.every((term) =>
        search.toLocaleLowerCase(locale.language).includes(term),
      );
    });
    if (current !== revision) return;
    document.querySelector("#entries").replaceChildren(
      ...rows.map((row) => {
        const item = document.createElement("li");
        const time = document.createElement("time");
        time.dateTime = new Date(row.time).toISOString();
        time.textContent = new Date(row.time).toLocaleString(locale.language);
        const title = document.createElement("strong");
        title.textContent = `${row.status === "error" ? t("Failed") : t("Done")} · ${systemText(row.label)}`;
        if (row.status === "error") title.className = "failed";
        item.append(time, title);
        if (row.text) {
          const text = document.createElement("p");
          text.textContent = row.text;
          item.append(text);
        }
        if (row.learning) {
          const learning = document.createElement("p");
          learning.textContent =
            row.learning.index === undefined
              ? t("Learning: provider and prompt topics")
              : t(
                  "Learning: command picked at position {0}",
                  row.learning.index + 1,
                );
          const details = [
            ...embeddingTopics(row.learning.vector).map(t),
            row.learning.skipped
              ? t("Skipped: {0}", t(row.learning.skipped))
              : "",
          ].filter(Boolean);
          if (details.length) learning.append(` · ${details.join(", ")}`);
          item.append(learning);
        }
        return item;
      }),
    );
    document.querySelector("#count").textContent = rows.length
      ? t("Actions: {0}", rows.length)
      : t("No actions yet");
  } catch (error) {
    status.textContent = systemText(error.message);
  }
}
activitySettings(chrome)
  .then((settings) => {
    for (const [name, value] of Object.entries(settings)) {
      const input = form.elements.namedItem(name);
      if (input.type === "checkbox") input.checked = value;
      else input.value = value;
    }
  })
  .catch((error) => {
    status.textContent = systemText(error.message);
  });
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveActivitySettings(chrome, {
      enabled: form.elements.enabled.checked,
      includeText: form.elements.includeText.checked,
      learn: form.elements.learn.checked,
      retentionHours: Number(form.elements.retentionHours.value),
      maxEntries: Number(form.elements.maxEntries.value),
    });
    status.textContent = t("Saved");
    await refresh();
  } catch (error) {
    status.textContent = systemText(error.message);
  }
});
document.querySelector("#clear").addEventListener("click", async () => {
  try {
    await clearActivity(chrome);
    status.textContent = t("History cleared");
    await refresh();
  } catch (error) {
    status.textContent = systemText(error.message);
  }
});
filter.addEventListener("input", refresh);
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    Object.keys(changes).some((key) => key.startsWith("activity:"))
  )
    refresh();
});
refresh();
