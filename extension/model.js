export function visibleTabs(tabs, space, query) {
  const term = query.trim().toLocaleLowerCase();
  return tabs.filter(tab => term
    ? `${tab.title ?? ''} ${tab.url ?? ''}`.toLocaleLowerCase().includes(term)
    : tab.pinned || tab.groupId === space);
}

export function destination(input) {
  const value = input.trim();
  if (!value) return null;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (['http:', 'https:'].includes(url.protocol) && !/\s/.test(value) &&
        (url.hostname.includes('.') || url.hostname === 'localhost' || url.hostname === '[::1]')) return url.href;
  } catch { /* Non-address input is a search query. */ }
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}
