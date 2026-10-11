import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/main.css'

// Le thème est appliqué avant le premier rendu : aucune trame du mauvais thème
// n'est peinte au démarrage (le fond de la fenêtre suit déjà le même réglage).
async function boot(): Promise<void> {
  const theme = await window.api.theme().catch(() => 'dark' as const)
  if (theme === 'light') document.documentElement.dataset.theme = 'light'

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

void boot()
