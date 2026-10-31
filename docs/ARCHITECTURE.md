# Command Bar architecture

Manifest V3, native ES modules, no runtime packages. Chrome owns tabs/history/bookmarks/sessions. Local storage holds site overrides/aliases, action settings and bounded action metadata; session storage holds temporary AI recovery copies.

## Components

- `worker.js` registers `search-controller.js` synchronously at worker evaluation. Toolbar clicks/open-search invoke Search; edit-address invokes Edit. The controller accepts nine typed message actions: suggest, activate, navigate, site, command, restore, remember-site, move and recover.
- `palette-service.js` validates sender and source context, queries tabs/settings, and injects the self-contained `mountPalette` function. Protected pages use `palette-page.js` with the original window/tab IDs in the popup URL. Source tab identity is taken from the browser sender or the validated extension popup URL, never an arbitrary message field.
- `model.js` distinguishes HTTP(S) URLs from search text. It does not construct a provider-specific search URL. `chrome.search.query` handles text against a newly created or explicitly selected source tab.
- `site-search.js` validates optional custom keywords, names and HTTP(S) templates. Queries are encoded once, replacing exactly one `%s`. `options.js` saves validated definitions to storage.local. No browsing history or choice log is persisted.
- `command-catalog.js` is a small whitelist with labels and aliases. Matching a word in normal Search never executes it. Sessions API results are separate restore actions, not history URL navigation.
- `suggestions.js`/`search-match.js` retain bounded local ranking, layout correction, typo tolerance, source warnings, URL deduplication and homepage actions.

## Modes and selection

The UI is a single input with results and contextual hints. Search enters Commands with `>`, Arrange with `@` and Recently closed with `<`. Edit and settings are searchable commands; global Edit remains available. Empty Search+Tab enters Commands; an exact site keyword+Tab enters Site Search; a highlighted URL+Tab completes its address. Escape returns a scoped mode to Search, then closes. Backspace on empty site input restores its keyword.

Raw navigation is last in Search, first in Edit and first after explicit Tab completion. Open tab results otherwise retain priority. Enter waits for the current debounced suggestion promise; edits, mode changes and dismissal increment the revision to cancel stale commits. Busy operations reject further input/selection; input accepts actions again on failure. A Tab-completed deep link cannot be displaced by an asynchronous homepage action.

Foreground/background/current targets are validated server-side. Current navigation checks the original tab's window; an unchanged source URL reloads. Primary-modifier Enter forces a new tab; Shift targets background; Alt targets current (Alt wins over Shift). Commands/restores do not use navigation modifiers.

## UI isolation and accessibility

The palette is a native outer modal in a closed shadow root with a dedicated about:blank iframe containing the actual dialog. Keyboard events do not traverse the host page's capture/bubble listeners. Held-key tracking keeps the closing keyup in the frame; focus returns to the previous page element. There is no header/nav/close control. Result selection uses combobox arrows; input labels/hints convey the active scope. The UI uses textContent, native color-scheme/system colors, rem typography and contrast/forced-colors rules.

The page can still remove DOM; this is not a security boundary against hostile sites. No persistent content script, web-accessible resource, window.postMessage bridge, arbitrary HTML template or remote code is used. The mount function has no imported closure dependencies because scripting.executeScript serializes it.

## Commands and restoration

Only whitelisted actions execute. Source operations reload/duplicate/copy the browser-validated original tab. History/downloads use fixed Chrome URLs; Settings opens this extension's options. Copy returns source text for the palette to write using clipboardWrite without reading the clipboard.

Recently closed mode lists tab sessions from the 25 latest session entries and returns up to eight matching tabs; whole-window entries are excluded. Restore rechecks the session ID against current recent sessions, invokes the native restore and focuses its resulting window. It preserves the original browser session instead of creating a tab from its URL. This can restore into another window.

## Limits and checks

No exact Arc ranking/modifier parity is claimed. History candidate/fuzzy fallback bounds remain documented. Cross-profile tab search, native browser-shell replacement and unsupported Arc subsystems are out of scope. A provider failure may leave a blank tab created for the query.

Unit tests exercise APIs through fakes; real headless Chrome exercises DOM, keyboard, modes, stale/early replies, settings validation and native CSS appearance with API stubs. Actual extension/provider/session/clipboard integration and Chrome shortcut registration remain manual checks.

## Automatic site inference (0.12)

`site-discovery.js` examines current-window tabs plus 100 recent bookmarks and 250 recent history records on palette open. It accepts a single recognized search parameter on an observed HTTP(S) search endpoint, excludes credentials/token-like parameters, removes fragments/tracking/pagination, and replaces only the observed query value with `%s`. It retains at most 20 origins and never invents a generic search URL for a plain domain.

The UI derives name/domain-prefix/initials/ordered-letter candidates. Open tabs keep priority. Ambiguous matches remain explicit alternatives. Entering a site through a typed alias sends a validated remember-site action. Each alias is stored in its own storage.local key, avoiding a shared read-modify-write map across windows. A learned alias gets stronger priority than inferred aliases; only associations with currently known sites are accepted. Automatically inferred templates are kept in memory and revalidated from current source data on use.

