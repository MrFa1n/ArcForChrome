# Work log — 2026-10-30

1. Read supplied README and ub-mode skill; preserved original README in `docs/ub-mode.md` before replacing the root README with project documentation.
2. Inspected Node/Git/tool availability. Node 22 is available. Crapper, Dryer and Mutator are absent; their quality gates were not executed.
3. Attempted `git init -b main`; environment denied creation of `.git` (`Operation not permitted`). No commits or push were possible. No remote was provided. No permission escalation was attempted because sandbox approvals are disabled.
4. Checked Chrome's official Side Panel documentation to choose supported MV3 APIs: https://developer.chrome.com/docs/extensions/reference/api/sidePanel .
5. Wrote behavior tests first; confirmed failure due to the missing model, then implemented filtering and safe navigation. Six tests passed.
6. Implemented the native sidebar, Chrome groups as spaces, pinned tabs as favorites, search, tab controls, themes and event-driven refresh. Avoided a parallel persistence layer and external runtime dependencies.
7. Reviewed form submission handling and ensured preventDefault runs synchronously; added manifest and worker lifecycle/error tests.
8. Added MIT license, contribution and security guidance, architecture, limitations, installation instructions, roadmap, manual smoke checklist and GitHub Actions checks.
9. Ran syntax checks and all nine automated tests successfully. Real Chrome loading, visual inspection and manual interaction remain unverified.

Originally planned commit sequence (implementation and tests were ultimately committed together):

1. `docs: preserve supplied engineering guidelines`
2. `feat: add native Arc-inspired sidebar with spaces and favorites`
3. `test: verify tab model and extension lifecycle`
4. `docs: add open source policies and Chrome smoke checklist`

Each commit body should state its rationale and the checks actually run. Publishing and pushing require a configured repository destination.

## Git access restored

10. User enabled approval requests. Ordinary sandboxed Git writes still fail, but approved elevated Git commands work. Initialized the `main` branch and committed the preserved instructions separately from implementation and tests.
11. Re-ran `npm run check`: all nine tests and syntax checks pass. Committed project documentation and this log as the final bootstrap unit. Real browser verification remains pending. No remote is configured, so no push was attempted.

## Keyboard iteration v0.2.0

12. Reviewed current commands and official Chrome Commands API limits. Kept four suggested bindings and added no permissions.
13. Added failing behavior tests, then implemented active-tab pin toggling, bidirectional tab cycling and pure space cycling. Added a worker entry point to register commands synchronously.
14. Added panel search focus, arrow-key result navigation, space cycling and Escape handling. Used physical KeyK to support alternate keyboard layouts. Added actual-assignment display and Chrome shortcut settings link.
15. Updated installation/keyboard documentation and manual smoke checklist. `npm run check` passes 13 tests and syntax checks. Real Chrome keyboard and visual checks remain pending. Crapper, Dryer and Mutator remain unavailable.

## Spotlight-style search v0.3.0

16. User requested a command bar over the current page without closing the tab. Reviewed Chrome activeTab/scripting guidance and used explicit-invocation injection rather than permanent site access.
17. Wrote failing service behavior tests before implementation. Added isolated-world modal UI, search snapshot, arrow/Enter selection, dismissal/focus restoration, and a protected-page popup fallback.
18. Added validated message actions for new-tab navigation and existing-tab activation. Confirmed source tabs are not updated or removed when opening search or submitting a query. Documented new activeTab/scripting permissions, fallback, result limits and four-binding default tradeoff.
19. Ran npm run check: 21 tests and all JavaScript syntax checks pass. Browser visual/keyboard verification remains pending; no claim of completed real Chrome QA. Crapper, Dryer and Mutator remain unavailable.

## Keyboard isolation fix v0.3.1

