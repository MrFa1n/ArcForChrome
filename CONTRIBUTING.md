# Contributing

Start with a small issue describing the user-visible behavior and reproduction steps. Keep changes focused, preserve accessible native controls, validate browser inputs at boundaries, and avoid new permissions or dependencies without a concrete need.

Run `npm run check` with Node.js 22+ and the manual checklist in `docs/TESTING.md`. Add behavior tests for logic changes; do not assert private implementation details. Include results and known limitations in your pull request.

Use small commits with a subject explaining the change and a body stating why it was needed and how it was verified. Never commit secrets or real browsing data. Treat contributors respectfully; harassment and disclosure of private information are unacceptable.
