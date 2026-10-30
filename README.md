# Arc for Chrome

An independent, Arc-inspired **Spotlight-style command bar for Chrome**. Search open tabs, bookmarks, history and the web from one keyboard-driven overlay. Early MVP, v0.8.0. Not affiliated with Arc or The Browser Company.

## Install

1. Open `chrome://extensions` in Chrome 116+ and enable **Developer mode**.
2. Choose **Load unpacked** and select this repository's `extension` directory.
3. Click the extension's toolbar button, or press **Cmd+T on macOS** / **Alt+Shift+K on Windows and Linux**.

No build, dependencies, additional applications or account required. Pin the toolbar button if you want it always visible.

## Search

- Type part of a page title or URL. Matching open tabs in the current window appear first, followed by bookmarks and history. Shared URLs are merged.
- Press **Tab** to copy the selected suggestion URL into the search field without navigating. Edit it or press Enter. Shift+Tab moves focus between the input and close button.
- Matching saved/visited pages also offer explicit **Open example.com** homepage actions. These open the URL origin (no path, query or fragment), preserving scheme, subdomain and port. Existing open tabs remain first; homepage actions come before saved page suggestions.
- Use Up/Down and Enter, or click a result. An existing tab is activated; a saved/visited URL opens in a new tab.
- Choose the final **Open…** row to open the typed address or Google search in a new tab.
- Escape, outside click or the esc button closes search and restores page focus. Repeating the shortcut toggles the overlay.
- The page stays open while search is displayed. Keyboard events remain inside the search iframe, so page/video shortcuts do not receive them.
- Empty input shows only open tabs. History is searched across all dates, up to 50 matching history candidates; up to eight unique page suggestions and three homepage actions are displayed. Duplicate homepage actions are merged, and a homepage already present as a page result is not repeated.
- Local queries are debounced by 150 ms, and stale responses are ignored. If a source fails, the others remain usable with a warning.
- On protected pages such as `chrome://` and the Chrome Web Store, a small separate search window is used when injection is prohibited.

There is no online autocomplete. Google is contacted only when a user submits a Google search. New tabs open ungrouped in the source window.

## Updating from versions 0.1–0.6

Reload the extension in `chrome://extensions`. Version 0.7 removes the sidebar, spaces, tab cycling, MRU tracking, pin management, numbered-pin shortcuts and the optional external remapping integration. Native Chrome tabs, groups, pins, history and bookmarks are left intact. The toolbar button now opens search.

Only **Open Spotlight-style search** remains as an explicit keyboard command. Chrome may retain an older user assignment for this command: verify it at `chrome://extensions/shortcuts` if the default is not active. No profile files or OS settings are edited. [Shortcut details](docs/KEYBOARD_REMAPPING.md).

## Privacy

Everything is processed locally. No telemetry, backend, persistent browsing database, host permissions or persistent content scripts. Permissions:

| Permission | Purpose |
| --- | --- |
| `tabs` | Search titles/URLs in the current window; activate results and create new tabs |
| `activeTab`, `scripting` | Show the overlay only after explicit invocation |
| `history` | Read matching visited-page titles and URLs |
| `bookmarks` | Read matching bookmark titles and URLs |

History and bookmarks are never edited or deleted. Search state lasts only while the overlay is open. The extension no longer requests `sidePanel`, `tabGroups` or `storage`.

## Development

Node.js 22+:

```sh
npm run check
npm run check:browser
```

The browser regression uses a separate headless Chrome and disposable profile. The default binary is standard macOS Chrome; set `CHROME_BINARY` elsewhere. It exercises the real palette UI with a stubbed runtime messaging API. Full extension loading and real history/bookmark integration have a [manual checklist](docs/TESTING.md).

See [architecture](docs/ARCHITECTURE.md), [contribution guide](CONTRIBUTING.md), [security policy](SECURITY.md) and [work log](docs/WORK_LOG.md). Supplied engineering guidelines remain in [SKILL.md](SKILL.md) and [docs/ub-mode.md](docs/ub-mode.md).

MIT licensed. Not published to the Chrome Web Store.
