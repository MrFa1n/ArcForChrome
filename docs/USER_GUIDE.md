# User guide

An independent, Arc-inspired **Command Bar for Chrome**: local page suggestions, Site Search, browser actions and URL editing in one keyboard-driven overlay. Early MVP, v0.21.0. Not affiliated with Arc or The Browser Company.

## Install / update

1. Open `chrome://extensions`, enable **Developer mode**, then **Load unpacked** → this repository's `extension` directory (Chrome 116+).
2. For an existing installation, click its reload button. Version 0.11 adds permissions for default-engine search, session restoration, saved site definitions and copying the URL; Chrome may require re-enabling the extension after permission review.
3. Click the toolbar button or press **Cmd+T** on macOS (**Alt+Shift+K** elsewhere). **Cmd+L** opens URL editing (**Alt+Shift+L** elsewhere).

Chrome can preserve older assignments or reject conflicts. Check `chrome://extensions/shortcuts` if a suggested key is not active. Prefixes and commands provide alternate entry without global remapping. No build, external helper, runtime dependencies or account required.

## Modes

| Mode | How to enter | Behavior |
| --- | --- | --- |
| Search | Cmd+T / extension toolbar button | Search open tabs, bookmarks and history; open addresses and default-engine queries |
| Edit current URL | Cmd+L / `> edit current URL` | Select the source URL for editing; Enter replaces that page, unchanged URL reloads |
| Commands | Tab on empty Search input or `>` prefix | Search explicit browser actions; ordinary search text never executes a command |
| Site Search | A detected site name/shortcut + Tab | Search using a template observed in your browsing data |
| Arrange tabs | `@` prefix or Commands → Arrange tabs | Choose a tab, then a relative move or destination in the same window |
| Recently closed | `<` prefix or `> recently closed tabs` | Search and restore a recently closed tab with its original browser session |

Escape returns from a scoped mode to Search; Escape in Search closes. Repeating Cmd+T closes the overlay; repeating the edit command in Edit mode closes it. Backspace on an empty site query returns to the site's keyword.

### Local suggestions

Search titles and URLs. Open tabs in the source window come first, followed by explicit homepage actions, bookmarks and history. Shared URLs are merged; selected open tabs activate without a duplicate. An **Open example.com** row opens the origin of a matched deep link without its path, query or fragment. Up to eight page results and three unique homepage actions are shown.

Up/Down selects, **Tab completes a selected address without navigating**, and Enter opens it. A Tab-completed full address remains the primary action even after asynchronous suggestions arrive. Empty-input Tab deliberately enters Commands instead. Outside completion/scope entry, Tab keeps focus on the single search input.

The final **Open…** row uses the typed address or Chrome's chosen default search provider. Queries are not forced to Google. Enter waits for the current suggestion request rather than submitting a provisional result. Escape cancels a pending selection.

### Enter behavior

| Input | Action for URL/search results |
| --- | --- |
| Enter in Search | Activate selected open tab, or open selected URL/query in a new foreground tab |
| Cmd/Ctrl+Enter | Open in a new foreground tab, including a copy of a selected open tab |
| Shift+Enter | Open in a new background tab |
| Alt/Option+Enter | Replace the original source tab |
| Enter in Edit mode | Replace the original source tab |
| Cmd/Ctrl+Enter in Edit mode | Open a new tab instead |

Commands and session restoration have their own explicit actions; navigation modifiers do not redefine them. This is the extension's documented contract, not a claim to reproduce every Arc modifier exactly.

### Browser commands

Commands mode includes **Reload current page**, **Duplicate current tab**, **Copy current URL**, **Open browser history**, **Open downloads**, **Reopen last closed tab**, **Search settings** and **New browser window**. English labels and Russian aliases are searchable. There are no bulk-close or archive actions.

### Automatic Site Search

You do not need to define sites or shortcuts first. On opening the palette, the extension inspects open tabs, 100 recent bookmarks and 250 recent history records for actual search URLs. It recognizes common query parameters on search/results/find pages and derives a template from the observed URL. Site names, domain prefixes, brand initials (such as YouTube → yt, GitHub → gh when that name is available) and short ordered-letter matches can offer a site scope.

