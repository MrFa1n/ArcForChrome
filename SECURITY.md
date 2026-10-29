# Security policy

Only the latest development version is maintained. Do not post secrets, browsing history or exploit details publicly. Until a private reporting channel is configured, open an issue requesting a private contact without including sensitive details. Never use an issue to report an actively exploitable vulnerability in detail.

This extension reads tab titles and URLs locally. Changes that add remote calls, host permissions, injected scripts or persistent browsing data need explicit documentation and review.

The command palette uses temporary activeTab access and scripting on explicit invocation. It renders tab titles/URLs in an isolated-world shadow DOM; no persistent content scripts or host permissions are requested.
