# Arc for Chrome

An independent, Arc-inspired **Command Bar for Chrome**: local page suggestions, Site Search, browser actions and URL editing in one keyboard-driven overlay. Early MVP, v0.11.0. Not affiliated with Arc or The Browser Company.

## Install / update

1. Open `chrome://extensions`, enable **Developer mode**, then **Load unpacked** → this repository's `extension` directory (Chrome 116+).
2. For an existing installation, click its reload button. Version 0.11 adds permissions for default-engine search, session restoration, saved site definitions and copying the URL; Chrome may require re-enabling the extension after permission review.
3. Click the toolbar button or press **Cmd+T** on macOS (**Alt+Shift+K** elsewhere). **Cmd+L** opens URL editing (**Alt+Shift+L** elsewhere).

Chrome can preserve older assignments or reject conflicts. Check `chrome://extensions/shortcuts` if a suggested key is not active. The same modes are available from the dropdown in the palette, so they remain usable without remapping. No build, external helper, runtime dependencies or account required.

## Modes

| Mode | How to enter | Behavior |
| --- | --- | --- |
| Search | Cmd+T / toolbar / dropdown | Search open tabs, bookmarks and history; open addresses and default-engine queries |
| Edit current URL | Cmd+L / dropdown | Select the source URL for editing; Enter replaces that page, unchanged URL reloads |
| Commands | Tab on empty Search input, `>` prefix, or dropdown | Search explicit browser actions; ordinary search text never executes a command |
| Site Search | `yt`, `wiki` or `gh`, then Tab; or dropdown | Search YouTube, Wikipedia or GitHub directly |
| Recently closed | Dropdown | Search and restore a recently closed tab with its original browser session |

Escape returns from a scoped mode to Search; Escape in Search closes. Repeating Cmd+T closes the overlay; repeating the edit command in Edit mode closes it. Backspace on an empty site query returns to the site's keyword.

### Local suggestions

Search titles and URLs. Open tabs in the source window come first, followed by explicit homepage actions, bookmarks and history. Shared URLs are merged; selected open tabs activate without a duplicate. An **Open example.com** row opens the origin of a matched deep link without its path, query or fragment. Up to eight page results and three unique homepage actions are shown.

Up/Down selects, **Tab completes a selected address without navigating**, and Enter opens it. A Tab-completed full address remains the primary action even after asynchronous suggestions arrive. Empty-input Tab deliberately enters Commands instead. Modified Tab and Shift+Tab can move focus among controls.

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

### Site Search settings

Click **Settings** in the palette or the extension's options entry. Add up to 20 sites with a name, unique keyword and HTTP(S) search URL containing one `%s` query placeholder. For example:

- keyword: `docs`
- search URL: `https://example.com/search?q=%s`

Then type `docs`, Tab, your query, Enter. Only the query is URL-encoded. Settings are stored locally; Chrome's own internal keyword-search templates are not imported. Reopen the palette after saving changes. The options page also links to Chrome's search-engine and keyboard settings.

### Matching intelligence

Russian/English physical keyboard variants can recover `пшерги` → GitHub or `ghbdtn` → “Привет”. Longer words tolerate one insertion/deletion/substitution or adjacent transposition (`githbu` → GitHub). Accents are ignored when comparing candidates. Corrected results are labeled; typed input is never silently rewritten.

Within each source tier, exact domains and domain/title prefixes rank above incidental mentions; history recency breaks ties. Native history queries take up to 50 matches per layout variant. Only if no match exists, queries of 4–128 characters also check 100 recently added bookmarks and 100 recent history records. This is bounded local matching, not exhaustive fuzzy search or semantic AI.

## Page behavior and appearance

The source page stays open while searching. A dedicated modal iframe isolates its keyboard events from page/video shortcuts and restores page focus after dismissal. On protected pages where Chrome prohibits injection, a separate small search window uses the original source tab/window context.

Native CSS colors follow effective light/dark rendering preferences, with rem-based typography and contrast support. Custom profile accents, theme wallpaper and arbitrary Chrome theme images are not read. The original frosted-aperture extension icon is generated by `python3 scripts/generate-icons.py` (development only: Pillow).

## Privacy and permissions

No telemetry, backend, online autocomplete, permanent host access or persistent content scripts. Typing suggestions is processed locally. Selecting a web search contacts the default provider; Site Search contacts the chosen site; opening a URL or restoring a session contacts its destination normally.

| Permission | Purpose |
| --- | --- |
| `tabs` | Read tab titles/URLs and perform explicit navigation/actions |
| `activeTab`, `scripting` | Show search after explicit invocation |
| `history`, `bookmarks` | Read local matching suggestions; never edit/delete these sources |
| `search` | Execute queries through Chrome's selected provider |
| `sessions` | List and restore recently closed tabs |
| `storage` | Save only user-defined Site Search templates locally |
| `clipboardWrite` | Explicit Copy current URL action; clipboard contents are not read |

No sidebar, spaces UI, global tab cycling, MRU tracking or numbered pin commands. Native Chrome pins/groups/tabs are retained. Session restoration uses Chrome's original session destination, which can belong to a different window. A failed default-provider query can leave its newly created blank tab; the original page is unaffected.

## Development and verification

Node.js 22+:

```sh
npm run check
npm run check:browser
```

The browser regression launches a separate headless Chrome with a disposable profile. Default binary: standard macOS Chrome; set `CHROME_BINARY` elsewhere. It uses actual palette/options code with stubbed Chrome APIs, including a localhost-only static server for the settings form. Optional `PALETTE_SCREENSHOT_DIR` captures previews.

Actual installed-extension permissions, provider selection, session restoration, clipboard access and shortcut conflicts have a [manual checklist](docs/TESTING.md). See [architecture](docs/ARCHITECTURE.md), [shortcut guide](docs/KEYBOARD_REMAPPING.md), [historical Arc audit](docs/ARC_COMMAND_BAR_AUDIT.md), [work log](docs/WORK_LOG.md), [contribution guide](CONTRIBUTING.md) and [security policy](SECURITY.md).

MIT licensed. Not published to the Chrome Web Store. Supplied engineering guidelines are preserved in [SKILL.md](SKILL.md) and [docs/ub-mode.md](docs/ub-mode.md).
