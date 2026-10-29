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

The worker handles only two message actions, validates the extension sender and source window, validates query types/length and confirms activated tabs belong to that window. Navigation is parsed through the existing safe destination function and uses tabs.create, never navigation of the source tab. No messages are sent through page window.postMessage. If injection fails, a separate extension popup page provides the same UI with the original window ID. Its sender URL is validated by protocol, host and pathname. The popup closes after successful selection.

Chrome only permits four suggested bindings. The palette receives Alt+Shift+K; previous-tab remains declared without a default. No persistent host permissions or web-accessible resources are introduced.
