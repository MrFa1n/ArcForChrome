# Security policy

Only the latest development version is maintained. Do not post secrets, history or exploit details publicly. Until private reporting is configured, open an issue requesting a private contact without sensitive details.

Suggestions read tabs, bookmarks and history locally; they do not edit/delete those sources or send typed text to an online completion service. Selecting a search, destination or restored session causes normal navigation to that provider/site.

The worker validates extension senders and source windows/tabs before actions. Current-page replacement is explicit; ordinary Search opens new tabs or activates existing results. Commands are whitelisted in a separate mode. Closed-tab IDs are rechecked against Chrome's recent sessions. Custom search templates require HTTP(S), no credentials, unique keywords and exactly one query placeholder.

Storage contains only user-defined Site Search templates, not browsing activity. ClipboardWrite supports explicit URL copying; clipboard contents are never read. New permissions in 0.11 are search, sessions, storage and clipboardWrite, each documented in README.

The overlay is injected through activeTab/scripting on invocation. No host permissions, persistent content scripts, remote code, telemetry or backend are present. Its iframe isolates normal keyboard events from host page handlers; it does not protect against hostile sites removing the overlay DOM.

Changes introducing external services, wider permissions or persistent browsing data need documentation and review.
