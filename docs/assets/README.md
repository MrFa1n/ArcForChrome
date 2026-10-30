# README media

These are captures of the actual `mountPalette` interface in a disposable headless Chrome profile. Page content, tabs and browser responses are fictional fixtures; no personal history or bookmarks are included. The GIF cycles through Search, a matching open tab, detected Site Search and Commands. It demonstrates interface states; it does not record live browser-service integration or keyboard timing.

To reproduce from the repository root (Node.js 22+, Chrome and Python with Pillow):

```sh
mkdir -p /tmp/arc-readme-captures
PALETTE_SCREENSHOT_DIR=/tmp/arc-readme-captures npm run check:browser
python3 scripts/build-readme-demo.py /tmp/arc-readme-captures
```

Set `CHROME_BINARY` if Chrome is not installed at the standard macOS path. The capture directory must already exist. The script also produces regression screenshots that are not bundled in the README. The GIF is assembled from four unmodified captures, with deliberately readable pauses. Static light/dark PNGs are included for readers who prefer no animation.
