# README media

These are captures of the actual `mountPalette` interface in a disposable headless Chrome profile. Page content, tabs and browser responses are fictional fixtures; no personal history or bookmarks are included. The GIF cycles through Search, a matching open tab, detected Site Search and Commands. It demonstrates interface states; it does not record live browser-service integration or keyboard timing.

To reproduce both language sets from the repository root (Node.js 22+, Chrome and Python with Pillow):

```sh
mkdir -p /tmp/arc-readme-captures-en /tmp/arc-readme-captures-ru
PALETTE_SCREENSHOT_ONLY=1 PALETTE_SCREENSHOT_DIR=/tmp/arc-readme-captures-en npm run check:browser
PALETTE_SCREENSHOT_ONLY=1 PALETTE_SCREENSHOT_LOCALE=ru PALETTE_SCREENSHOT_DIR=/tmp/arc-readme-captures-ru npm run check:browser
python3 scripts/build-readme-demo.py /tmp/arc-readme-captures-en en
python3 scripts/build-readme-demo.py /tmp/arc-readme-captures-ru ru
```

Set `CHROME_BINARY` if Chrome is not installed at the standard macOS path. Each capture directory must already exist. Screenshot-only mode disables browser assertions; use the regular `npm run check:browser` command separately to run them. Russian captures apply the packaged Russian catalog to the actual interface, then restore the page before continuing. The script also produces regression screenshots that are not bundled in the README. Each GIF is assembled from four captures, with deliberately readable pauses. Static light/dark PNGs are included for readers who prefer no animation.

English media use names such as `spotlight-light.png`; Russian copies add `.ru` before the extension, for example `spotlight-light.ru.png` and `spotlight-demo.ru.gif`. English and Russian READMEs link to their matching set.

The activity-history preview uses two fictional action records. The current GIF includes inline shortcut + query; no live prompt is sent during capture.

The selection, group picker and bookmark-folder picker PNGs show the current multi-tab workflow, captured with the same fictional fixtures. Their browser API responses are stubbed; the displayed UI and keyboard handling are the extension’s real code.

Version 0.21 adds contextual Actions, provider redirection, quicklinks and calculator captures. These are real UI states with fictional data and stubbed browser services; no remote prompt is submitted and automated clipboard tests use a stub. The provider example includes builtins and detected site scopes.

Version 0.22 adds fictional notes-list, multiline-editor and full-shortcut-directory captures. Global shortcut assignments in screenshots are test fixtures; the installed extension reads its actual Chrome assignments. No personal notes or clipboard are used.

Version 0.23 refreshes the palette captures for the token-based interface and the current **⌘T** Search shortcut. PNGs and the README GIF were regenerated from the current `mountPalette` code with fictional tabs and stubbed browser APIs.
