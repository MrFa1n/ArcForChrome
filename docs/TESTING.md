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
