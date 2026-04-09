# Assets Placeholder

Add installation screenshots and usage demo assets here.

This directory intentionally tracks only lightweight source files and notes.
Generated screenshots, GIFs, and other large binaries remain ignored by
`.gitignore` unless you explicitly change the policy for a release artifact.

Web Store screenshot sources and generated outputs:
- `web-store/showcase.html`
- `web-store/showcase.css`
- `web-store/showcase.js`
- `web-store/screenshots/store-screenshot-01-compose.jpg`
- `web-store/screenshots/store-screenshot-02-favorites.jpg`
- `web-store/screenshots/store-screenshot-03-reuse-tabs.jpg`
- `web-store/screenshots/store-screenshot-04-dashboard.jpg`
- `web-store/screenshots/store-screenshot-05-custom-service.jpg`

Regenerate the Web Store screenshots with:

```bash
node ./scripts/generate-store-screenshots.mjs
```

Expected filenames referenced by `README.md`:
- `install-step-1-extensions-page.png`
- `install-step-2-developer-mode.png`
- `install-step-3-load-unpacked.png`
- `install-step-4-select-folder.png`
- `install-step-5-extension-loaded.png`
- `usage-demo.gif`

Those installation screenshots and the usage GIF are local placeholders only by
default. If you want to publish them in the repository, update `.gitignore`
first so the policy matches the release intent.
