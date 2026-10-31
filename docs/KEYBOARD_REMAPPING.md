# Command Bar keyboard guide

No additional application is needed. Suggested commands:

| Action | macOS | Windows/Linux |
| --- | --- | --- |
| Open Search | Cmd+T | Alt+Shift+K |
| Edit current URL | Cmd+L | Alt+Shift+L |

The user confirmed direct Cmd+T assignment in their Chrome. Cmd+L registration still needs actual-profile verification; the Edit current URL command is available through `>`. Chrome may preserve old bindings after update or reject collisions. Check `chrome://extensions/shortcuts` rather than assuming changed manifest suggestions overwrite user settings.

Inside the palette:

- Empty Search + Tab: Commands.
- Detected site name/abbreviation + Tab: Site Search. Confirmed shortcuts are learned automatically; manual definitions are optional.
- Selected URL + Tab: insert its address for editing without navigating.
- Up/Down: select a result. Outside address completion/site/command entry, Tab keeps focus on the single input.
- Enter: open/execute selected result. In Edit it replaces the source page.
- Cmd/Ctrl+Enter: new foreground tab; Shift+Enter: new background tab; Alt/Option+Enter: source tab. These apply to URL/query navigation, not command/session results.
- Escape: exit the current scope, then close from Search. Backspace on empty site input: return to keyword.
- Repeating Search closes; repeating Edit while in Edit closes.

Navigation modifiers are an explicit extension contract, not verified exact copies of every Arc variant. Native tab-management shortcuts, sidebar/pin commands and global MRU are not implemented here.

Reference: https://developer.chrome.com/docs/extensions/reference/api/commands

Direct movement: select an open tab in Search or the `@` tab list. Alt/Option+Left/Right moves one position; add Shift for start/end. Alt+Home/End also maps to start/end. The palette remains open and the same tab stays selected after native-order refresh. Pin/group boundaries still apply.

Prefixes from Search: `>` commands, `@` arrange tabs, `<` recently closed. The remainder of a pasted prefixed query is preserved. Commands also include Edit current URL, Arrange tabs, Recently closed tabs and Search settings. Site names/aliases + Tab remain unchanged. There is no mode/settings/close toolbar. Escape closes from Search; from other scopes it returns a step. Backspace on an empty scoped query also goes back. No browser-global shortcut was added.

0.16: exact shortcut + space + query + Enter sends a site/provider request without Tab (g, ya/я, gpt, gem, claude, grok, pplx). `?` enters Recover AI prompts; Enter restores without sending and selects the service shortcut for redirection. `> Spotlight activity history` opens the journal; `> Clear saved AI prompts` clears session copies. Ordinary unknown prefixes remain default-provider queries.
