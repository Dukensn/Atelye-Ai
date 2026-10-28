# Atelier AI — plateforme de formation

Site très simple : page d'accueil, paiement MonCash / NatCash (vérifié à la main), espace élève, page admin.
Hébergé sur Vercel. Les données sont dans un store **Vercel Blob privé** (un fichier JSON par inscription).

## Pages

| Adresse | Pour qui | Rôle |
| --- | --- | --- |
| `/` | tout le monde | présentation, prix (1 500 goud), bouton « Mwen vle kòmanse » |
| `/peye` | élève | numéro MonCash/NatCash + formulaire (nom, WhatsApp, e-mail, n° de transaction) |
| `/espas?k=…` | élève validé | les 2 vidéos, le lien d'essai Claude, le dépôt du skill, le guide |
| `/admin` | toi | valider ou refuser les paiements, envoyer le lien par WhatsApp, modifier le contenu |

## Réglages Vercel

1. **Storage → Create → Blob**, accès **Private**, relié au projet : Vercel ajoute `BLOB_READ_WRITE_TOKEN` tout seul.
2. **Settings → Environment Variables** :

| Variable | Exemple | Type |
| --- | --- | --- |
| `ADMIN_MODPAS` | mot de passe de `/admin` (8 caractères minimum) | Sensitive |
| `MONCASH_NIMEWO` | `3700 0000` | Plain |
| `NATCASH_NIMEWO` | `4100 0000` | Plain |
| `NON_BENEFISYE` | nom affiché sous le numéro | Plain |

Après un changement de variable : **Deployments → … → Redeploy**.

## Comment un élève est validé

1. L'élève paie et remplit le formulaire → demande « An atant » dans `/admin`.
2. Tu vérifies dans ton appli MonCash/NatCash que l'argent est arrivé.
3. « Peman an rive — Aksepte » → un lien personnel est créé et WhatsApp s'ouvre avec le message prêt.
4. « Retire aksè » coupe le lien à tout moment.

Le contenu de l'espace élève (liens des vidéos YouTube non répertoriées, lien Claude 7 jours, etc.) se change dans l'onglet **Kontni** de `/admin`, sans redéployer.

## Structure

- `public/` : les pages (HTML/CSS, aucun framework)
- `api/` : les fonctions Vercel (`konfig`, `enskripsyon`, `espas`, `admin`)
- `lib/store.js` : lecture/écriture dans Vercel Blob (`ATELIER_MEMWA=1` = mémoire, pour les tests)
