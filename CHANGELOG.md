# Changelog

All notable changes to RunBay are documented in this file.
This project follows [semantic versioning](https://semver.org); the sections below
also feed the GitHub Release notes, generated at publish time.

## [0.1.7] - 2026-10-11

### Fixed

- The app icon now shows in the Windows taskbar and title bar: the window icon was only set while developing, so the installed app wore Electron's default face. It now uses the app's own icon file, the same one the tray uses

## [0.1.6] - 2026-10-11

### Fixed

- Self-update no longer opens console windows: the helper script now runs in a fully hidden console, and the restart launches the app binary directly — no more windows for the wait, the install or the relaunch
- RunBay no longer lists itself in the app list: its "Update" action tried to reinstall it while it was running, which is impossible on Windows (EBUSY). Managing the app itself stays in the Options menu, where the flow is safe

## [0.1.5] - 2026-10-11

### Changed

- Apps that declare no homepage now use their repository URL as their identity: their real logo (GitHub social preview, then owner avatar) is found instead of falling back to a letter monogram
- Icon cache: entries older than a week are re-checked, so a social preview added after the fact is picked up automatically

### Fixed

- Self-update: installs the exact detected version instead of `@latest` — a stale local npm cache could silently resolve `@latest` to the old version and change nothing

## [0.1.4] - 2026-10-11

### Fixed

- Self-update: the detached install helper could not start on recent Node versions (`spawn EINVAL` — `.cmd` files now require a shell), so the update never began. It now launches correctly: RunBay closes, installs, and restarts on its own

## [0.1.3] - 2026-10-11

### Added

- RunBay now shows its own version: discreetly at the bottom of the sidebar, and in the Options → RunBay menu

## [0.1.2] - 2026-10-11

### Fixed

- Self-update on Windows: RunBay no longer tries to replace itself while it is running — Windows locks the files of a running app (`EBUSY`). The install is now delegated to a detached helper: RunBay closes, npm installs, then RunBay restarts on its own
- One retry 30 seconds later when the npm registry has not yet propagated a fresh publish (`ETARGET` during provenance processing)
- npm output is logged to `update.log` in the app data folder, for diagnostics

## [0.1.1] - 2026-10-11

### Changed

- Project icons: prefer the repository's social preview image (`github.com/<owner>/<repo>.png`), then the owner avatar, then the website favicon

## [0.1.0] - 2026-10-11

### Added

- First public release: detects apps and CLIs installed via npm, pnpm, yarn, bun and scoop — only the managers actually present on your machine
- One-click launch (interactive CLIs open in a real console), uninstall with a real confirmation, desktop shortcuts for daily tools
- Update detection with *Update all* and *ignore this version* — actions appear only when a real update exists
- Self-update: a yellow dot when a newer version lands on npm, one click to reinstall and restart
- Tray mode with quiet background scanning and notifications
- Light & dark themes, collapsible sidebar, instant search, per-source colors, welcome guide