Type a name or abbreviation and choose the suggested site with Tab. If several sites match, choose explicitly with the arrows rather than relying on a guessed destination. Your confirmed alias-to-site association is saved locally and receives priority next time. Typed suggestions are not logged. Executed action metadata and separate temporary AI recovery copies follow the policy below. Sites are rediscovered on the next open; previously unseen sites with no observed search URL have a homepage action but no invented search endpoint.

Use **`> Search settings`** to see automatically detected sites or clear learned shortcuts. Manual definitions remain optional overrides for unusual search formats. Add up to 20 overrides with a name, unique keyword and HTTP(S) URL containing one `%s`, e.g. `https://example.com/search?q=%s`. Manual overrides default to empty. Google, Yandex, ChatGPT, Gemini, Claude, Grok and Perplexity are built in; other sites remain automatically discovered. An override replaces an automatically detected template for the same origin. Reopen search after changes.

Chrome's internal Site Search settings are not read, and automatic detection is a conservative heuristic, not support for every website or all historical records. Credential-bearing/ambiguous URLs are excluded, and no website is contacted during discovery.

### Matching intelligence

Russian/English physical keyboard variants can recover `пшерги` → GitHub or `ghbdtn` → “Привет”. Longer words tolerate one insertion/deletion/substitution or adjacent transposition (`githbu` → GitHub). Accents are ignored when comparing candidates. Corrected results are labeled; typed input is never silently rewritten.

Within each source tier, exact domains and domain/title prefixes rank above incidental mentions; history recency breaks ties. Native history queries take up to 50 matches per layout variant. Only if no match exists, queries of 4–128 characters also check 100 recently added bookmarks and 100 recent history records. This is bounded local matching, not exhaustive fuzzy search or semantic AI.

## Page behavior and appearance

The source page stays open while searching. A dedicated modal iframe isolates its keyboard events from page/video shortcuts and restores page focus after dismissal. On protected pages Chrome 127+ prefers a native toolbar popup in the source browser window; if unavailable/rejected it retains the legacy standalone popup window. Neither path injects into a chrome:// page.

Native CSS colors follow effective light/dark rendering preferences, with rem-based typography and contrast support. Custom profile accents, theme wallpaper and arbitrary Chrome theme images are not read. The original frosted-aperture extension icon is generated by `python3 scripts/generate-icons.py` (development only: Pillow).

## Privacy and permissions

No telemetry, backend, online autocomplete, permanent host access or persistent content scripts. Typing suggestions is processed locally. Selecting a web search contacts the default provider; Site Search contacts the chosen site; opening a URL or restoring a session contacts its destination normally.

| Permission | Purpose |
| --- | --- |
| `tabs` | Read tab titles/URLs and perform explicit navigation/actions |
| `activeTab`, `scripting` | Show search after explicit invocation |
| `history` | Read local suggestions without editing history |
| `bookmarks` | Read suggestions and explicit folder-scoped bookmark edits |
| `search` | Execute queries through Chrome's selected provider |
| `sessions` | List and restore recently closed tabs |
| `storage` | Site overrides/aliases, bounded action journal, local named quicklinks and temporary AI recovery |
| `alarms` | Schedule history expiry while Chrome runs |
| `tabGroups` | Group metadata, colors, titles and collapsed state |
| `clipboardWrite` | Explicit URL/calculation copying; clipboard contents are not read |
| `favicon` | Cached Chrome site icons, without an external favicon service |

No sidebar, spaces UI, global tab cycling, MRU tracking or numbered pin commands. Native Chrome pins/groups/tabs are retained. Session restoration uses Chrome's original session destination, which can belong to a different window. A failed default-provider query can leave its newly created blank tab; the original page is unaffected.

## Development and verification

Node.js 22+:

```sh
npm run check
npm run check:browser
```

The browser regression launches a separate headless Chrome with a disposable profile. Default binary: standard macOS Chrome; set `CHROME_BINARY` elsewhere. It uses actual palette/options code with stubbed Chrome APIs, including a localhost-only static server for the settings form. Optional `PALETTE_SCREENSHOT_DIR` captures previews.

