# Search verification

## Automated

`npm run check` runs syntax checks and behavior tests for navigation, ranking, source failures, validation, search-only manifest permissions, toolbar/shortcut routing and message handling.

`npm run check:browser` launches real headless Chrome with a disposable profile and stubbed runtime messaging. It verifies:

- Capture listeners registered on the page before search receive no palette letters, Space, arrows, Enter or Escape.
- Input, keyboard result selection, submission and held-key dismissal work.
- Closing search restores page focus and normal page shortcuts.
- Suggestion selection opens the saved URL, and delayed stale responses cannot overwrite a newer query.

The harness does not load the full extension or use a user's browser profile.

## Manual extension smoke checklist

- Reload/update from 0.6.1. Verify the sidebar entry, old keyboard commands and sidePanel/tabGroups/storage permissions are gone. Existing Chrome tabs/groups/pins remain intact.
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
