# Arc-style keys using Chrome settings

No additional software is needed. The user verified that assigning Cmd+T directly to our Spotlight command is accepted and works in their Chrome version. Version 0.6.1 suggests the following macOS defaults for supported extension actions:

| Chrome command label | macOS target | Setup |
| --- | --- | --- |
| Activate the extension | Cmd+S | Suggested default; toggles our side panel |
| Pin or unpin current tab | Cmd+D | Suggested default |
| Open Spotlight-style search | Cmd+T | Suggested default; user verified direct assignment |
| Activate pinned tab 1..9 | Cmd+1..9 | Assign individually in Chrome |
| Switch to recently active tabs (MRU) | Option+Shift+Left | Available fallback; Ctrl+Tab is not supported by documented Commands API keys |

Reload the extension, then open `chrome://extensions/shortcuts`. For each command, click the pencil and press its target keys. Keep scope **In Chrome**. Chrome may preserve existing assignments when an extension's manifest changes, so check the displayed values rather than assuming a reload changes them. There is no supported commands.update API for an extension to set user bindings.

Chrome allows at most four suggested defaults. All nine pinned-slot actions are declared but cannot all receive automatic defaults; they need individual assignment in this screen. A missing pinned slot does nothing. Native Cmd+9 selects the final tab, so binding our ninth-slot command is required for actual ninth-pin behavior.

Ctrl+Tab and Ctrl+Shift+Tab are Arc's recent-tab keys, but Tab is absent from the documented Chrome extension command key set. Do not promise those bindings or emit an invalid manifest. Keep the working MRU fallback unless the actual Chrome shortcut UI accepts and successfully executes an alternative. Our MRU action remains a timed 1.2-second cycle, not a modifier-release preview.

Cmd+W, Cmd+Shift+T, Cmd+R, Cmd+F and other native actions can retain Chrome behavior. Unsupported Arc features such as Little Arc and the browser's own sidebar replacement are not mapped to unrelated actions. Cmd+S here toggles only the extension side panel, not Chrome's native vertical tabs.

## Verification status

- Direct Cmd+T: confirmed working by the user in their Chrome.
- Manifest defaults: automated configuration checks.
- Cmd+D, Cmd+S and Cmd+1..9 assignments: require actual-profile verification.
- Agent UI application: blocked because Computer Use access to Google Chrome was not approved. No Chrome profile files or system preferences were edited.

The older Karabiner JSON in `integrations/karabiner/` is a historical optional artifact; it is not required or used by this setup. Do not enable it alongside direct bindings without reviewing its old emitted shortcuts.

Official references:

- https://developer.chrome.com/docs/extensions/reference/api/commands
- https://support.google.com/chrome/answer/157179?co=GENIE.Platform%3DDesktop&hl=en
- https://start.arc.net/command-bar-actions
