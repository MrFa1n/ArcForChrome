# Search verification

## Automated

`npm run check` runs syntax checks and behavior tests for navigation, ranking, source failures, validation, manifest permissions, toolbar/shortcut routing and message handling.

`npm run check:browser` launches real headless Chrome with a disposable profile and stubbed runtime messaging. It verifies:

- Capture listeners registered on the page before search receive no palette letters, Space, arrows, Enter or Escape.
- Input, keyboard result selection, submission and held-key dismissal work.
- Closing search restores page focus and normal page shortcuts.
- Suggestion selection opens the saved URL, and delayed stale responses cannot overwrite a newer query.

The harness does not load the full extension or use a user's browser profile.

## Manual extension smoke checklist

- Reload/update from 0.6.1. Verify the sidebar entry, old keyboard commands and sidePanel/tabGroups permissions are gone; storage is used only for Site Search definitions in 0.11. Existing Chrome tabs/groups/pins remain intact.
- Click the toolbar button: search opens instead of a sidebar. Check Cmd+T on macOS or the assigned alternative.
- On an ordinary HTTPS page, search by open-tab title and URL. Existing tabs should appear first and activate without duplication.
- Visit and bookmark known URLs, including a bookmark with a custom title. Search by title/domain and verify source labels and URL deduplication.
- Enter on a bookmark/history result opens its actual URL in a new tab. The final Open row navigates/searches the raw input. Source tab remains intact.
- Type rapidly, move selection while loading and clear input. Old replies must not replace new results; empty search shows only tabs.
- Verify light/dark appearance, narrow widths, long titles, focus containment, IME and screen-reader announcements.
- With a video focused behind search, use Space/f/k/arrows. The video should not pause, seek, fullscreen or change volume until search is closed.
- On chrome://extensions and the Chrome Web Store verify popup fallback, source-window routing and close-on-success/Escape.
- In two windows verify each search lists only its source window's tabs. Closing a listed result before selection should show an error without breaking the palette.
- Check actual shortcut values after updating: Chrome may preserve previous user choices.

Full user-profile upgrade, real history/bookmark permission integration and site-specific UI checks remain manual.

## Homepage and Tab v0.8.0

- Unit tests verify deep-link to origin conversion, scheme/subdomain/port preservation, duplicate elimination and no domain actions for empty input or existing homepages.
- The real-Chrome regression verifies Tab emits no navigation, then Enter opens exactly the completed homepage/full-page URL; host page key listeners stay isolated.
- Manually search a known site with deep bookmark/history links. Verify Open host is clearly distinct from the saved page and open tabs stay above it. Test multiple same-origin results and saved root URLs.
- Select either a homepage or saved path, press Tab, edit the address, then Enter. Test Shift+Tab and Enter on the close control; test IME without accidental completion.

## Browser-native appearance v0.9.0

The real-Chrome harness verifies palette background/text equal native Canvas/CanvasText colors, emulates light→dark→light while the palette stays open, and verifies a larger frame base font scales search text. Captured light/dark screenshots were visually inspected. Existing interaction regressions continue to pass.

Manual integration:

- Change the effective Chrome/OS light/dark preference while search is open; verify its surface/text update. Test both ordinary-page overlay and protected-page popup.
- Change Chrome's default font size and sans-serif font. Verify text size/family on the next open and, where Chrome applies renderer preference updates immediately, while open. Check narrow-window overflow at large sizes and browser zoom.
- Test increased contrast, forced colors and keyboard focus visibility where supported.
- Confirm arbitrary installed-theme colors/backgrounds are not presented as synchronized; only rendering preferences are consumed.

## Local matching intelligence v0.10.0

Unit tests cover layout conversion in both directions, single edits/transpositions, short-query rejection, accents/multiple words, exact-domain ranking, native source variant queries and bounded recent fallback. Existing open-tab priority, domain actions and source validation tests continue to pass.

Manual checks: search GitHub with `пшерги` and `githbu`; search a Russian-titled page using the wrong English layout. Confirm correction labels, exact-result ranking, title aliases and preserved raw input. Inspect and edit a corrected suggestion through Tab; the raw Open row must still use the original text. Try unrelated short queries to check for noisy suggestions. Old typo-matching pages outside the recent fallback sample are not guaranteed to appear.

## Command Bar modes v0.11.0

Unit checks cover default-provider calls with tabId, background/current targets, source ownership, unchanged-URL reload, custom encoded site templates, command whitelist, session ID validation and restoration, and edit-shortcut context.

The real-Chrome harness now verifies empty Tab commands, keyword+Tab site scope, source URL editing, Shift/Alt Enter routing, recently closed selection, and real options-form rendering/save/unsafe-template rejection. It waits for suggestion responses and includes immediate Enter before the delayed final result, plus a normal `reload` search that must not execute a command. All Chrome services are stubbed. Screenshots of settings and palette were inspected.

Required manual integration in the installed extension:

- Reload/re-enable, review search/sessions/storage/clipboardWrite permissions, and verify Cmd+T/Cmd+L assignments. Check toolbar and dropdown entry paths if a binding is unavailable.
- Change Chrome's default provider, submit an ordinary query and confirm that provider is used. Test foreground/background/current targets and source-window routing from protected-page popup.
- Edit a normal URL, submit unchanged (reload), and submit an edited URL (same tab). Cmd/Ctrl+Enter must preserve the original and open a new tab. Move/close the original tab while a popup is open: current-tab actions must fail safely.
- Type `yt`, Tab, a query containing spaces and `&`, Enter. Repeat with custom templates saved via Settings. Verify no site query is sent before Enter; Escape/Backspace exit scope.
- In Commands test reload, duplicate, copy URL, history, downloads, settings and new window. Verify actual clipboard write on HTTPS, HTTP and the popup; never read clipboard contents automatically in tests.
- Close an actual tab with back/forward history; restore from Recently closed and Reopen command. Verify Chrome restores its session and appropriate window. Whole-window entries must not be listed as individual tab restores.
- Verify modes/settings/close are keyboard reachable, Escape cancels pending commits, and fullscreen video/page hotkeys remain isolated.
- Confirm no sidebar, pin-management or global MRU commands returned.

## Automatic Site Search v0.12.0

Unit tests cover conservative URL inference, unsafe/ambiguous URL rejection, origin deduplication, tracking removal, observed brand aliases, manual overrides and validated alias learning. The browser harness verifies automatically discovered site scopes and optional override forms. For manual testing, perform a search on a site, reopen the palette and try its name or abbreviation followed by Tab. Confirm that a chosen alias is prioritized on reopening and can be cleared in Settings. No fixed list of sites is preinstalled.

## README demonstration

Set `PALETTE_SCREENSHOT_DIR` to an existing directory when running the browser harness to capture the actual palette in Search, filtered tabs, Site Search, Commands and dark mode. Documentation captures use fictional page/tab data and stubbed browser APIs, not personal browsing history. See [assets/README.md](assets/README.md) for reproduction.
