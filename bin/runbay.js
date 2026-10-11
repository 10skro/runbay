#!/usr/bin/env node
'use strict'
// Lanceur RunBay (npm install -g runbay, npx runbay) : démarre l'app Electron
// embarquée dans ce paquet, puis rend la main au terminal.
const { spawn, spawnSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const { join, dirname } = require('node:path')

// npm v12 ne lance plus les scripts des dépendances par défaut : le postinstall
// d'electron (qui télécharge son binaire) a pu être sauté silencieusement.
// Plutôt que d'échouer platement, on rattrape ce script d'installation officiel
// d'electron nous-mêmes — c'est le même téléchargement, au bon moment.
const electronDir = dirname(require.resolve('electron'))
const electronBin = process.platform === 'win32' ? 'electron.exe' : 'electron'
if (!existsSync(join(electronDir, 'dist', electronBin))) {
  console.log('RunBay : binaire Electron manquant, exécution de son installeur (téléchargement unique)…')
  const r = spawnSync(process.execPath, [join(electronDir, 'install.js')], { stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

// require('electron') renvoie le chemin du binaire Electron installé avec le paquet.
const child = spawn(require('electron'), [join(__dirname, '..')], {
  detached: true,
  stdio: 'ignore',
  windowsHide: true
})
child.unref()
