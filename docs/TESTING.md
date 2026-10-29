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

## Keyboard isolation regression v0.3.1

Executed successfully in a separate real headless Chrome via `npm run check:browser`:

- Install window capture listeners BEFORE mounting the palette to reproduce aggressive page/video shortcut handlers.
- Type letters and Space, navigate with arrows, dismiss with Escape: no keydown/keypress/keyup reaches the page.
- Verify focus restoration and that page keyboard listeners resume after dismissal.
- Type and submit a query: navigation message contains the typed text, including when Enter closes the palette.
- Select an existing tab with the keyboard and confirm the activation message.
- Request dismissal with a key held; the palette stays until keyup, then disappears without leaking the final event.

This browser harness injects the real palette function with a stubbed runtime messaging API. Full extension loading, protected-page fallback and site-specific integration remain separate manual checks. Also verify with the user's video player: typing Space/f/k and arrow navigation should not pause, fullscreen, seek or alter volume while search is open.

## Local suggestions v0.4.0

Automated ranking/service tests cover title/URL matching, multiword queries, open-tab priority, URL deduplication, bookmark aliases for open tabs, invalid URLs/folders, limits, all-time history queries, source failure and window scoping. The real-Chrome harness also checks delayed suggestion responses: stale results must not replace a new query, and Enter must open the selected saved URL. Browser messaging is stubbed; actual permission prompts and Chrome history/bookmark API integration need the following manual checks:

- Reload/re-enable the extension and accept history/bookmarks permissions if prompted.
- Visit a known site, bookmark a different site with a custom name, and keep a third matching page open.
- Search by domain fragments and custom title words. Verify open tabs first, then bookmarks, then history, with readable source labels.
- Save a URL that is already open with a different bookmark name. Search that name; verify one result switches to the existing tab.
- Enter on the first open result activates it without changing tab count; history/bookmark selection opens the actual saved URL in a new tab.
- Select the final Open row to submit the raw input rather than a suggested result.
- Type quickly, use arrows during loading, clear input and close/reopen. No old response should overwrite a newer query or change a manually selected surviving result.
- Verify no history/bookmark results on empty input and no page/video hotkey regression.

## Recent-tab switching v0.5.0 (real extension check pending)

Unit tests cover non-positional recency, frozen-list cycling/wrapping, pause-to-toggle, manual selection, worker recreation, window separation, closure, cleanup, concurrent activation events and update failure recovery.

- Reload and verify the MRU shortcut assignment; clear any conflict with the older positional shortcut.
- Open A–B–C in that positional order, activate A → C → B, then invoke MRU: expect C. Repeat quickly: A, then B.
- Wait over 1.2 seconds, invoke again: expect the last active tab. Repeat with pauses: toggle the last two tabs.
- During a cycle click another tab normally; the next MRU starts from that new history.
- Close a candidate or move it to another window; verify it is never selected in the wrong window. A one-tab window is unchanged.
- Stop the extension service worker in DevTools, then invoke the command; session recency should survive. Reloading/updating the extension resets session storage and seeds from native timestamps.
- Verify the command with Chrome's vertical tabs, sidebar closed, and a video page focused. Confirm Ctrl+Tab retains native Chrome behavior.

## Numbered pinned tabs v0.6.0

- Pin at least three tabs, reorder them, assign Activate pinned tab 1..3 and confirm selection follows native pin order in the focused window with the extension sidebar closed.
- With nine pins plus regular tabs, verify pinned-tab-9 selects the ninth pin, not the final regular tab.
- Invoke an unfilled slot: no navigation, tab creation or regular-tab activation.
- Confirm activation updates the existing MRU history.
- Optional macOS profile: configure all emitted bindings before enabling Karabiner rules. Verify Cmd+T, Control+Tab and Cmd+1..9 only change behavior in Chrome stable. Disable each rule and verify normal behavior returns. Actual Karabiner/OS integration remains unverified.
