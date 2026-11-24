# Command Bar keyboard guide

No additional application is needed. Suggested commands:

| Action           | macOS | Windows/Linux |
| ---------------- | ----- | ------------- |
| Open Search      | Cmd+T | Alt+Shift+K   |
| Edit current URL | Cmd+L | Alt+Shift+L   |

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

0.17: drag the footer/hint strip to position Spotlight within its viewport. Ctrl+Alt+arrows move it 16px; Ctrl+Alt+Shift+arrows move it 64px; Ctrl+Alt+0 resets. These shortcuts are local to the open palette and distinct from Alt+arrows tab reordering. Position is not persisted after closing.

0.18: the bottom-right resize handle supports pointer dragging. Shift+Tab reaches it; arrows resize, Shift gives 64px steps, Enter resets size. Ctrl+Alt+0 resets size and position. Quick Alt-arrow tab moves now queue repeated presses without clearing the result list. Browser-service response time still applies; unrelated actions wait until the move queue finishes.

0.18.1: Alt/Option+Up/Down now maps to previous/next tab positions, alongside Left/Right. Add Shift for first/last. Plain Up/Down still selects results; Ctrl+Alt+Up/Down still moves the overlay. Both orientation-friendly pairs are available simultaneously; no unsupported native tab-strip orientation inference is required.

0.19 groups: Shift+Space marks the highlighted open tab (or click its square); Cmd/Ctrl+G opens create/add with marked tabs, otherwise the highlighted/source tab. Type a name + Enter for a new group or ↓ choose an existing one. #name is an alternate picker prefix. Cmd/Ctrl+Shift+G removes selected tabs from groups. Cmd/Ctrl+Alt+G opens Manage tab groups, also available through >. Search+Esc clears marks before closing. Group operations keep the palette open. No new browser-global binding.

0.20 bookmarks: Cmd/Ctrl+D selects a save folder; Cmd/Ctrl+Shift+D selects a removal folder. The same marked tabs are used, otherwise highlighted/source tab. \*path opens save selection; > Bookmark selected tabs / > Remove selected bookmarks are fallback commands. Type folder name/path, arrows choose, Enter applies to that folder, Esc returns. Chrome may intercept native bookmark chords in some contexts; prefix/commands do not require global reassignment. The palette stays open with a result notice.

## Launcher actions v0.21

Inside Spotlight, Cmd/Ctrl+K toggles the Actions scope for the selected result (and current marks). Filter action titles, arrows choose, Enter runs; Escape returns to the original query/selection. Direct G/D group/bookmark chords use the same action definitions and remain available. Tab/Shift+Tab cycle input → Actions → resize; Shift+Tab from input still reaches resize directly. The footer uses platform modifier keycaps and the selected primary action.

$ opens named quicklinks; $work filters them. Manage quicklinks and Save selected page as quicklink are searchable commands. Actions offers save/rename/remove as applicable. Name entry uses Enter save and Esc cancel. Type 1250 \* 0.18 and Enter to copy 225 without dismissing Spotlight. For query redirection, Actions → Search this query with… → filter provider name → Enter; Escape preserves the previous query. Global Chrome shortcut assignment remains unchanged.

## Notes and complete discovery v0.22

Cmd/Ctrl+K now lists notes operations and the complete extension shortcut reference. All keyboard shortcuts enters its searchable directory; normal action rows run, Shortcut-labelled rows copy instructions and describe their required scope. Search includes English/Russian aliases. Actual global Search/Edit bindings come from commands.getAll, including unassigned/custom combinations, and are not claimed to be the defaults.

:query enters note title/body search. New note is an action/command. Inside the editor only, Cmd/Ctrl+Enter saves; Enter in body inserts a line, Enter in title moves to body, Escape cancels unsaved edits. Tab/Shift+Tab cycle title, body, Save, Actions and resize; Enter on Actions opens the menu, never saves the note. Escape from contextual help restores the editor. Ordinary URL modifiers and tab mutations do not run while typing in the note editor. Standard native editing keys remain available. No new global shortcut or permission was added.
