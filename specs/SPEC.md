# SPEC — Cache de démarrage (stale-while-revalidate)

Statut : **validée par l'utilisateur le 2026-10-17** — implémentation engagée.
Version cible : RunBay ≥ 0.1.11

## 1. Contexte et problème

RunBay détecte les apps installées via les gestionnaires de paquets CLI (npm, pnpm,
yarn, bun, scoop) à chaque démarrage : `startScan()` vide le store en mémoire
(`store.clear()`) puis relance un scan complet de tous les providers
(`isAvailable` + `list` + `checkOutdated`, ce dernier interrogeant les registres
en ligne). Tant que le scan n'a pas produit de lot, l'interface est vide :
l'utilisateur voit les providers « se rechercher » à chaque ouverture.

Le store (`src/main/store.ts`) est un simple `Map` en mémoire : **une fermeture
réelle de l'app oublie tout**. (En mode fond/tray, le store survit déjà et un
scan de fond tourne toutes les 30 min — ce cas n'est pas le problème traité ici.)

Le projet connaît déjà ce patron : `src/main/icons.ts` met les icônes en cache
sur disque (`userData/icon-cache`, TTL, clé versionnée `v3:`). Les paramètres
sont persistés dans `userData/runbay-settings.json` avec repli silencieux si le
fichier est corrompu.

## 2. Objectifs

- **G1 — Instantanéité** : au démarrage (2ᵉ lancement et suivants), la dernière
  liste connue (providers, apps, badges de mise à jour, compteur du tray)
  s'affiche immédiatement, sans attendre le scan.
- **G2 — Justesse d'abord** *(priorité affirmée par l'utilisateur)* : toute
  information affichée depuis le cache est provisoire ; elle est corrigée dès
  que le scan de revalidation du provider concerné se termine. Rien n'est
  présenté comme vérifié pendant la revalidation (l'indicateur de scan existant
  reste le signal visuel).
- **G3 — Transparence** : aucune nouvelle option, aucun nouveau trafic réseau,
  aucun impact perçu hors le gain de démarrage. Le cache ne doit jamais faire
  échouer un démarrage (même robustesse que `settings.ts` / `icons.ts`).

**Design retenu** : *cache d'affichage* (stale-while-revalidate), pas *cache de
travail*. Le scan complet tourne bel et bien à chaque démarrage, mais en
arrière-plan, à partir de l'instant où la liste cachée est affichée. La
détection incrémentale (« ne rescanner que ce qui a changé ») est écartée de la
v1 (voir hors périmètre).

## 3. Exigences fonctionnelles

- **E1 — Persistance du snapshot.** Après chaque scan, l'état du store est écrit
  sur disque dans `userData/runbay-cache.json` : pour chaque provider, son
  dernier statut connu (`ok`/`absent`/`error`) et la liste complète de ses
  `AppInfo` (y compris `latestVersion` et `ignoredVersion`), plus un horodatage
  de scan et un numéro de schéma de cache (`cacheVersion`).
- **E2 — Écriture par provider, au fil de l'eau.** Le snapshot est réécrit à
  chaque fois qu'un provider termine son lot (et après les changements de store
  dus aux actions : uninstall, update, ignore/unignore), pas seulement à la fin
  du scan global. Une fermeture brutale en cours de scan laisse donc un état
  partiel mais cohérent provider par provider. L'écriture est atomique
  (fichier temporaire puis renommage) et non critique (échec d'écriture ignoré,
  comme `saveSettings`).
- **E3 — Chargement au démarrage.** Avant la création de la fenêtre, le cache
  est lu et validé (forme, `cacheVersion`) puis restauré dans le store. Le
  renderer reçoit cet état via les événements existants (`apps:batch`,
  `provider:status`) dès son premier `scan()` : la liste s'affiche sans
  attente. Cas sans cache exploitable (premier lancement, fichier absent,
  corrompu, schéma incompatible) : comportement strictement identique à
  aujourd'hui.
- **E4 — Revalidation automatique et systématique.** Dès que l'état caché est
  affiché, un scan complet de tous les providers démarre en arrière-plan (mêmes
  code et parallélisme que `scanAll` actuel). Pas de TTL, pas de saut de scan :
  on revalide toujours. Les cycles existants (30 min en mode fond, « Check for
  updates » du tray, bouton rescan) sont inchangés.
