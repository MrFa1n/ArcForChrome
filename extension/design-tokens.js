// The injected palette runs as a serialized function, so pass the local CSS as data.
let loaded;
export function loadDesignTokens() {
  loaded ||= fetch(new URL('./design-tokens.css',import.meta.url))
    .then(response => response.ok ? response.text() : '')
    .catch(() => '');
  return loaded;
}
