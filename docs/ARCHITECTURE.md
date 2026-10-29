# Architecture and glossary

Manifest V3, native ES modules, no bundled or remote dependencies.

- **Tab**: a native Chrome tab. Chrome is the source of truth.
- **Favorite**: a pinned tab, shown across all sidebar spaces within its window.
- **Space**: a Chrome tab group in the current window.
- **Inbox**: ungrouped, unpinned tabs (`groupId = -1`).

`model.js` owns pure filtering and navigation parsing. `panel.js` owns DOM rendering and Chrome API calls. `background.js` configures toolbar action behavior on worker activation, install and startup. No content scripts or custom shared persistent state.

Browser events refresh snapshots scoped to the panel's host window. A monotonic revision discards stale reads. Titles/URLs enter the DOM only as text/attributes, never HTML. Navigation accepts HTTP(S) addresses; other input becomes an encoded search query. The browser CSP permits only local scripts.

The sidebar is a projection of native state, not a separate tab manager database. Group names and pinned state survive extension reload through Chrome. Selected space and appearance reset when the panel document is recreated. Tab creation and grouping are separate Chrome operations: on API failure, a successfully created tab can remain in Inbox and the UI reports the error.
