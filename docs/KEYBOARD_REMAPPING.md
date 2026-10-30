# Command Bar keyboard guide

No additional application is needed. Suggested commands:

| Action | macOS | Windows/Linux |
| --- | --- | --- |
| Open Search | Cmd+T | Alt+Shift+K |
| Edit current URL | Cmd+L | Alt+Shift+L |

The user confirmed direct Cmd+T assignment in their Chrome. Cmd+L registration still needs actual-profile verification; the Edit dropdown is always available. Chrome may preserve old bindings after update or reject collisions. Check `chrome://extensions/shortcuts` rather than assuming changed manifest suggestions overwrite user settings.

Inside the palette:

- Empty Search + Tab: Commands.
- `yt` / `wiki` / `gh` (or a custom keyword) + Tab: Site Search.
- Selected URL + Tab: insert its address for editing without navigating.
- Up/Down: select a result. Tab/Shift+Tab also move between controls where not completing/entering a scope.
- Enter: open/execute selected result. In Edit it replaces the source page.
- Cmd/Ctrl+Enter: new foreground tab; Shift+Enter: new background tab; Alt/Option+Enter: source tab. These apply to URL/query navigation, not command/session results.
- Escape: exit the current scope, then close from Search. Backspace on empty site input: return to keyword.
- Repeating Search closes; repeating Edit while in Edit closes.

Navigation modifiers are an explicit extension contract, not verified exact copies of every Arc variant. Native tab-management shortcuts, sidebar/pin commands and global MRU are not implemented here.

Reference: https://developer.chrome.com/docs/extensions/reference/api/commands