- **E5 — Correction sans clignotement.** La revalidation ne vide plus
  l'interface : le sens de `scan:begin` côté renderer change (plus de
  `setApps({})` ni reset des statuts) ; chaque lot `apps:batch` **remplace**
  les entrées de son provider (main et renderer), au lieu de les fusionner.
  Résultat : les paquets nouveaux apparaissent, les changements (versions,
  badges) se mettent à jour, les entrées fantômes disparaissent — provider par
  provider, sans effacement global. L'indicateur de scan discret existant
  (bouton rescan) signale le travail en cours ; pas d'atténuation des lignes,
  pas de badge « non vérifié ».
- **E6 — Source de vérité des ignorés.** `settings.ignored` reste autoritaire :
  au chargement du cache, `applyIgnored` est réappliqué. Un `ignoredVersion`
  périmé dans le cache ne peut ni masquer une version plus récente, ni
  réapparaître contre l'état des paramètres.
- **E7 — Portée locale uniquement.** Le cache ne contient que des données déjà
  connues (noms, versions, chemins, descriptions, badges). Écriture/lecture
  strictement locales (`app.getPath('userData')`), rien d'envoyé sur le réseau.
- **E8 — Survie aux mises à jour de RunBay.** Le cache traverse les
  auto-mises à jour de l'app ; seul un changement de `cacheVersion` (schéma
  incompatible) l'invalide, silencieusement.

## 4. Critères de succès vérifiables

- **S1 — Instantanéité** : au 2ᵉ lancement (cache écrit par un scan complet
  d'au moins 100 paquets), la liste des apps et des providers est visible
  **moins d'une seconde** après l'affichage de la fenêtre, sans que le scan ait
  terminé.
- **S2 — Convergence exacte** : une fois la revalidation terminée
  (`scan:end`), l'état affiché est identique à celui d'un démarrage froid
  actuel (mêmes apps, mêmes badges, mêmes statuts provider) — le cache n'ajoute
  ni ne retient rien de faux durablement.
- **S3 — Nouveaux paquets** : un paquet installé via CLI pendant que RunBay
  était fermé apparaît dans la liste **dès la fin du scan de son provider**
  (sans attendre les autres providers).
- **S4 — Entrées fantômes** : un paquet désinstallé à la main pendant la
  fermeture disparaît de la liste dès la fin du scan de son provider. Si
  l'utilisateur clique dessus avant (lancer/mettre à jour/désinstaller),
  l'action échoue avec un message d'erreur explicite (toast, comportement
  actuel) ; pour une désinstallation, l'entrée est retirée immédiatement.
- **S5 — Tolérance aux pannes** : cache absent, corrompu (JSON invalide),
  tronqué (écriture interrompue), ou de `cacheVersion` incompatible →
  l'app démarre exactement comme aujourd'hui, sans erreur visible, sans crash,
  et réécrit un cache valide.
- **S6 — Fermeture brutale** : tuer RunBay en plein scan ne produit ni doublon,
  ni fichier à moitié écrit au lancement suivant (écriture atomique, E2).
- **S7 — Non-régression** : aucun changement perceptible du comportement en
  mode fond/tray, des actions (lancer/mettre à jour/désinstaller), de
  l'assistant de bienvenue, du compteur de mises à jour du tray (qui suit
  simplement le store, donc le cache, dès le démarrage).

## 5. Cas limites

| Cas | Comportement attendu |
|---|---|
| Premier lancement (pas de cache) | Comportement actuel, inchangé. |
| Fichier corrompu / tronqué / illisible | Ignoré silencieusement, plein scan, réécriture. |
| `cacheVersion` différent (upgrade de schéma) | Idem. |
| Provider devenu absent (ex. bun désinstallé pendant la fermeture) | Ses apps sont affichées un court instant, puis le statut `absent` du scan les retire. |
| Provider devenu disponible | Apparaît à la fin de sa revalidation (E5). |
| Clic sur une entrée fantôme avant revalidation | Erreur CLI remontée en toast (actuel) ; l'entrée disparaît à la revalidation (S4). |
| Fenêtre fermée avant la fin de la revalidation | Le cache partiel par provider (E2) reste exploitable tel quel. |
| `ignoredVersion` dans le cache divergent de `settings.ignored` | `settings.ignored` gagne (E6). |
| Suppression manuelle du fichier de cache | Comme un premier lancement. |
| Plusieurs instances simultanées | Déjà impossible (`requestSingleInstanceLock`), rien à ajouter. |
| Mode dev (`npm run dev`) | Même comportement (même `userData`) ; le cache peut être partagé dev/paqué. |
| Gros volume (plusieurs centaines de paquets) | JSON de l'ordre du Mo au plus ; lecture négligeable. Pas de pagination. |
| Disque plein / droits insuffisants | Écriture ignorée silencieusement (E2), comme `saveSettings`. |