Actual installed-extension permissions, provider selection, session restoration, clipboard access and shortcut conflicts have a [manual checklist](TESTING.md). See [architecture](ARCHITECTURE.md), [shortcut guide](KEYBOARD_REMAPPING.md), [historical Arc audit](ARC_COMMAND_BAR_AUDIT.md), [work log](WORK_LOG.md), [contribution guide](../CONTRIBUTING.md) and [security policy](../SECURITY.md).

MIT licensed. Not published to the Chrome Web Store. Supplied engineering guidelines are preserved in [SKILL.md](../SKILL.md) and [docs/ub-mode.md](ub-mode.md).

## Arrange tabs (0.13)

Find an open tab in ordinary Search and use Alt+Left/Right for an immediate move, Alt+Shift+Left/Right (or Alt+Home/End) for start/end. The overlay remains open, refreshes native positions and retains the moved tab’s selection. Type `@` to enter native-order tab browsing or `@query` to filter. Keyboard movement works there too. For precise placement, Enter chooses a tab, then a Move before destination; explicit placement closes the overlay. Escape returns from destinations to tab selection, then Search.

All actions resolve current positions through Chrome immediately before moving. Source and destination must still belong to the source window and have matching pinned/group states. Start/end uses the first/last tab of that section. A one-position move cannot jump over a group/pin boundary. Edges are harmless no-ops. Browser API failures leave the overlay open with an error. Tab-movement keys do not change membership. Group creation/membership and marked selection are described in 0.19; cross-window transfer remains outside scope. No new permissions or persistent tab-order state.

## Chrome sections (0.14)

Normal Search includes a static local catalogue of 20 Chrome destinations, matched by English/Russian names, aliases, keyboard-layout variants and typo tolerance. Matching browser sections (up to five) follow open tabs, precede homepage/bookmark/history rows, and are labelled Chrome page. Site scopes can still be offered after open tabs. An already open matching destination in the source window is reused, including when the live title does not match the translated alias. Empty search still lists only tabs.

Known catalogue chrome:// URLs resolve as navigation rather than default-provider queries, including Tab-completed addresses. URL/search navigation modifiers remain available. Unknown internal addresses and routes with query strings or fragments are not accepted as catalogue navigation. No restart/quit or other browser-action URLs are included. The same catalogue generates Commands entries; Chrome settings and extension Search settings remain separate. No settings values, passwords or installed-extension details are read.

The Extensions page address is documented in [Chrome’s installation guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked). Internal settings subroutes can vary across Chrome releases/platforms; actual installed-version destination checks remain manual.

## Single-input interface (0.15)

No header, mode dropdown, Settings button or close button. The input, results and contextual keyboard hints are the entire overlay. `>` enters Commands, `@` enters Arrange and `<` enters Recently closed from Search, preserving any pasted query after the prefix. Search settings, Edit current URL and Recently closed tabs remain searchable commands. Site names/aliases + Tab enter a site scope. Global Search/Edit shortcuts still work. Escape and empty-input Backspace return through scopes; Escape in Search closes. Pointer users can click results and dismiss via the backdrop. Input accessible labels/hints describe the active scope.

## Inline providers, recovery and action history (0.16)

An exact known/learned alias followed by whitespace and a nonempty query offers site-query results. A unique best alias is first; ties default to ordinary search until a site row is chosen. Loose/fuzzy matches do not route inline requests. Modifiers carry through, and Tab converts the row to a site scope without losing text. Provider URL templates live in search-providers.js; custom aliases/origins override defaults. Provider-side login/prefill/auto-send must be verified in the installed profile, especially Claude/Grok; no API integration or guaranteed auto-send is claimed. At the user's request, gem/gemini now targets Google Search dialogue/AI Mode with https://www.google.com/search?udm=50&q=%s, rather than the separate Gemini app. Tracking/session parameters from copied links are omitted. Google web search and AI Mode remain distinct even when a normal Google override exists.

