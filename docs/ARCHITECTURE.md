# Command Bar architecture

Manifest V3, native ES modules, no runtime packages. Chrome owns tabs/history/bookmarks/sessions. Only custom Site Search definitions are stored by the extension.

## Components

- `worker.js` registers `search-controller.js` synchronously at worker evaluation. Toolbar clicks/open-search invoke Search; edit-address invokes Edit. The controller accepts six typed message actions: suggest, activate, navigate, site, command and restore.
- `palette-service.js` validates sender and source context, queries tabs/settings, and injects the self-contained `mountPalette` function. Protected pages use `palette-page.js` with the original window/tab IDs in the popup URL. Source tab identity is taken from the browser sender or the validated extension popup URL, never an arbitrary message field.
- `model.js` distinguishes HTTP(S) URLs from search text. It does not construct a provider-specific search URL. `chrome.search.query` handles text against a newly created or explicitly selected source tab.
- `site-search.js` validates defaults/custom keywords, names and HTTP(S) templates. Queries are encoded once, replacing exactly one `%s`. `options.js` saves validated definitions to storage.local. No browsing history or choice log is persisted.
- `command-catalog.js` is a small whitelist with labels and aliases. Matching a word in normal Search never executes it. Sessions API results are separate restore actions, not history URL navigation.
- `suggestions.js`/`search-match.js` retain bounded local ranking, layout correction, typo tolerance, source warnings, URL deduplication and homepage actions.

## Modes and selection

Search, Edit, Commands, Recently closed and explicit site scopes are visible in the dropdown. Empty Search+Tab enters Commands; an exact site keyword+Tab enters Site Search; a highlighted URL+Tab completes its address. Escape returns a scoped mode to Search, then closes. Backspace on empty site input restores its keyword.

Raw navigation is last in Search, first in Edit and first after explicit Tab completion. Open tab results otherwise retain priority. Enter waits for the current debounced suggestion promise; edits, mode changes and dismissal increment the revision to cancel stale commits. Busy operations reject further input/selection; controls are reenabled on failure. A Tab-completed deep link cannot be displaced by an asynchronous homepage action.

Foreground/background/current targets are validated server-side. Current navigation checks the original tab's window; an unchanged source URL reloads. Primary-modifier Enter forces a new tab; Shift targets background; Alt targets current (Alt wins over Shift). Commands/restores do not use navigation modifiers.

## UI isolation and accessibility

The palette is a native outer modal in a closed shadow root with a dedicated about:blank iframe containing the actual dialog. Keyboard events do not traverse the host page's capture/bubble listeners. Held-key tracking keeps the closing keyup in the frame; focus returns to the previous page element. Tab can reach mode/settings/close controls. The UI uses textContent, native color-scheme/system colors, rem typography and contrast/forced-colors rules.

The page can still remove DOM; this is not a security boundary against hostile sites. No persistent content script, web-accessible resource, window.postMessage bridge, arbitrary HTML template or remote code is used. The mount function has no imported closure dependencies because scripting.executeScript serializes it.

## Commands and restoration

Only whitelisted actions execute. Source operations reload/duplicate/copy the browser-validated original tab. History/downloads use fixed Chrome URLs; Settings opens this extension's options. Copy returns source text for the palette to write using clipboardWrite without reading the clipboard.

Recently closed mode lists tab sessions from the 25 latest session entries and returns up to eight matching tabs; whole-window entries are excluded. Restore rechecks the session ID against current recent sessions, invokes the native restore and focuses its resulting window. It preserves the original browser session instead of creating a tab from its URL. This can restore into another window.

## Limits and checks

No exact Arc ranking/modifier parity is claimed. History candidate/fuzzy fallback bounds remain documented. Cross-profile tab search, native browser-shell replacement and unsupported Arc subsystems are out of scope. A provider failure may leave a blank tab created for the query.

Unit tests exercise APIs through fakes; real headless Chrome exercises DOM, keyboard, modes, stale/early replies, settings validation and native CSS appearance with API stubs. Actual extension/provider/session/clipboard integration and Chrome shortcut registration remain manual checks.
