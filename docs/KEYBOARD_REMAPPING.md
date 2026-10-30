# Search shortcut

Only **Open Spotlight-style search** is declared as a keyboard command:

| Platform | Suggested default |
| --- | --- |
| macOS | Cmd+T |
| Windows/Linux | Alt+Shift+K |

The toolbar button opens the same search. Within search: Up/Down select results, Tab completes the selected address without navigating, Enter opens, Escape closes; normal typing and editing work in the input.

The user confirmed direct Cmd+T assignment works in their Chrome version. Existing Chrome user assignments may be preserved on reload/update. If the shortcut differs, open `chrome://extensions/shortcuts` and change this single command. Keep scope **In Chrome**. Chrome handles conflicts; an extension has no supported API to overwrite user bindings.

Version 0.7 removes the earlier sidebar/pin/MRU commands and external remapping configuration. No additional applications are required. Native Chrome commands remain under Chrome's control. The implicit “Activate the extension” action, if Chrome shows it, invokes search through the toolbar handler and has no explicit suggested binding from this project.

Reference: https://developer.chrome.com/docs/extensions/reference/api/commands