AI prompts are copied before navigation into storage.session, at most 20 available for 24 hours in the loaded session. `?` or Recover AI prompts lists them; Enter restores text and selects the alias so a different service can be typed. Recovery does not submit until the next explicit action. Browser restart/extension reload/update/disable clears session storage. Clear saved AI prompts removes copies manually. See [Chrome storage lifecycle](https://developer.chrome.com/docs/extensions/reference/api/storage#property-session).

Spotlight activity history opens an extension page via Commands or Search settings. Defaults: enabled, 168 hours, 500 entries, no query text. Controls allow disabling recording, opting into text, 0–8760 hours (0 disables age expiry), 1–5000 records and immediate manual clearing. Older opt-in text is not scrubbed by disabling future text capture. Cleanup applies on writes/reads/startup and a Chrome expiry alarm. Results describe Chrome operation success/failure, not site-load or AI-answer status. AI recovery is separate and unaffected by journal text preferences. Data stays on-device; submitted URL queries can also appear in normal browser history/provider records.

## Overlay position (0.17)

The footer is a draggable handle (grab cursor) without adding a toolbar. Ctrl+Alt+arrows move the overlay 16px, Shift increases the step to 64px, and Ctrl+Alt+0 restores default centered placement. No tab action or navigation is performed. Position is clamped to a 16px viewport gutter and rechecked on window/dialog resize. New opens start at the default position. Protected-page fallback movement stays inside its native window; the OS title bar moves the whole window. No saved position or extra permissions.

## Resizing and continuous ordering (0.18)

The corner handle resizes width/height within 360×220 and 1000×800 CSS pixels, bounded to the viewport minus a 16px gutter on each side. Smaller viewports lower the minimum. Manual size uses a flex layout with a scrollable results area, surviving mode/result changes and viewport shrinking. Keyboard-focus the handle with Shift+Tab: arrows resize (Shift = 64px), Enter resets size; Ctrl+Alt+0 resets all geometry. No coordinates persist between opens. Background dimming remains; blur is removed.

Quick tab moves queue all incoming key repeats, serialize mutations and retain the current list until the next authoritative snapshot. The worker returns updated native-order rows with each move. There is no 150ms suggestion debounce or empty-list render between moves, and journal recording does not block the move response. Rows use a 120ms FLIP animation unless reduced motion is preferred. Escape/mode changes discard pending moves; a move already sent to Chrome cannot be undone by cancellation. Native Chrome tab-strip animation is controlled by Chrome.

Protected-page fallback uses [action.openPopup](https://developer.chrome.com/docs/extensions/reference/api/action#method-openPopup), generally available from Chrome 127. It is browser UI anchored at the toolbar, not a DOM overlay inside a privileged page. The [activeTab documentation](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab?abtest=true) documents restricted-page exclusion. Existing source-window/tab validation is retained. Temporary tab-specific popup configuration is cleared after opening/failure so future toolbar invocations keep normal behavior. Legacy window fallback remains for unsupported/failed popup API.

## ResizeObserver correction and vertical directions (0.18.1)

ResizeObserver callbacks now only schedule one coalesced requestAnimationFrame. Geometry writes happen afterward and skip unchanged inline values. This removes synchronous read/write feedback during popup/manual-size changes instead of hiding the browser error. The observer belongs to the frame and disconnects on pagehide. ResizeObserver errors are collected in both documents by the browser regression.

Tab order accepts Alt+Left/Right or Alt+Up/Down (previous/next); Shift maps both pairs to start/end. Native orientation is not exposed through the public tab/window APIs used here, so both pairs work without a setting. Chrome's Errors page retains previous errors; clear the old list after reloading before checking for recurrence.

## Tab groups and marked selection (0.19)

Shift+Space or the square beside an open tab marks it; marks survive filtering and mode changes until a successful group action, Search+Escape or dismissal. Cmd/Ctrl+G and # open group creation/addition; typing a name offers exact existing groups first, then Create and other matching groups. Cmd/Ctrl+Shift+G removes marked/highlighted tabs from their groups. If no tabs are marked, a highlighted Search/Arrange tab is used, falling back to the original page tab (especially through Commands). Up to 100 distinct tabs per mutation; stale, foreign-window and pinned group targets are rejected before any mutation. Grouping may naturally remove emptied old groups through Chrome.

Cmd/Ctrl+Alt+G or Manage tab groups opens source-window groups. Enter a group to rename, choose one of Chrome's nine colors, toggle collapsed state or dissolve its membership with Ungroup · Keep all tabs open. This never invokes tab closure or saved-group deletion APIs. Native sync effects follow Chrome; no promise of preserving a saved copy after native ungrouping is made. Group creation and naming use two Chrome calls: if naming fails after creation, the error explicitly reports that tabs were grouped and can be renamed via Manage. Operations remain open for further work and are recorded as group action metadata in the local journal.

The tabGroups permission is added for group metadata/update; tabs.group/ungroup provides membership. Source-window checks apply to both service-page popup and injected overlay. Ordinary page results show group titles after browser suggestions resolve. Shortcuts are local, not new global command registrations. If an OS/browser intercepts a chord, use # or searchable commands instead.

## Visible group labels (0.19.1)

Search, Arrange and before-placement results carry shared source-window group metadata. Grouped tabs show a named color badge and a matching left border; collapsed state is included. Group pickers also use group colors. Missing metadata falls back to a neutral Grouped badge without dropping tabs. Labels use textContent and truncate visually, retaining the full name in a tooltip. These annotations do not change ranking or native tab order.

## Folder-scoped bookmarks (0.20)

Use marked tabs or the highlighted/source tab. Cmd/Ctrl+D opens save-folder selection; Cmd/Ctrl+Shift+D opens removal selection. *path enters save selection directly, with searchable commands as an alternative when Chrome intercepts a chord. Targets freeze on entry and remain unchanged when switching add/remove in that picker. Name/path matching is local, with up to 100 folder results; more specific text can find later folders. Account/device roots are distinguished when Chrome exposes syncing metadata.

The complete path is shown (and available as a hover title). Root/managed folders are excluded. Saving canonicalizes HTTP(S)/known Chrome section URLs, rejects embedded credentials/unsupported schemes, deduplicates selected URLs and skips copies already directly in the destination without overwriting custom titles. Removal lists folders containing selected URLs and shows count; it removes all matching direct bookmark copies, not nested records, folders, unrelated pages or copies elsewhere. No selection action navigates or closes tabs. Native syncing may propagate changes.

Mutation-time revalidation uses fresh tabs/tree/children; selected IDs must be distinct, current-window and bounded to 100. Extension-originated writes serialize to avoid own concurrent duplicate creation. Chrome provides no multi-record transaction: partial API failure reports the completed count and retains those changes. Retry refreshes state and skips successful additions. The footer reports success/skips and chosen path, and the palette stays open. Creating folders and arbitrary saved-bookmark editing are outside this feature. No new permission beyond the existing bookmarks grant.


## Compact launcher actions v0.21

Select a result → Cmd/Ctrl+K or Actions → filter/choose an operation → Enter. Escape restores the selected result and original query. This reuses direct group/bookmark hotkeys and marked tabs, with no permanent extra panel. The footer shows the applicable primary action and keyboard keycaps. Empty Search includes open tabs, quicklinks, recent action-journal entries and frequent/starter commands; clicking recent activity views the journal without replaying it.

For another destination, use Actions → Search this query with…, filter the provider/site name, Enter. The outgoing text is separate from the filter. Recognized leading provider aliases are removed on redirect; cancel preserves the original input. Without local matches, Google/ChatGPT/Google AI Mode are also offered below default search. Existing inline aliases and recovery remain available.

Quicklinks: select a web result → Actions → Save as quicklink… → name → Enter. Search saved names in ordinary Search or use $ / $work; Manage quicklinks is a command. Actions on a link offers rename/remove; Save selected page as quicklink in Commands uses the original page. Limits: 100 links, names of 1–80 characters, HTTP(S) without embedded credentials. Records persist locally until explicitly removed, independently of native bookmarks and action retention; no automatic sync.

Calculator: 1250 * 0.18 → 225; Enter copies the result while keeping the overlay open. Arithmetic supports parentheses, + - * / ^ %, unary signs, × ÷ −, right-associative powers and 12-significant-digit formatting. % means remainder. No eval, network, calculator history or currency/date/unit conversion. Invalid expressions remain normal search input. URL/result copying reads no clipboard content.

Site icons use Chrome's cached favicon endpoint and the new favicon permission, with generic fallback and no third-party icon service. They load separately from suggestions. Reload/re-enable the extension after updating if Chrome requests permission review. See README for current [workflow screenshots](../README.md#more-from-one-search-field).