The options page shows detected sites separately from manual overrides and supports clearing learned associations. Existing user-defined templates remain valid. Requested web/AI providers now have explicit templates in search-providers.js; other sites retain inference. There is no automatic network discovery, persistent browsing index or import of Chrome's protected keyword configuration.

## Tab order (0.13)

`tab-order.js` reads source-window tabs afresh for both suggestions and moves. It sorts by native index, validates integer IDs against that window, and resolves relative moves without trusting UI indices. Before-target indices account for removing the source tab. Pin state and group identity must match, and adjacent moves reject boundaries. The worker issues only tabs.move; no activation, navigation, persistence or new permission is involved. The two-stage Arrange UI uses the same debounced/cancelable suggestions and keyboard isolation as Search. Chrome state can still change between query and move; API failures remain visible for retry.

## Browser sections (0.14)

`browser-pages.js` owns the Chrome destination catalogue, translated aliases, ranked matches, reuse of open tabs and command entries. `suggestions.js` adds catalogue results after bounded source matching, independently of source availability. Empty input gets no catalogue rows. `model.destination` resolves only exact catalogue URLs (canonical trailing slash; no credentials, port, query or fragment). Unknown internal addresses retain the ordinary default-provider path. The UI treats catalogue results as explicit navigation, preserving URL completion and navigation modifiers. Browser-section commands resolve through the same catalogue after the command whitelist check. Nothing reads or modifies Chrome settings or password contents.

## Direct movement (0.15)

Alt+Left/Right and Alt+Shift+Left/Right (plus Alt+Home/End) move the currently selected open tab in Search/Arrange, or the source in destination mode. The action waits for final suggestions, validates cancellation revisions and uses the same worker move path. On success it returns to Arrange, retains any Arrange-list filter, and refreshes actual positions with the moved ID as preferred selection. The overlay stays open for repeated moves. Pending operations block unrelated mutations; repeated quick-move keys enter a FIFO queue; dismissal/mode changes cannot be overwritten by a late move response. Explicit before-placement retains its close-on-success behavior.

## Provider requests and recovery (0.16)

Inline aliases are exact-match only (single-character aliases included), with learned preference breaking ties. No guessing occurs for tied aliases. Explicit inline site intent precedes normal page suggestions; the default raw action remains available. The worker revalidates the destination using loadSites and encodes once. Before AI navigation, prompt-recovery.js writes independent UUID keys to memory-backed session storage. Cleanup uses one observed snapshot so concurrent new keys are not swept accidentally. Up to 20 copies remain; entries older than 24h cannot be listed/recovered. Restore validates ID and returns query/known alias, with no navigation. A missing provider returns query only. Login and provider URL behavior are outside extension control.

activity-store.js writes independent local keys after mutation success/failure, with optional text and configurable age/count retention. Suggestions and learned-alias writes are excluded; opening the history UI is excluded to avoid noise. Default labels include operation/provider/host or tab ID, omitting URL path/query. Settings validation bounds retention and count. Snapshot cleanup does not touch site settings or prompts. worker.js registers alarm/startup cleanup synchronously and rechecks on wake. Activity logging failures do not undo navigation; AI recovery save failures block the AI request. activity.html/js renders entries through textContent and provides search, settings and manual clearing; it has no host access.

## Overlay positioning (0.17)

Position is UI-local state. Footer pointer capture plus frame-document movement/up tracking handles native-modal backdrop retargeting. A completed drag suppresses its trailing click so it cannot dismiss the modal or activate a result; a new pointerdown clears that suppression. Geometry resolves from current bounds, with a fixed-position 16px gutter clamp. ResizeObserver and frame resize keep manual placement visible when dimensions change. Keyboard positioning runs before action-busy handling, separate from tab movement, and does not change query revisions or browser state. Closing destroys the frame and its listeners; no coordinates persist.

## Size, move queue and native popup fallback (0.18)

Manual corner size shares pointer tracking/trailing-click suppression with dragging, uses viewport-aware hard bounds and turns the dialog into a flex column so results absorb free height. ResizeObserver reapplies bounds without persisting geometry. No backdrop filter remains.

Quick moves preserve rendered rows, enqueue every key intent with the tab ID, and process one browser mutation at a time. The worker returns current orderSuggestions after moving; the client filters the snapshot locally and renders with preferred tab ID. No debounced updateSuggestions is invoked for each move. FLIP transforms use previous row positions and respect prefers-reduced-motion. Mode/dismissal revisions cancel queued future moves. Move journal writes start asynchronously so storage/expiry maintenance does not hold the navigation response.

Injection failures try a tab-specific action popup with source context in its URL, then clear the temporary popup setting in finally. palette-page.css supplies a 680×560 action-popup viewport; palette-page.js marks that surface before mounting. If action.openPopup is unavailable or rejects, the original native window path is retained. No privilege bypass, debugger permission or replacement of Chrome's built-in pages is attempted.

0.18.1 geometry fix: frame ResizeObserver and window resize events schedule coalesced frame-local rAF work, never write layout in the observer delivery itself. applyGeometry avoids rewriting equal inline values; sized-state attributes are only added once. pagehide disconnects the observer and cancels scheduled work. Vertical tab keys normalize to the existing previous/next placements, retaining one worker ordering model and the same FIFO/cancellation rules.
