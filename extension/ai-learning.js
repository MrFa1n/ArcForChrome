import { interfaceLocale, systemTranslator } from "./localization.js";
import { activitySettings, listActivity } from "./activity-store.js";
import { commandSuggestions } from "./command-catalog.js";
import { embed, similarity, MIN_SIMILARITY } from "./ai-learning/embeddings.js";

const MAX_SIGNALS = 100;

export async function learningEnabled(api, context) {
  if (context.incognito) return false;
  const settings = await activitySettings(api).catch(() => null);
  return settings?.enabled === true && settings.learn === true;
}

async function signals(api, context, action) {
  if (!(await learningEnabled(api, context))) return [];
  const entries = await listActivity(api).catch(() => []);
  return entries
    .filter((row) => row.action === action && row.learning?.choice)
    .slice(0, MAX_SIGNALS);
}

export async function selectionSignal(api, context, message, status) {
  if (!["palette:site", "palette:command"].includes(message.type)) return;
  if (!(await learningEnabled(api, context))) return;
  if (message.type === "palette:site") {
    const vector = await embed(message.query);
    if (vector) return { choice: message.site, vector };
    return;
  }
  const { selectionQuery, selectionIndex, command, suggestedCommand } = message;
  if (
    status !== "ok" ||
    typeof selectionQuery !== "string" ||
    selectionQuery.length > 8192 ||
    !Number.isInteger(selectionIndex) ||
    selectionIndex < 0 ||
    selectionIndex > 200
  )
    return;
  const matching = commandSuggestions(
    selectionQuery,
    systemTranslator(await interfaceLocale(api)),
  );
  if (!matching.some((row) => row.command === command)) return;
  const skipped =
    selectionIndex > 0 &&
    suggestedCommand !== command &&
    matching.some((row) => row.command === suggestedCommand)
      ? suggestedCommand
      : undefined;
  return {
    choice: command,
    index: selectionIndex,
    ...(skipped ? { skipped } : {}),
    vector: await embed(selectionQuery),
  };
}

export async function rankCommands(api, context, query, rows) {
  if (rows.length < 2) return rows;
  const entries = await signals(api, context, "command");
  if (!entries.length) return rows;
  const vector = await embed(query);
  const candidates = new Set(rows.map((row) => row.command));
  const scores = new Map();
  const add = (key, score) => scores.set(key, (scores.get(key) || 0) + score);
  for (const { learning } of entries) {
    if (!candidates.has(learning.choice)) continue;
    const related = similarity(vector, learning.vector) >= MIN_SIMILARITY;
    add(learning.choice, related ? 2 : 1);
    if (learning.skipped) add(learning.skipped, related ? -0.5 : -0.25);
  }
  return rows
    .slice()
    .sort(
      (a, b) => (scores.get(b.command) || 0) - (scores.get(a.command) || 0),
    );
}

export async function preferredProvider(api, context, query, loadCandidates) {
  const entries = await signals(api, context, "site");
  if (!entries.length) return;
  const vector = await embed(query);
  if (!vector) return;
  const scores = new Map();
  for (const { learning, status } of entries) {
    const related = similarity(vector, learning.vector);
    if (related < MIN_SIMILARITY) continue;
    const score = related * (status === "ok" ? 1 : -1);
    scores.set(learning.choice, (scores.get(learning.choice) || 0) + score);
  }
  if (![...scores.values()].some((score) => score >= MIN_SIMILARITY)) return;
  const eligible = new Map(
    (await loadCandidates())
      .filter((site) => site.ai)
      .map((site) => [site.key, site]),
  );
  const [best, second] = [...scores]
    .filter(([key]) => eligible.has(key))
    .sort((a, b) => b[1] - a[1]);
  if (best && best[1] >= MIN_SIMILARITY && best[1] - (second?.[1] || 0) > 0.15)
    return eligible.get(best[0]);
}
