#!/usr/bin/env node
'use strict'
// Lanceur RunBay (npm install -g runbay, npx runbay) : démarre l'app Electron
// embarquée dans ce paquet, puis rend la main au terminal.
const { spawn } = require('node:child_process')
const { join } = require('node:path')

// require('electron') renvoie le chemin du binaire Electron installé avec le paquet.
const child = spawn(require('electron'), [join(__dirname, '..')], {
  detached: true,
  stdio: 'ignore',
  windowsHide: true
})
child.unref()