20. User reported video-page shortcuts firing while search is open. Added a dependency-free real-Chrome/CDP regression with capture listeners registered before the palette. Observed the expected failure: parent window received keydown, keypress and keyup for letters, Space and arrows.
21. A sandboxed Chrome launch failed; reran with approved elevated execution and a separate temporary profile. No user's browser profile was used.
22. Moved search into an about:blank iframe inside the outer modal. This removes page listeners from the keyboard event path, rather than relying on late propagation cancellation. Kept the mount function self-contained for scripting.executeScript.
23. Deferred dismissal while keys are held so closing Enter/Escape keyup stays in the frame. Clear stale held-key state on browser focus loss. Preserved focus restoration and repeated-command dismissal.
24. Expanded and passed the real Chrome regression for text, Space, arrows, Escape, Enter submission, tab activation, held-key dismissal and resumed page shortcuts. npm run check passes all 21 tests and JavaScript syntax checks; git diff --check passes. Updated docs and version to 0.3.1. Full extension/site-specific manual checks remain pending; Crapper, Dryer and Mutator remain unavailable.

## Local suggestions v0.4.0

25. User requested URL/title suggestions from browser history/bookmarks and highest priority for open tabs. Reviewed official Chrome history/bookmarks APIs. Added tests first and observed the missing-module failure.
26. Added read-only source queries and pure ranking: tabs first, then bookmarks, then history; shared URLs merge without duplicate tab creation, including matches through saved title aliases. Exclude bookmark folders and unsafe saved URL schemes. No external service or persistent browsing database added.
27. Added a validated suggestion message, 150 ms input debounce, stale-response protection, source labels, explicit raw-input navigation row and per-source error handling. Added history/bookmarks permissions and documented Chrome's update prompt.
28. Expanded the real-Chrome regression to simulate delayed responses and verify Enter opens the newest selected saved URL while page shortcuts stay isolated. Browser regression passed; actual Chrome history/bookmark API and permission-prompt integration remain manual. Final unit/syntax results recorded below.
29. Final validation: npm run check passes 32 tests and all JavaScript syntax checks; git diff --check passes. Crapper, Dryer and Mutator remain unavailable. Preserved the dependency-free runtime and existing iframe keyboard isolation.

## Recently active tab switching v0.5.0

30. User requested Arc-like switching by recent activity rather than tab position. Checked Chrome Commands and Storage APIs. Added failing behavior tests before the implementation.
31. Implemented single-writer per-window activation tracking in storage.session, seeded by native lastAccessed data when available. Added frozen MRU traversal for quick repeats, last-active toggling after a 1.2-second pause, cleanup on tab/window removal or detach, worker-recreation continuity, and recovery after update failures.
32. Registered native activation events and a dedicated recent-tab command on Alt+Shift+Left, usable without the sidebar. Kept positional navigation commands for manual assignment and respected Chrome's four-suggested-binding limit. Added storage permission and documented that Ctrl+Tab is unchanged, initial recency is seeded, and the cycle is timed rather than modifier-release-based.
33. Final validation: npm run check passes 41 behavior tests and syntax checks; git diff --check passes. Real extension shortcut/storage lifecycle verification remains on the manual checklist. Crapper, Dryer and Mutator remain unavailable. No remote is configured for push.

## Numbered pins and optional remapping v0.6.0

34. User requested Arc-like pinned-tab keys Cmd+1..9, then asked about remapping Chrome keys more broadly. Checked official Chrome shortcuts and Commands documentation: native Cmd+1..8 are positional, Cmd+9 is final-tab; extension command assignment is not a universal browser shortcut editor.
35. Wrote failing numbered-pin tests, then implemented nine current-window commands sorted by native pinned-tab index; missing slots do nothing. All nine are manually assigned to avoid exceeding four suggested defaults. No new permissions.
36. Prepared an optional Chrome-stable-only Karabiner profile for Cmd+T → Spotlight, Control+Tab → timed MRU, and Cmd+1..9 → manually assigned pinned-slot commands. Documented setup, limitations, rollback and sources. Did not install Karabiner or alter system/user settings. Clarified that earlier blanket statements about all Chrome shortcuts being unchangeable were too broad.
37. Final validation: npm run check passes 46 tests plus JavaScript syntax checks; git diff --check passes. Native Cmd-number assignment and optional Karabiner routing remain manual checks. Crapper, Dryer and Mutator remain unavailable; no remote configured for push.

