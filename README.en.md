<div align="center">

<img src="build/icon.png" alt="RunBay" width="96" />

# RunBay

**Not an installer. A launcher.**

[Français](README.md) · **English**

</div>

Package managers are great at installing things. They are terrible at showing you what you **already** have, letting you run it, and telling you what's out of date. **RunBay** fixes that: it finds every app and CLI you installed from the command line — **npm, pnpm, yarn, bun, scoop** — and puts them in one fast, modern window.

## 🖥️ The interface

![RunBay main window](assets/screenshots/main.png)

## ✨ What it does

- **Detects** everything installed through the package managers actually present on your machine — nothing invented, RunBay reads what your managers already know
- **Launches** any of them in one click — interactive CLIs open in a real console
- **Updates** only when a newer version actually exists — with *Update all*, and *ignore this version* when the nag gets old
- **Uninstalls** with a real confirmation dialog, never an accidental click
- **Desktop shortcuts** for the tools you use every day
- **Detail panel**: description, homepage, exposed binaries, install location
- **Tray mode**: close the window and RunBay keeps scanning quietly, then notifies you when something can be updated
- **Light and dark themes**, collapsible sidebar, instant search, per-source colors

## 🔄 RunBay updates itself

When a newer version lands on npm, a yellow dot appears in the app. One click: it reinstalls and restarts on its own. No more remembering `npm update -g`.

## 📦 Supported sources

| Source | Detect | Launch | Uninstall | Update |
|---|---|---|---|---|
| npm (global) | ✅ | ✅ | ✅ | ✅ |
| pnpm (global) | ✅ | ✅ | ✅ | ✅ |
| yarn v1 (global) | ✅ | ✅ | ✅ | ✅ |
| bun (global) | ✅ | ✅ | ✅ | ✅ |
| scoop | ✅ | ✅ | ✅ | ✅ |

## ⚙️ Installation

> **Prerequisite: [Node.js](https://nodejs.org) must be installed** (LTS recommended). This is required — without Node.js, RunBay can neither install nor run.

RunBay ships through npm (no installer, no SmartScreen):

```bash
npm install -g runbay
runbay
```

Or try it once, without installing anything:

```bash
npx runbay
```

## 🔧 Daily use

Select an app to open its detail — version, source, install location, exposed binaries — then launch it, create a shortcut, or uninstall it.

![Detail panel](assets/screenshots/detail.png)

Right-click opens a menu grouped by intent: *Run*, *Manage*.

![Context menu](assets/screenshots/context.png)

The **Options** button holds every setting: theme, startup, tray, welcome guide — and updating RunBay itself.

![Options menu](assets/screenshots/options.png)

## 🧩 Why "not an installer"

An installer adds things to your machine. A launcher gets you *to* the things you already have. RunBay never installs anything for you — it reads what npm, pnpm, yarn, bun and scoop already know, and turns that list into a place you can actually work: launch, update, remove, shortcut. The command line stays your install tool; RunBay is your run tool.

## 👨‍💻 Development

```bash
npm install
npm run dev          # the app with hot reload
npm run typecheck    # type checking
npm run build        # production bundles
npm run package:win  # Windows installer (electron-builder)
```

Each source is an isolated **provider** (`src/main/providers/`): adding a new one means adding one file that implements the `Provider` interface.

## ☕ Support

[Buy Me a Coffee — skroproduction](https://buymeacoffee.com/skroproduction)

## License

MIT
