# Optional macOS keyboard mapping

The extension exposes actions; a system remapper can translate familiar physical keys into their Chrome extension bindings before Chrome handles them. No system configuration is changed by this repository.

## Prepared Karabiner-Elements profile

`integrations/karabiner/arc-for-chrome.json` contains three independently enabled rules, restricted to Google Chrome stable (`com.google.Chrome`):

| Physical keys | Emitted extension binding | Action |
| --- | --- | --- |
| Cmd+T | Option+Shift+K | Spotlight command bar |
| Control+Tab | Option+Shift+Left | Timed MRU switching |
| Cmd+1..9 | Option+Shift+1..9 | Pinned tab slots 1..9 |

First reload the extension and open `chrome://extensions/shortcuts`. Confirm Spotlight and MRU assignments match the table. Assign each **Activate pinned tab N** to **Option+Shift+N** before enabling the numeric rule. Chrome may report conflicts; clear/reassign them deliberately. Missing slots do nothing instead of selecting a regular tab.

Install Karabiner-Elements from its official site if you choose to use it, and follow its setup/permission prompts. Copy the supplied JSON file into `~/.config/karabiner/assets/complex_modifications/`, then enable the desired rules in Karabiner's Complex Modifications section. For other Chrome channels, use EventViewer to determine the actual bundle identifier and adjust the application condition. Other applications are excluded. Disable a rule there to restore the physical shortcut's native behavior.

The MRU action is the existing 1.2-second timed cycle. Holding Control does not create an Alt-Tab preview or commit on modifier release. Control+Shift+Tab is not remapped by this profile. More elaborate native-style switching needs a separate implementation. OS-reserved/system-secure combinations can still take priority; this profile is not a guarantee for every key or input source.

The JSON format and application restriction follow official Karabiner documentation. Automated checks validate the prepared file's structure and target action declarations; Karabiner itself and macOS key routing have not been tested on this machine. This is optional configuration, not an installed component or a dependency of the extension.

## Other ways to remap

Chrome's `chrome://extensions/shortcuts` configures extension commands, not a complete editor for all Chrome keyboard actions. Some Chrome/OS shortcuts have priority. Assigning a colliding binding must be checked on the actual Chrome/macOS version; do not assume all browser shortcuts are unchangeable, or that all are replaceable.

macOS System Settings → Keyboard → Keyboard Shortcuts → App Shortcuts can assign shortcuts to existing menu items by their exact displayed title. This helps with menu actions, but does not directly invoke an arbitrary extension command. A Chrome-scoped system remapper is the broader option for our Spotlight/MRU/pin actions.

Official references:

- https://developer.chrome.com/docs/extensions/reference/api/commands
- https://support.google.com/chrome/answer/157179?co=GENIE.Platform%3DDesktop&hl=en
- https://support.apple.com/guide/mac-help/create-keyboard-shortcuts-for-apps-mchlp2271/mac
- https://karabiner-elements.pqrs.org/docs/json/complex-modifications-manipulator-definition/conditions/frontmost-application/
- https://karabiner-elements.pqrs.org/docs/manual/configuration/add-your-own-complex-modifications/
