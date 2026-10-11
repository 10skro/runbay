# RunBay

**Not an installer. A launcher.**

Package managers are great at installing things. They are terrible at showing you what you already have, letting you run it, and telling you what's out of date. RunBay fixes that: it finds every app and CLI you installed from the command line — **npm, pnpm, yarn, bun, scoop** — and puts them in one fast, modern window.

## Install

```bash
npm install -g runbay    # then start it with: runbay
```

or just try it once:

```bash
npx runbay
```

RunBay **updates itself**: when a newer version lands on npm, a yellow dot appears in the app — one click reinstalls and restarts. No manual `npm update -g`, no forgetting.

## What it does

- 🔍 **Detects** everything installed through the package managers actually present on your machine
- ▶ **Launches** any of them in one click — interactive CLIs open in a real console
- ⬆ **Updates** only when a newer version actually exists — with *Update all*, and *ignore this version* when you don't want the nag
- 🗑 **Uninstalls** with a real confirmation dialog, never an accidental click
- 📌 **Desktop shortcuts** for the tools you use every day
- 🧰 **Detail panel**: description, homepage, exposed binaries, install location
- 🕐 **Tray mode**: close the window and RunBay keeps scanning quietly, then notifies you when something can be updated
- 🌗 Light and dark themes, collapsible sidebar, search, per-source colors

## Supported sources

| Source | Detect | Launch | Uninstall | Update |
|---|---|---|---|---|
| npm (global) | ✅ | ✅ | ✅ | ✅ |
| pnpm (global) | ✅ | ✅ | ✅ | ✅ |
| yarn v1 (global) | ✅ | ✅ | ✅ | ✅ |
| bun (global) | ✅ | ✅ | ✅ | ✅ |
| scoop | ✅ | ✅ | ✅ | ✅ |

Each source is an isolated **provider** (`src/main/providers/`): adding a new one means adding one file that implements the `Provider` interface.

## Why "not an installer"

An installer adds things to your machine. A launcher gets you *to* the things you already have. RunBay never installs anything for you — it reads what npm, pnpm, yarn, bun and scoop already know, and turns that list into a place you can actually work: launch, update, remove, shortcut. The command line stays your install tool; RunBay is your run tool.

## Development

```bash
npm install
npm run dev          # run the app with hot reload
npm run typecheck    # check types
npm run build        # production renderer/main/preload bundles
npm run package:win  # build a Windows installer (electron-builder)
```

## License

MIT
