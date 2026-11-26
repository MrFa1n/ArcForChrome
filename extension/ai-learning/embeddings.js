// Each dimension is a task or subject shared by English and Russian prompts.
// Persisting only these dimensions keeps arbitrary words out of learning records.
const concepts = [
  "explain explains explanation define definition understand объясни объяснить объяснение поясни разъясни",
  "code coding program programming software javascript typescript python код кодинг программирование программа",
  "closure closures lambda замыкание замыкания замыканий лямбда",
  "debug debugging bug error fix exception отладка ошибка ошибки исправь исправить баг",
  "translate translation translator переведи перевести перевод переводчик",
  "summarize summarise summary tldr summarize конспект резюме суммируй сократи кратко",
  "write draft rewrite compose напиши сочини составь перепиши",
  "email letter message письмо письма сообщение",
  "research source sources citations evidence исследование источники ссылки исследования",
  "compare comparison versus сравни сравнить сравнение сравнения",
  "math mathematics calculate equation уравнение вычисли математика посчитай",
  "travel trip vacation маршрут поездка путешествие отпуск",
  "recipe cooking cook recipes рецепт рецепты приготовь готовка",
  "reload refresh перезагрузить обновить обновление",
  "copy clipboard скопировать копировать буфер",
  "duplicate clone дублировать копия",
  "tab tabs вкладка вкладки вкладок",
  "history recent история недавно",
  "downloads download загрузки скачивания",
  "settings preferences configuration настройки параметры",
  "window windows окно окна окон",
  "search find поиск найти",
  "bookmark bookmarks закладки закладка",
  "prompt prompts промпт промпты промптов",
  "image images picture pictures изображение картинки фото",
];
const dimensions = new Map(
  concepts.flatMap((words, index) =>
    words.split(" ").map((word) => [word, index]),
  ),
);
export const MIN_SIMILARITY = 0.68;

export function embeddingTopics(vector) {
  return concepts
    .filter((_, index) => vector?.[index] > 0)
    .map((words) => words.split(" ", 1)[0]);
}

const descriptor = { dataType: "float32", shape: [concepts.length] };
let backend;

async function createBackend() {
  const context = await navigator.ml.createContext();
  try {
    const builder = new MLGraphBuilder(context);
    const input = builder.input("input", descriptor);
    const norm = builder.reduceL2(input, { keepDimensions: true });
    const graph = await builder.build({ embedding: builder.div(input, norm) });
    return { context, graph };
  } catch (error) {
    context.destroy();
    throw error;
  }
}

async function normalizeWithWebNN(values, { context, graph }) {
  const input = await context.createTensor({ ...descriptor, writable: true });
  try {
    const output = await context.createTensor({
      ...descriptor,
      readable: true,
    });
    try {
      context.writeTensor(input, values);
      context.dispatch(graph, { input }, { embedding: output });
      return new Float32Array(await context.readTensor(output));
    } finally {
      output.destroy();
    }
  } finally {
    input.destroy();
  }
}

export async function embed(text) {
  const values = new Float32Array(concepts.length);
  for (const match of text
    .slice(0, 8192)
    .toLowerCase()
    .matchAll(/\p{L}+/gu)) {
    const index = dimensions.get(match[0]);
    if (index !== undefined) values[index] = 1;
  }
  const norm = Math.hypot(...values);
  if (!norm) return null;

  if (
    globalThis.navigator?.ml &&
    typeof globalThis.MLGraphBuilder === "function"
  ) {
    backend ??= createBackend().catch(() => null);
    let timer;
    try {
      const accelerated = backend.then((engine) =>
        engine ? normalizeWithWebNN(values, engine) : null,
      );
      const result = await Promise.race([
        accelerated,
        new Promise((resolve) => {
          timer = setTimeout(resolve, 60, null);
        }),
      ]);
      if (result?.length === values.length && result.every(Number.isFinite))
        return Array.from(result);
    } catch {
      // A backend can become unavailable during the browser session.
      backend = Promise.resolve(null);
    } finally {
      clearTimeout(timer);
    }
  }
  return Array.from(values, (value) => value / norm);
}

export function similarity(a, b) {
  if (!a || !Array.isArray(b) || a.length !== b.length) return 0;
  return a.reduce((dot, value, index) => dot + value * b[index], 0);
}
