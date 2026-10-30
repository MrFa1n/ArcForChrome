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

## Homepage actions and address completion

The worker derives up to three unique HTTP(S) origin URLs from the eight matched page suggestions when input is nonempty. These are separate domain actions with an explicit Open host title and Homepage/New tab label. Origins preserve scheme, subdomain and port and remove credentials, path, query and fragment. Already suggested homepages are not repeated. Open tab suggestions stay first, then domain actions, then saved/visited page results, and finally raw-input navigation.

Plain Tab copies the selected result URL into the search input, places the caret at its end and starts a fresh debounced query without navigation. Shift+Tab moves between input and close. Enter on the close control closes instead of opening a result. No special Tab shortcut leaves the iframe or affects the host page. The self-contained mount function remains serializable for executeScript.

## Browser-driven appearance

Palette CSS uses Canvas, CanvasText, GrayText and Highlight instead of the former fixed lavender palette. Each frame explicitly opts into light/dark color-scheme and uses a medium root font with generic sans-serif; labels and input scale through rem. CSS preferences update without listeners, polling, storage or appearance permissions. More-contrast/forced-colors rules strengthen borders and selection contrast. The site is isolated from palette typography by the dedicated frame.

This follows the rendering preferences Chrome exposes to web content. It does not query a browser-theme API, Chrome profile color or wallpaper. User settings for a different generic font family need not affect sans-serif text. The application remains search-only and retains all keyboard and request-boundary behavior.

## Local query intelligence

`search-match.js` owns query normalization, Russian/English physical-key variants and bounded one-edit/adjacent-transposition word matching. Candidate text may include alternate bookmark/history titles already merged with a live tab. Exact hostname matches and hostname/title prefixes receive larger scores; source tiers remain the primary ordering key. Correction metadata is exposed as a UI label. Navigation parsing remains independent and retains the user's original query.

`suggestions.js` issues original/alternate-layout native source queries concurrently, tolerating partial failures. When no match exists for a 4–128-character query it adds at most 100 recently added bookmarks and 100 recent history records, then ranks again. This bounds fallback work without a persistent index. It does not claim to find every old misspelled bookmark or historical page. No new permissions or external intelligence services are used.
