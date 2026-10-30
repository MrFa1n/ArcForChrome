# Security policy

Only the latest development version is maintained. Do not post secrets, browsing history or exploit details publicly. Until a private reporting channel is configured, open an issue requesting a private contact without including sensitive details.

The search extension reads matching tab, history and bookmark titles/URLs locally. History/bookmarks are never modified. The overlay is injected using temporary activeTab access after explicit invocation; no host permissions or persistent content scripts are requested. Chrome messages validate their sender and source window before navigation/activation.

No telemetry, backend, remote code or persistent browsing database is present. Opening a URL contacts that site; choosing the Google-search row submits the entered query to Google. Changes adding remote calls, broader permissions or persistent browsing data need documentation and review.

Version 0.7 removes sidePanel, tabGroups and storage permissions along with the tab-management features.
