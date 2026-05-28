# Pangram AI Detection Firefox

Unofficial Firefox conversion of the Pangram AI Detection browser extension.

This repository contains the Firefox extension source at the repository root. The original Chrome unpack, CRX, ZIP, and XPI build artifacts are not tracked.

## What Changed

- Converted the extension to a Firefox-compatible WebExtension manifest.
- Replaced the Chrome side panel integration with Firefox sidebar support.
- Added `Alt+Shift+C` to check selected text from the current page.
- Added `Alt+Shift+P` to open the Pangram sidebar.
- Kept the popup open after starting a text check.
- Syncs recent Pangram website checks into the popup history when the popup opens.

On macOS, Firefox displays the shortcuts as `Ctrl+Shift+C` and `Ctrl+Shift+P`.

## Load Temporarily

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click `Load Temporary Add-on`.
3. Select `manifest.json` from this repository.

Temporary add-ons are removed when Firefox restarts. Permanent installation in Firefox Release usually requires AMO signing.

## Validate And Build

Run these commands from the repository root:

```sh
pnpm dlx web-ext lint --source-dir .
pnpm dlx web-ext build --source-dir . --artifacts-dir dist --overwrite-dest --ignore-files README.md .gitignore
```

The build command writes artifacts to `dist/`, which is intentionally not committed.

## Notes

- Minimum Firefox version is `142.0`, matching `manifest.json`.
- Browser-protected pages such as `about:*`, extension pages, and other restricted URLs cannot be scanned.
- Website history sync may need an already logged-in `pangram.com` tab open if Firefox does not expose the Pangram session cookies to the extension request.
- This is an unofficial conversion and is not affiliated with Pangram.
