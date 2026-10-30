# Search architecture

Manifest V3, native ES modules, no runtime dependencies. Chrome is the source of truth for tabs, history and bookmarks. There is no extension-owned persistence or tab-management layer.

## Components

- `worker.js` registers search on service-worker evaluation.
- `search-controller.js` handles toolbar clicks, the open-search command and three validated message actions: suggestions, tab activation and new-tab navigation. There are no tab-activation trackers or background state writers.
- `palette-service.js` queries the source window and injects the self-contained palette function on explicit invocation. Protected pages fall back to a separate extension popup.
- `palette.js` builds a native outer modal in a closed shadow root with an about:blank iframe containing the search UI. Frame key events cannot traverse parent-page capture/bubble listeners. Dismissal waits for held keys to be released, then restores page focus. Text is inserted with textContent. This is a UI boundary, not a defense against malicious pages removing DOM.
- `palette-page.js` hosts the same UI in the protected-page popup.
- `suggestions.js` searches and ranks local sources.
- `model.js` parses HTTP(S) addresses and encodes other input as a Google query.

## Suggestions

Tabs are scoped to the validated source window. Nonempty queries search bookmarks and history (all-time, 50 history candidates) concurrently. Promise.allSettled preserves available sources when another fails. Empty queries search only tabs. Ranking matches title/URL words case-insensitively, puts tabs before bookmarks before history, and deduplicates canonical URLs. An already open URL retains its tab-activation action even if the bookmark title supplied the match. At most eight results are returned. Folders and non-HTTP(S) saved/visited URLs are excluded.

The UI filters its opening tab snapshot immediately, debounces worker requests by 150 ms and rejects stale replies using a revision counter. A surviving manually selected result stays selected; otherwise the first suggestion is selected. A final raw-input navigation row remains available.

## Boundaries and behavior

The worker validates extension senders, popup URL protocol/host/path, source window, query type/length and target tab ownership. No window.postMessage bridge, remote script, web-accessible resource or permanent host access is used. Navigation creates a new tab and never navigates or closes the source tab. Search result activation is the only tab-switching behavior.

## Glossary

- **Palette / command bar**: the temporary Spotlight-style search UI.
- **Suggestion**: a unique URL with a title, explicit source tags and an activation/navigation action.
- **Open tab**: a native tab in the source window; highest suggestion priority.
- **Source window**: the native Chrome window from which search was invoked.

The removed sidebar, groups/spaces UI, pin commands, MRU cycle and session storage can be found in Git history. They are not part of the current product.
