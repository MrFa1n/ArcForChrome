# Manual Chrome smoke checklist

Not yet executed in a real browser for v0.1.0.

- Load `extension/` unpacked; verify no manifest or service-worker errors.
- Click toolbar action; verify sidebar opens. Verify shortcut or configure one.
- Open two windows; verify each panel lists only its host window's tabs.
- Activate, close and pin tabs; verify native Chrome state and panel agree.
- Create a named space; verify a native purple group and new tab appear.
- Create a tab within a space; verify it belongs to that group.
- Rename/remove groups using Chrome; verify the panel updates and falls back to Inbox when necessary.
- Pin a grouped tab; verify it becomes a favorite. Unpin; verify it appears in Inbox.
- Search by mixed-case title and URL across spaces; click a result.
- Submit a domain, an HTTPS URL and plain search text; verify destinations.
- Submit empty input; verify no tab is opened. Submit HTML-like text; verify it never executes as markup.
- Navigate controls using Tab/Shift+Tab and Enter; verify visible focus and control labels.
- Check both themes and narrow panel widths; long titles should truncate.
- Reload extension with existing groups; verify groups and favorites remain.

## Keyboard iteration v0.2.0 (manual verification pending)

- Reload the extension; inspect actual assignments under Keyboard shortcuts and in Chrome's shortcut settings.
- With focus on a webpage and the panel closed, pin/unpin the active tab and cycle previous/next tabs, including wraparound. Verify only the current window changes.
- Open the panel with Alt+Shift+A; on first load verify search focus. Test Cmd/Ctrl+K within the panel.
- Type a search; use Up/Down then Enter to activate a result. Enter in the search field must still create a URL/search tab.
- Alt+Left/Right cycles Inbox and spaces in both directions, including wraparound.
- Escape dismisses space creation and clears the search. Verify normal text input and IME composition remain usable.
- Remove a shortcut assignment in Chrome and reopen the panel; verify it displays Not assigned. Restore a custom binding and verify it executes.

## Command palette v0.3.0 (manual verification pending)

- Reload the extension, review any new permission prompt, and confirm Open Spotlight-style search is assigned in Chrome settings.
- On an HTTPS page with focus in a text field, press Alt+Shift+K. Verify a centered modal, dimmed backdrop, focused search, and unchanged source tab URL/count.
- Escape, outside click, esc button, and invoking the command a second time each dismiss the overlay and restore prior focus. Repeat opening to check no duplicate overlays or listeners remain.
- Enter an address or plain text and press Enter. Verify a NEW tab opens and the source tab remains intact. Type HTML-like input and verify it stays text. Empty Enter may select the first existing tab but never creates a blank tab.
- Search for another tab, use Down then Enter, and verify the existing tab activates without duplication. Test clicks, both arrow directions, wrapping, IME composition and focus containment with Tab/Shift+Tab.
- Open from chrome://extensions and the Chrome Web Store; verify the fallback popup works, creates tabs in the original window, and closes on Escape/success. Check activation returns focus to the original window.
- Close a matching tab while the palette is open; selecting it should display an error and leave search available.
- Test dark/light appearance, small window widths, long titles/URLs and screen-reader combobox/listbox announcements.