## Arc-style macOS defaults v0.6.1

38. User confirmed direct Cmd+T assignment works and requested Arc-style keys without extra applications. Rechecked the Commands API: four suggested defaults; Tab absent from supported key names; no command-assignment setter. The former broad claim that Chrome key collisions cannot be overridden was incorrect.
39. Attempted direct Chrome UI access, but Computer Use reported it was not approved. Did not bypass that restriction through profile-file edits or alternate automation. Actual profile assignments remain unapplied by the agent.
40. Added a failing configuration test, then changed macOS suggestions to Cmd+T (Spotlight), Cmd+D (pin), Cmd+S (our sidebar). Kept MRU fallback and all nine manually assignable pin commands. Rewrote the setup guide around built-in Chrome settings, preserving the user's no-extra-app constraint and documenting unsupported Arc features.
41. Validation: npm run check passes 47 tests and syntax checks; git diff --check passes. Existing-profile assignment/behavior for keys other than user-confirmed Cmd+T still requires UI verification. No OS settings changed. Crapper, Dryer and Mutator remain unavailable; no remote is configured.

## Search-only product v0.7.0

42. User explicitly requested removal of the sidebar, tab cycling and pin features to focus exclusively on search. Added failing tests for a search-only manifest and toolbar/shortcut routing.
43. Removed panel HTML/CSS/JS, side-panel worker configuration, positional/pin command logic, MRU tracking/session writes, obsolete tests and the unused Karabiner profile. Removed dead sidebar filtering from the model. Reduced permissions to tabs, activeTab, scripting, history and bookmarks. No user's native tabs, pins, groups or profile settings were modified.
44. Added a small search controller: toolbar clicks and the single open-search command open the same palette; validated suggestion/activation/navigation messages remain. Retained Cmd+T default, local suggestions, protected-page fallback and iframe keyboard isolation.
45. Rewrote current README, architecture, security, testing and shortcut docs around search-only behavior; older decisions remain here as history. No external helper or app is required. Final validation results follow.
46. Final validation: npm run check passes 26 search-focused tests plus syntax checks; git diff --check passes. The separate real-Chrome regression passes input/selection, stale suggestion handling, held-key dismissal, keyboard isolation and focus restoration. Full user-profile upgrade and real history/bookmark API integration remain manual. Crapper, Dryer and Mutator remain unavailable; no remote configured for push.

## Homepage suggestions and Tab completion v0.8.0

47. User requested Arc-like Tab behavior and opening a clean domain inferred from bookmarks/history. Asked whether Tab meant the key or tab-management actions, while progressing the independent homepage feature. With no clarification received during that work, used the stated assumption of address completion (the product remains search-only).
48. Added failing homepage tests, then derived deduplicated explicit homepage actions from matched web URLs. Preserve source-page choices, open-tab priority, scheme/subdomain/port; discard path/query/fragment. No permissions added.
49. Added plain-Tab completion of the highlighted URL without navigation, visible Tab hints, updated footer and keyboard access to the close control. Shift+Tab moves focus; Enter on close dismisses. Added browser regression scenarios for homepage/full-path completion and keyboard isolation. Final validation follows.
50. Final validation: npm run check passes 29 tests and syntax checks; git diff --check passes. Separate real headless Chrome regression passes Tab-without-navigation, homepage/full-path Enter behavior, stale-response protection and keyboard isolation. Full extension/profile/site integration remains manual. Crapper, Dryer and Mutator remain unavailable; no remote configured for push.

## Browser-driven appearance v0.9.0