## 6. Hors périmètre

- **Détection incrémentale** (« ne rescanner que les providers ayant changé ») :
  envisagée, écartée en v1 — fragile à fiabiliser sur 5 providers aux
  comportements hétérogènes ; le gain visé (démarrage instantané) est déjà
  atteint par le cache d'affichage. Pourrait devenir une évolution ultérieure.
- **Surveillance de fichiers** (`fs.watch` sur les dossiers d'installation) :
  non fiable sur tous les volumes Windows, écartée.
- **TTL / saut de scan** (« dernier scan récent → ne pas rescanner ») :
  écarté par la priorité justesse (G2) ; on revalide toujours (E4).
- **Option utilisateur** (interrupteur dans Options) : écarté (G3).
- **Marquage visuel des entrées issues du cache** (lignes grisées, badge
  « non vérifié », mention « dernière vérification : … ») : écarté ; seul
  l'indicateur de scan existant signale la revalidation (E5).
- **Synchronisation inter-instances ou inter-machines** du cache.
- **Changement du format de stockage** (SQLite, etc.) : un JSON simple suffit
  aux volumes concernés ; le patron `settings.ts`/`icons.ts` est repris.

## 7. Pile technique et points d'implémentation proposés

Pile inchangée : Electron (main process, Node ≥ 20), TypeScript, React au
renderer. Aucun ajout de dépendance.

- **Nouveau module `src/main/cache.ts`** — même patron que `settings.ts` :
  lecture/validation/écriture de `userData/runbay-cache.json`, écriture atomique
  (`.tmp` + `rename`), repli silencieux. Clé `cacheVersion` (entier) dans le
  fichier.
- **`src/main/store.ts`** — ajout de `snapshot()` (apps groupées par provider +
  statuts) et `restore()` ; le store devient la source du snapshot, comme il
  l'est déjà pour l'infobulle du tray.
- **`src/main/ipc.ts` / `scanner.ts`** — au démarrage : charger le cache dans le
  store **avant** `createWindow()` ; `scan()` (appelé au montage du renderer)
  envoie d'abord l'état courant du store sous forme de lots + statuts, puis
  lance la revalidation. Persistance par provider à chaque lot (E2), et après
  les actions qui modifient le store.
- **`src/renderer/src/App.tsx`** — `scan:begin` ne vide plus la liste ni les
  statuts ; `apps:batch` remplace les entrées par provider (miroir exact de
  `store.replaceAllFor`). Vérifier que l'état vide (« aucune app ») ne s'affiche
  que quand le store est réellement vide après scan.
- **`src/shared/types.ts`** — type `CacheSnapshot` (provider → { status, apps },
  + `savedAt`, `cacheVersion`). Aucune nouvelle méthode d'API preload n'est
  nécessaire (les événements `apps:batch` / `provider:status` suffisent).

### Risques identifiés

- **Badges périmés temporairement affichés** (choix assumé « tout en cache »,
  confirmé avec l'utilisateur) : un badge « update available » peut être faux
  quelques secondes. La correction arrive aussi tôt que possible : la
  vérification registre (`checkOutdated`) est déjà lancée en parallèle de la
  liste locale (`scanner.ts`), donc le badge est corrigé dès la fin de la
  revalidation de SON provider. Le pire résidu (badge affiché alors que le
  paquet est déjà à jour) est sans conséquence : « Update » réinstalle
  `@latest` sans risque. Alternatives considérées et écartées : ne pas cacher
  les badges (compteur du tray repart à zéro à chaque démarrage), TTL court sur
  les badges seuls (complexité + faux négatifs, gain nul puisque la
  revalidation corrige de toute façon), griser les badges non confirmés
  (marquage visuel refusé à l'interview).
- **Changement de sémantique de `scan:begin`** : touche l'affichage de l'état
  vide et l'animation de scan ; à vérifier manuellement (S7).
- **Fenêtre visible pendant la revalidation** : les lots arrivent à chaud dans
  la liste (déjà le cas aujourd'hui avec le scan du tray) ; pas de tri
  supplémentaire à prévoir, le tri existant s'applique.
