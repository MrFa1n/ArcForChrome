# Arc for Chrome

An independent, Arc-inspired Chrome extension with a calm vertical tab sidebar. **Early MVP, v0.2.0.** Not affiliated with Arc or The Browser Company.

## Install locally

1. Use Chrome 116 or newer.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select this repository's `extension` folder.
4. Pin the extension's toolbar action and click it to open the sidebar. The suggested shortcut is **Alt+Shift+A**; customize it at `chrome://extensions/shortcuts` if unavailable.
5. For an Arc-like placement, choose the left side in Chrome's side panel settings (location varies by Chrome version).

No build step, account or dependency installation is required.

## What works

- Vertical tabs scoped to the current window, active-tab indication and audio indicator.
- Favorites backed by Chrome pinned tabs and visible in every space.
- Spaces backed by native Chrome tab groups. Existing groups appear automatically.
- Inbox for ungrouped tabs, plus search across all spaces in the current window.
- Create spaces and tabs; activate, pin, unpin or close tabs.
- Search matches tab titles and URLs. Press Enter to open a web address or Google search in a new tab in the selected space; click a result to activate it.
- Automatic light/dark appearance and a session-only theme toggle.

Pinning a grouped tab removes it from its Chrome group. Unpinning returns it to Inbox. Space selection filters the sidebar; it does not hide other tabs in Chrome. Closing the last tab in a space removes its native group. Creating a space opens a new tab so the group can exist.

## Chrome limitations

An extension cannot replace Chrome's native tab strip or browser frame. This project uses the supported Side Panel API. No split view, Little Arc, automatic tab archive, profile isolation or Arc data import is implemented yet. Tabs have letter icons; external favicon services are not contacted.

## Privacy and permissions

`tabs` reads titles/URLs and manages tabs. `tabGroups` reads and manages spaces. `sidePanel` displays the interface. No host permissions, content scripts, telemetry, remote code or backend. Chrome owns tab persistence; the extension keeps no separate browsing database. Submitting a search sends the entered query to Google; opening a URL contacts that site as normal.

## Development

Node.js 22+:

```sh
npm run check
```

Load `extension/` unpacked, then reload it on the extensions page after edits. Automated checks cover domain behavior, manifest entry points and worker startup/error handling. Browser UI coverage is currently manual; follow [the smoke checklist](docs/TESTING.md).

See [CONTRIBUTING.md](CONTRIBUTING.md), [architecture](docs/ARCHITECTURE.md), [work log](docs/WORK_LOG.md), and [security policy](SECURITY.md). Original supplied skill documentation is preserved in [docs/ub-mode.md](docs/ub-mode.md) and [SKILL.md](SKILL.md).

## Roadmap

1. Verify and polish the MVP in real Chrome on macOS, Windows and Linux.
2. Tab movement between spaces, reordering and keyboard navigation.
3. Saved favorites and space appearance preferences.
4. Optional archive with explicit retention controls and recovery.

MIT licensed. This project is not published to the Chrome Web Store.

## Keyboard shortcuts

Commands work while Chrome is focused, including when the panel is closed:

| Action | Default (macOS: Alt = Option) |
| --- | --- |
| Open sidebar | Alt+Shift+A |
| Pin/unpin active tab | Alt+Shift+P |
| Previous tab in current window | Alt+Shift+Left |
| Next tab in current window | Alt+Shift+Right |

Inside the focused sidebar: Cmd/Ctrl+K focuses and selects search; Up/Down move from search through tab buttons; Enter activates the focused tab (Enter in search opens a URL/search); Alt+Left/Right cycle spaces; Escape clears search and dismisses the space form. Search receives focus when a panel document first opens.

Expand **Keyboard shortcuts** in the sidebar to see actual registered bindings, including missing assignments, and click **Customize shortcuts** to open `chrome://extensions/shortcuts`. Reload the extension after updating. Existing user assignments are controlled by Chrome and may differ from defaults.

Chrome reserves some browser/OS shortcuts, so Arc's Cmd+T command bar and Cmd+S sidebar behavior cannot be promised as direct replacements. Native Chrome shortcuts such as Cmd/Ctrl+T, W and Shift+T retain their normal behavior. See [Chrome Commands API](https://developer.chrome.com/docs/extensions/reference/api/commands).