51. User requested Chrome-like styling that responds to user setting changes. Asked whether they meant following Chrome appearance or separate settings; proceeded with the stated browser-appearance interpretation while the question remained unanswered. Investigated font/theme API availability and avoided adding broad fontSettings permissions or a separate preference store.
52. Added a browser regression before the style change and reproduced its failure on the fixed lavender background. Replaced hard-coded surface/text colors with native Canvas/CanvasText, browser selection/muted colors, neutral borders and Chrome-like spacing. Changed fixed text sizes to rem rooted in the browser medium default and generic sans-serif; included contrast/forced-colors handling.
53. Real headless Chrome regression passes live light/dark preference changes and base-font scaling, plus all existing search/Tab/domain/keyboard-isolation checks. Captured and inspected light and dark screenshots in /tmp. npm run check passes 29 tests and syntax checks; git diff --check passes. Actual user-profile Appearance settings integration remains manual. Profile accents/theme images are explicitly unsupported; no new permissions or persistent state. Crapper, Dryer and Mutator remain unavailable; no remote configured for push.

## Extension icon v0.9.1

54. User requested a polished extension icon. Created an original geometric search mark with a white magnifier, mint glint and blue/violet tile. Used a deterministic Pillow asset generator as the editable source; no new runtime dependencies or permissions.
55. Generated transparent PNGs at 16/32/48/128 px, visually inspected actual-size previews on light/dark backgrounds, and connected all sizes to manifest icons/action.default_icon. Added a favicon to the fallback search page.
56. Validated PNG format/dimensions/transparency and manifest paths. npm run check passes 29 tests and syntax checks; git diff --check passes. Actual Chrome icon cache refresh remains user-verifiable on extension reload. Crapper, Dryer and Mutator remain unavailable; no remote configured for push.

## Original Apple-inspired icon v0.9.2

57. User requested a more original Apple-inspired icon. Replaced the generic magnifier/glint with an original open optical orbit and detached focus bead, using a soft light superellipse tile, subtle material shading and a blue/indigo symbol. No Apple or Arc logo is copied.
58. Updated the editable deterministic generator and regenerated 16/32/48/128 px assets. Inspected an actual-size light/dark preview, including the 16 px mark. Verified all manifest paths, PNG sizes and transparent corners. npm run check passes 29 tests and syntax checks; git diff --check passes. No permissions or runtime behavior changed.

## Smarter local matching v0.10.0

59. User asked to make search smarter. Chose local query quality improvements without adding services/permissions. Added failing tests before the matcher implementation; verified official bookmark/history APIs for bounded recent candidate retrieval.
60. Added Russian/English keyboard-layout variants, accent normalization, one-edit/adjacent-transposition matching for longer words, and exact-domain/title-prefix ranking. Preserved open-tab source priority, merged aliases, original input and navigation behavior.
61. Expanded native queries to alternate-layout text. Only after no matches, use a bounded sample of 100 recently added bookmarks/100 recent history entries for typo candidates. Mark corrected suggestions explicitly and document that this is not exhaustive semantic search or a persistent index. Final checks follow.
62. Validation: 38 behavior tests and syntax checks pass; targeted matcher/source tests also pass after bounding typo expansion to short queries. Separate real-Chrome regression passes existing appearance, keyboard isolation, Tab completion and homepage behavior. git diff --check passes. Real profile retrieval/ranking remains manually verifiable; fuzzy recovery is limited to retrieved/recent candidates. Crapper, Dryer and Mutator remain unavailable; no remote configured for push.

## Arc Command Bar audit

