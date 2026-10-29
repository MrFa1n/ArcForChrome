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
