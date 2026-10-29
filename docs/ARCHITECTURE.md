# Architecture and glossary

Manifest V3, native ES modules, no bundled or remote dependencies.

- **Tab**: a native Chrome tab. Chrome is the source of truth.
- **Favorite**: a pinned tab, shown across all sidebar spaces within its window.
- **Space**: a Chrome tab group in the current window.
- **Inbox**: ungrouped, unpinned tabs (`groupId = -1`).

`model.js` owns pure filtering and navigation parsing. `panel.js` owns DOM rendering and Chrome API calls. `background.js` configures toolbar action behavior on worker activation, install and startup. No persistent content scripts or custom shared persistent state.

Browser events refresh snapshots scoped to the panel's host window. A monotonic revision discards stale reads. Titles/URLs enter the DOM only as text/attributes, never HTML. Navigation accepts HTTP(S) addresses; other input becomes an encoded search query. The extension CSP permits only local scripts.

The sidebar is a projection of native state, not a separate tab manager database. Group names and pinned state survive extension reload through Chrome. Selected space and appearance reset when the panel document is recreated. Tab creation and grouping are separate Chrome operations: on API failure, a successfully created tab can remain in Inbox and the UI reports the error.

`worker.js` registers browser commands at module evaluation and loads panel configuration. `shortcuts.js` owns testable browser command actions and pure space cycling. No new permissions are needed.

## Command palette

`palette-service.js` queries the active window and injects the self-contained `mountPalette` function through `scripting` with temporary `activeTab` access. `palette.js` renders a native outer modal in a closed shadow root, containing a dedicated about:blank iframe with the search dialog. Keyboard events in that document do not traverse parent-page capture or bubble listeners. It traps keyboard focus, waits for held keys to be released before dismissal, restores page focus and uses textContent for tab/query data. Browser focus loss clears stale held-key state. It is injected in the isolated world, not the page main world. The host page can still remove DOM elements; this overlay is a user interface, not a security boundary against hostile sites.

The worker handles navigation, activation and suggestion message actions, validates the extension sender and source window, validates query types/length and confirms activated tabs belong to that window. Navigation is parsed through the existing safe destination function and uses tabs.create, never navigation of the source tab. No messages are sent through page window.postMessage. If injection fails, a separate extension popup page provides the same UI with the original window ID. Its sender URL is validated by protocol, host and pathname. The popup closes after successful selection.

Chrome only permits four suggested bindings. The palette receives Alt+Shift+K; previous-tab remains declared without a default. No persistent host permissions or web-accessible resources are introduced.

## Local history and bookmark suggestions

`suggestions.js` queries tabs in the validated source window, bookmarks by query, and history with `startTime: 0` and a 50-result cap. Empty queries query only tabs. Source requests use Promise.allSettled so individual unavailable sources produce a warning without hiding the others. There is no persistent cache, network autocomplete or write to bookmarks/history.

Pure ranking combines title and URL words case-insensitively, prioritizes tabs then bookmarks then history, and canonicalizes URLs for deduplication. A URL keeps the open-tab action even when only its bookmark title matches. Prefix relevance orders results within a source tier, followed by history recency. Return values contain at most eight results and explicit kind/source tags; bookmark/history IDs never become tab IDs. Non-HTTP(S) history/bookmark URLs and folders are excluded.

The injected self-contained UI immediately filters its initial tabs snapshot, then debounces worker requests by 150 ms. A revision counter rejects stale responses after edits or dismissal. The first suggestion is selected unless the user has moved selection; a navigation row for the raw input is last. Selected history/bookmark URLs use the existing safe new-tab navigation action. The iframe keyboard boundary is unchanged.

API references: https://developer.chrome.com/docs/extensions/reference/api/history and https://developer.chrome.com/docs/extensions/reference/api/bookmarks .

## Most recently used (MRU) tabs

`recent-tabs.js` is a single worker-owned writer for tab activation order. It serializes activation/cleanup events and commands through a recoverable promise queue. Per-window IDs and cycle metadata are stored in storage.session, not local or sync storage; no titles or URLs are copied. Closed windows are removed; closed/detached tabs are pruned. Each command reconciles state with live tabs, so moved or stale IDs cannot be activated in the wrong window.

A command freezes the live MRU list for a 1200 ms repeated-command interval. Command-driven onActivated events update recency while retaining that snapshot; an unrelated activation cancels it. After the interval, a new snapshot begins with the active tab, making isolated presses toggle the most recent pair. A tab update must succeed before the new cycle is saved. Failure does not poison the queue. Startup seeds unknown tabs from available native lastAccessed timestamps; exact pre-install activation order is not claimed.

The `recent-tab` command is distinct from existing positional previous/next commands. Native browser shortcuts are unchanged. No panel or injected UI is required for this command.