63. User requested an Arc feature-parity analysis before porting additional behavior. Read official Arc Command Bar actions, multitasking overview and release-note archive, and compared the current search implementation. Checked official Chrome search/sessions/tabs APIs for feasible transfers. Several old Arc Help Center links no longer resolve; historical behavior is marked accordingly.
64. Produced docs/ARC_COMMAND_BAR_AUDIT.md with an implementation matrix, concrete code gaps, platform boundaries, acceptance scenarios and phased roadmap. Called out the Tab-mode mismatch, hard-coded Google search, missing edit-current-URL mode, modifiers, candidate/ranking limits and the early-Enter risk. Kept intentionally removed sidebar/pin/MRU features out of automatic scope. Did not claim live Arc testing or proprietary ranking parity.
65. Documentation-only change: checked git diff --check; runtime code and permissions unchanged, no tests rerun. No remote configured for push.

## Command Bar modes and actions v0.11.0 — implementation

66. User explicitly requested implementation of the missing audit-table scenarios. Added default-provider search through chrome.search, a source-validated edit mode, foreground/background/current navigation, a whitelisted command catalog and recently closed session restoration. Added encoded Site Search templates and validation with default YouTube/Wikipedia/GitHub sites.
67. Added visible Search/Edit/Commands/Recently closed/Site modes, Cmd+L edit invocation, empty-Tab command mode, keyword+Tab site scope and preserved URL Tab completion. Early Enter now waits for final suggestions; interaction/cancellation guards prevent provisional or changed selection from executing. Fixed confirmed full-path completion being displaced by a homepage suggestion after an async reply.
68. Added a native-style options page for custom site keywords/templates, default-provider settings and shortcut access. New permissions are search, sessions, storage (site definitions only) and clipboardWrite (explicit Copy URL action). No sidebar, global MRU, numbered pin commands, external helper or backend reintroduced.
69. Validation so far: 50 service/model/validation tests and syntax checks pass; real headless Chrome with stubbed APIs verifies all new modes, modifier routing, session selection, keyboard isolation, theme/font behavior and real options-form save/validation. Settings and palette screenshots inspected. Actual installed-profile permissions, Chrome provider/sessions/clipboard APIs and shortcut collisions remain manual checks. Final expanded early-Enter browser regression and documentation follow.
70. Final expanded browser regression passes early Enter against a deliberately delayed final suggestion, normal query words not executing commands, all modes/modifiers, restored-session selection, and real settings-form validation. Inspected palette and options screenshots. npm run check passes 50 tests and all module syntax checks; git diff --check passes. Updated README/architecture/security/keyboard/testing and marked the earlier Arc audit as a pre-implementation snapshot. No claim of live Arc parity or installed-profile API verification. Crapper, Dryer and Mutator remain unavailable; no remote configured for push.

## History dates and adaptive Site Search v0.12.0

71. At the user’s request, rewrote author/committer dates of the existing 19 commits: nine on October 29 after 19:00 and ten on October 30 after 18:00, Europe/Moscow. Preserved trees, identities, messages and parent order. Original history is backed up in /tmp/arc-for-chrome-before-redate-20261030.bundle; no remote configured.
72. Replaced fixed Site Search defaults with conservative inference from observed search URLs in tabs, recent bookmarks and recent history. Added inferred aliases and explicitly confirmed locally learned associations, optional overrides and a clear-learned action. No new permissions or network discovery.
73. Verified 55 unit tests, syntax checks and headless Chrome interaction regression. Full installed-profile integration remains manual. Committed as 1875496. The previous documentation update accidentally replaced this work log and the testing guide with keyboard-guide content; restored their history in the bilingual README update.

## Bilingual project presentation

74. Rebuilt the public README in English and Russian, preserving detailed behavior in docs/USER_GUIDE.md. Added a reproducible real-interface demo on fictional data and light/dark previews. Runtime extension behavior is unchanged.
75. Validation: npm run check passes all 55 tests; the real headless Chrome harness passes with optional demo capture enabled. Inspected Search/Site Search/Commands/dark screenshots; checked four-frame GIF dimensions/loop and all local links in both READMEs, user guide and media instructions. git diff --check passes. Added scripts/build-readme-demo.py for reproducible media packaging (development-only Pillow). No remote is configured, so no push is possible.
